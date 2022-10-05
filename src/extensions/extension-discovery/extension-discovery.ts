/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ipcRenderer } from "electron";
import { EventEmitter } from "events";
import { makeObservable, observable, reaction, when } from "mobx";
import { broadcastMessage, ipcMainHandle, ipcRendererOn } from "../../common/ipc";
import { isErrnoException, toJS } from "../../common/utils";
import type { ExtensionsStore } from "../extensions-store/extensions-store";
import type { ExtensionLoader } from "../extension-loader";
import type { LensExtensionId, LensExtensionManifest } from "../lens-extension";
import type { ExtensionInstallationStateStore } from "../extension-installation-state-store/extension-installation-state-store";
import type { PackageJson } from "type-fest";
import { extensionDiscoveryStateChannel } from "../../common/ipc/extension-handling";
import { requestInitialExtensionDiscovery } from "../../renderer/ipc";
import type { ReadJson } from "../../common/fs/read-json-file.injectable";
import type { Logger } from "../../common/logger";
import type { PathExists } from "../../common/fs/path-exists.injectable";
import type { Watch } from "../../common/fs/watch/watch.injectable";
import type { Stats } from "fs";
import { constants } from "fs";
import type { LStat } from "../../common/fs/lstat.injectable";
import type { ReadDirectory } from "../../common/fs/read-directory.injectable";
import type { EnsureDirectory } from "../../common/fs/ensure-dir.injectable";
import type { AccessPath } from "../../common/fs/access-path.injectable";
import type { Copy } from "../../common/fs/copy.injectable";
import type { JoinPaths } from "../../common/path/join-paths.injectable";
import type { GetBasenameOfPath } from "../../common/path/get-basename.injectable";
import type { GetDirnameOfPath } from "../../common/path/get-dirname.injectable";
import type { GetRelativePath } from "../../common/path/get-relative-path.injectable";
import type { RemovePath } from "../../common/fs/remove-path.injectable";
import type TypedEventEmitter from "typed-emitter";

interface Dependencies {
  readonly extensionLoader: ExtensionLoader;
  readonly extensionsStore: ExtensionsStore;
  readonly extensionInstallationStateStore: ExtensionInstallationStateStore;
  readonly extensionPackageRootDirectory: string;
  readonly staticFilesDirectory: string;
  readonly logger: Logger;
  readonly isProduction: boolean;
  readonly fileSystemSeparator: string;
  readonly homeDirectoryPath: string;
  isCompatibleExtension: (manifest: LensExtensionManifest) => boolean;
  installExtension: (name: string) => Promise<void>;
  installExtensions: (packageJsonPath: string, packagesJson: PackageJson) => Promise<void>;
  readJsonFile: ReadJson;
  pathExists: PathExists;
  removePath: RemovePath;
  lstat: LStat;
  watch: Watch;
  readDirectory: ReadDirectory;
  ensureDirectory: EnsureDirectory;
  accessPath: AccessPath;
  copy: Copy;
  joinPaths: JoinPaths;
  getBasenameOfPath: GetBasenameOfPath;
  getDirnameOfPath: GetDirnameOfPath;
  getRelativePath: GetRelativePath;
}

export interface InstalledExtension {
  id: LensExtensionId;

  readonly manifest: LensExtensionManifest;

  // Absolute path to the non-symlinked source folder,
  // e.g. "/Users/user/.k8slens/extensions/helloworld"
  readonly absolutePath: string;

  // Absolute to the symlinked package.json file
  readonly manifestPath: string;
  readonly isBundled: boolean; // defined in project root's package.json
  readonly isCompatible: boolean;
  isEnabled: boolean;
}

const logModule = "[EXTENSION-DISCOVERY]";

export const manifestFilename = "package.json";

interface ExtensionDiscoveryChannelMessage {
  isLoaded: boolean;
}

/**
 * Returns true if the lstat is for a directory-like file (e.g. isDirectory or symbolic link)
 * @param lstat the stats to compare
 */
const isDirectoryLike = (lstat: Stats) => lstat.isDirectory() || lstat.isSymbolicLink();

interface LoadFromFolderOptions {
  isBundled?: boolean;
}

interface ExtensionDiscoveryEvents {
  add: (ext: InstalledExtension) => void;
  remove: (extId: LensExtensionId) => void;
}

/**
 * Discovers installed bundled and local extensions from the filesystem.
 * Also watches for added and removed local extensions by watching the directory.
 * Uses ExtensionInstaller to install dependencies for all of the extensions.
 * This is also done when a new extension is copied to the local extensions directory.
 * .init() must be called to start the directory watching.
 * The class emits events for added and removed extensions:
 * - "add": When extension is added. The event is of type InstalledExtension
 * - "remove": When extension is removed. The event is of type LensExtensionId
 */
export class ExtensionDiscovery {
  protected bundledFolderPath!: string;

  private loadStarted = false;
  private extensions: Map<string, InstalledExtension> = new Map();

  // True if extensions have been loaded from the disk after app startup
  @observable isLoaded = false;

  get whenLoaded() {
    return when(() => this.isLoaded);
  }

  public readonly events: TypedEventEmitter<ExtensionDiscoveryEvents> = new EventEmitter();

  constructor(protected readonly dependencies: Dependencies) {
    makeObservable(this);
  }

  get localFolderPath(): string {
    return this.dependencies.joinPaths(this.dependencies.homeDirectoryPath, ".k8slens", "extensions");
  }

  get packageJsonPath(): string {
    return this.dependencies.joinPaths(this.dependencies.extensionPackageRootDirectory, manifestFilename);
  }

  get inTreeTargetPath(): string {
    return this.dependencies.joinPaths(this.dependencies.extensionPackageRootDirectory, "extensions");
  }

  get inTreeFolderPath(): string {
    return this.dependencies.joinPaths(this.dependencies.staticFilesDirectory, "../extensions");
  }

  get nodeModulesPath(): string {
    return this.dependencies.joinPaths(this.dependencies.extensionPackageRootDirectory, "node_modules");
  }

  /**
   * Initializes the class and setups the file watcher for added/removed local extensions.
   */
  async init(): Promise<void> {
    if (ipcRenderer) {
      await this.initRenderer();
    } else {
      await this.initMain();
    }
  }

  async initRenderer(): Promise<void> {
    const onMessage = ({ isLoaded }: ExtensionDiscoveryChannelMessage) => {
      this.isLoaded = isLoaded;
    };

    requestInitialExtensionDiscovery().then(onMessage);
    ipcRendererOn(extensionDiscoveryStateChannel, (_event, message: ExtensionDiscoveryChannelMessage) => {
      onMessage(message);
    });
  }

  async initMain(): Promise<void> {
    ipcMainHandle(extensionDiscoveryStateChannel, () => this.toJSON());

    reaction(() => this.toJSON(), () => {
      this.broadcast();
    });
  }

  /**
   * Watches for added/removed local extensions.
   * Dependencies are installed automatically after an extension folder is copied.
   */
  async watchExtensions(): Promise<void> {
    this.dependencies.logger.info(`${logModule} watching extension add/remove in ${this.localFolderPath}`);

    // Wait until .load() has been called and has been resolved
    await this.whenLoaded;

    this.dependencies.watch(this.localFolderPath, {
      // For adding and removing symlinks to work, the depth has to be 1.
      depth: 1,
      ignoreInitial: true,
      // Try to wait until the file has been completely copied.
      // The OS might emit an event for added file even it's not completely written to the file-system.
      awaitWriteFinish: {
        // Wait 300ms until the file size doesn't change to consider the file written.
        // For a small file like package.json this should be plenty of time.
        stabilityThreshold: 300,
      },
    })
      // Extension add is detected by watching "<extensionDir>/package.json" add
      .on("add", this.handleWatchFileAdd)
      // Extension remove is detected by watching "<extensionDir>" unlink
      .on("unlinkDir", this.handleWatchUnlinkEvent)
      // Extension remove is detected by watching "<extensionSymLink>" unlink
      .on("unlink", this.handleWatchUnlinkEvent);
  }

  handleWatchFileAdd = async (manifestPath: string): Promise<void> => {
    // e.g. "foo/package.json"
    const relativePath = this.dependencies.getRelativePath(this.localFolderPath, manifestPath);

    // Converts "foo/package.json" to ["foo", "package.json"], where length of 2 implies
    // that the added file is in a folder under local folder path.
    // This safeguards against a file watch being triggered under a sub-directory which is not an extension.
    const isUnderLocalFolderPath = relativePath.split(this.dependencies.fileSystemSeparator).length === 2;

    if (this.dependencies.getBasenameOfPath(manifestPath) === manifestFilename && isUnderLocalFolderPath) {
      try {
        this.dependencies.extensionInstallationStateStore.setInstallingFromMain(manifestPath);
        const absPath = this.dependencies.getDirnameOfPath(manifestPath);

        // this.loadExtensionFromPath updates this.packagesJson
        const extension = await this.loadExtensionFromFolder(absPath);

        if (extension) {
          // Remove a broken symlink left by a previous installation if it exists.
          await this.dependencies.removePath(extension.manifestPath);

          // Install dependencies for the new extension
          await this.dependencies.installExtension(extension.absolutePath);

          this.extensions.set(extension.id, extension);
          this.dependencies.logger.info(`${logModule} Added extension ${extension.manifest.name}`);
          this.events.emit("add", extension);
        }
      } catch (error) {
        this.dependencies.logger.error(`${logModule}: failed to add extension: ${error}`, { error });
      } finally {
        this.dependencies.extensionInstallationStateStore.clearInstallingFromMain(manifestPath);
      }
    }
  };

  /**
   * Handle any unlink event, filtering out non-package.json links so the delete code
   * only happens once per extension.
   * @param filePath The absolute path to either a folder or file in the extensions folder
   */
  handleWatchUnlinkEvent = async (filePath: string): Promise<void> => {
    // Check that the removed path is directly under this.localFolderPath
    // Note that the watcher can create unlink events for subdirectories of the extension
    const extensionFolderName = this.dependencies.getBasenameOfPath(filePath);
    const expectedPath = this.dependencies.getRelativePath(this.localFolderPath, filePath);

    if (expectedPath !== extensionFolderName) {
      return;
    }

    for (const extension of this.extensions.values()) {
      if (extension.absolutePath !== filePath) {
        continue;
      }

      const extensionName = extension.manifest.name;

      // If the extension is deleted manually while the application is running, also remove the symlink
      await this.removeSymlinkByPackageName(extensionName);

      // The path to the manifest file is the lens extension id
      // Note: that we need to use the symlinked path
      const lensExtensionId = extension.manifestPath;

      this.extensions.delete(extension.id);
      this.dependencies.logger.info(`${logModule} removed extension ${extensionName}`);
      this.events.emit("remove", lensExtensionId);

      return;
    }

    this.dependencies.logger.warn(`${logModule} extension ${extensionFolderName} not found, can't remove`);
  };

  /**
   * Remove the symlink under node_modules if exists.
   * If we don't remove the symlink, the uninstall would leave a non-working symlink,
   * which wouldn't be fixed if the extension was reinstalled, causing the extension not to work.
   * @param name e.g. "@mirantis/lens-extension-cc"
   */
  removeSymlinkByPackageName(name: string): Promise<void> {
    return this.dependencies.removePath(this.getInstalledPath(name));
  }

  /**
   * Uninstalls extension.
   * The application will detect the folder unlink and remove the extension from the UI automatically.
   * @param extensionId The ID of the extension to uninstall.
   */
  async uninstallExtension(extensionId: LensExtensionId): Promise<void> {
    const extension = this.extensions.get(extensionId) ?? this.dependencies.extensionLoader.getExtension(extensionId);

    if (!extension) {
      return void this.dependencies.logger.warn(`${logModule} could not uninstall extension, not found`, { id: extensionId });
    }

    const { manifest, absolutePath } = extension;

    this.dependencies.logger.info(`${logModule} Uninstalling ${manifest.name}`);

    await this.removeSymlinkByPackageName(manifest.name);

    // fs.remove does nothing if the path doesn't exist anymore
    await this.dependencies.removePath(absolutePath);
  }

  async load(): Promise<Map<LensExtensionId, InstalledExtension>> {
    if (this.loadStarted) {
      // The class is simplified by only supporting .load() to be called once
      throw new Error("ExtensionDiscovery.load() can be only be called once");
    }

    this.loadStarted = true;

    this.dependencies.logger.info(
      `${logModule} loading extensions from ${this.dependencies.extensionPackageRootDirectory}`,
    );

    await this.dependencies.removePath(this.dependencies.joinPaths(this.dependencies.extensionPackageRootDirectory, "package-lock.json"));

    const canWriteToInTreeFolder = await this.dependencies.accessPath(this.inTreeFolderPath, constants.W_OK);

    if (canWriteToInTreeFolder) {
      // Set bundled folder path to static/extensions
      this.bundledFolderPath = this.inTreeFolderPath;
    } else {
      // Remove e.g. /Users/<username>/Library/Application Support/LensDev/extensions
      await this.dependencies.removePath(this.inTreeTargetPath);

      // Create folder e.g. /Users/<username>/Library/Application Support/LensDev/extensions
      await this.dependencies.ensureDirectory(this.inTreeTargetPath);

      // Copy static/extensions to e.g. /Users/<username>/Library/Application Support/LensDev/extensions
      await this.dependencies.copy(this.inTreeFolderPath, this.inTreeTargetPath);

      // Set bundled folder path to e.g. /Users/<username>/Library/Application Support/LensDev/extensions
      this.bundledFolderPath = this.inTreeTargetPath;
    }

    await this.dependencies.ensureDirectory(this.nodeModulesPath);
    await this.dependencies.ensureDirectory(this.localFolderPath);

    const extensions = await this.ensureExtensions();

    this.isLoaded = true;

    return extensions;
  }

  /**
   * Returns the symlinked path to the extension folder,
   * e.g. "/Users/<username>/Library/Application Support/Lens/node_modules/@publisher/extension"
   */
  protected getInstalledPath(name: string): string {
    return this.dependencies.joinPaths(this.nodeModulesPath, name);
  }

  /**
   * Returns the symlinked path to the package.json,
   * e.g. "/Users/<username>/Library/Application Support/Lens/node_modules/@publisher/extension/package.json"
   */
  protected getInstalledManifestPath(name: string): string {
    return this.dependencies.joinPaths(this.getInstalledPath(name), manifestFilename);
  }

  /**
   * Returns InstalledExtension from path to package.json file.
   * Also updates this.packagesJson.
   */
  protected async getByManifest(manifestPath: string, { isBundled = false } = {}): Promise<InstalledExtension | null> {
    try {
      const manifest = await this.dependencies.readJsonFile(manifestPath) as unknown as LensExtensionManifest;
      const id = this.getInstalledManifestPath(manifest.name);
      const isEnabled = this.dependencies.extensionsStore.isEnabled({ id, isBundled });
      const extensionDir = this.dependencies.getDirnameOfPath(manifestPath);
      const npmPackage = this.dependencies.joinPaths(extensionDir, `${manifest.name}-${manifest.version}.tgz`);
      const absolutePath = this.dependencies.isProduction && await this.dependencies.pathExists(npmPackage)
        ? npmPackage
        : extensionDir;
      const isCompatible = isBundled || this.dependencies.isCompatibleExtension(manifest);

      return {
        id,
        absolutePath,
        manifestPath: id,
        manifest,
        isBundled,
        isEnabled,
        isCompatible,
      };
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOTDIR") {
        // ignore this error, probably from .DS_Store file
        this.dependencies.logger.debug(`${logModule}: failed to load extension manifest through a not-dir-like at ${manifestPath}`);
      } else {
        this.dependencies.logger.error(`${logModule}: can't load extension manifest at ${manifestPath}: ${error}`);
      }

      return null;
    }
  }

  async ensureExtensions(): Promise<Map<LensExtensionId, InstalledExtension>> {
    const bundledExtensions = await this.loadBundledExtensions();
    const userExtensions = await this.loadFromFolder(this.localFolderPath, bundledExtensions.map((extension) => extension.manifest.name));
    const extensions = bundledExtensions.concat(userExtensions);

    await this.installBundledPackages(this.packageJsonPath, extensions);

    return this.extensions = new Map(extensions.map(extension => [extension.id, extension]));
  }

  /**
   * Write package.json to file system and install dependencies.
   */
  installBundledPackages(packageJsonPath: string, extensions: InstalledExtension[]): Promise<void> {
    const dependencies = Object.fromEntries(
      extensions.filter(extension => extension.isBundled).map(extension => [extension.manifest.name, extension.absolutePath]),
    );
    const optionalDependencies = Object.fromEntries(
      extensions.filter(extension => !extension.isBundled).map(extension => [extension.manifest.name, extension.absolutePath]),
    );

    return this.dependencies.installExtensions(packageJsonPath, { dependencies, optionalDependencies });
  }

  async loadBundledExtensions(): Promise<InstalledExtension[]> {
    const extensions: InstalledExtension[] = [];
    const folderPath = this.bundledFolderPath;
    const paths = await this.dependencies.readDirectory(folderPath);

    for (const fileName of paths) {
      const absPath = this.dependencies.joinPaths(folderPath, fileName);
      const extension = await this.loadExtensionFromFolder(absPath, { isBundled: true });

      if (extension) {
        extensions.push(extension);
      }
    }
    this.dependencies.logger.debug(`${logModule}: ${extensions.length} extensions loaded`, { folderPath, extensions });

    return extensions;
  }

  async loadFromFolder(folderPath: string, bundledExtensions: string[]): Promise<InstalledExtension[]> {
    const extensions: InstalledExtension[] = [];
    const paths = await this.dependencies.readDirectory(folderPath);

    for (const fileName of paths) {
      // do not allow to override bundled extensions
      if (bundledExtensions.includes(fileName)) {
        continue;
      }

      const absPath = this.dependencies.joinPaths(folderPath, fileName);

      try {
        const lstat = await this.dependencies.lstat(absPath);

        // skip non-directories
        if (!isDirectoryLike(lstat)) {
          continue;
        }
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") {
          continue;
        }

        throw error;
      }

      const extension = await this.loadExtensionFromFolder(absPath);

      if (extension) {
        extensions.push(extension);
      }
    }

    this.dependencies.logger.debug(`${logModule}: ${extensions.length} extensions loaded`, { folderPath, extensions });

    return extensions;
  }

  /**
   * Loads extension from absolute path, updates this.packagesJson to include it and returns the extension.
   * @param folderPath Folder path to extension
   */
  async loadExtensionFromFolder(folderPath: string, { isBundled = false }: LoadFromFolderOptions = {}): Promise<InstalledExtension | null> {
    const manifestPath = this.dependencies.joinPaths(folderPath, manifestFilename);

    return this.getByManifest(manifestPath, { isBundled });
  }

  toJSON(): ExtensionDiscoveryChannelMessage {
    return toJS({
      isLoaded: this.isLoaded,
    });
  }

  broadcast(): void {
    broadcastMessage(extensionDiscoveryStateChannel, this.toJSON());
  }
}
