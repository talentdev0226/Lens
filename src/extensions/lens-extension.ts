/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { InstalledExtension } from "./extension-discovery/extension-discovery";
import { action, computed, makeObservable, observable } from "mobx";
import logger from "../main/logger";
import type { ProtocolHandlerRegistration } from "./registries";
import type { PackageJson } from "type-fest";
import type { Disposer } from "../common/utils";
import { disposer } from "../common/utils";
import type { LensExtensionDependencies } from "./lens-extension-set-dependencies";

export type LensExtensionId = string; // path to manifest (package.json)
export type LensExtensionConstructor = new (...args: ConstructorParameters<typeof LensExtension>) => LensExtension;

export interface LensExtensionManifest extends PackageJson {
  name: string;
  version: string;
  main?: string; // path to %ext/dist/main.js
  renderer?: string; // path to %ext/dist/renderer.js
  /**
   * Supported Lens version engine by extension could be defined in `manifest.engines.lens`
   * Only MAJOR.MINOR version is taken in consideration.
   */
  engines: {
    lens: string; // "semver"-package format
    npm?: string;
    node?: string;
  };
}

export const lensExtensionDependencies = Symbol("lens-extension-dependencies");
export const Disposers = Symbol("disposers");

export class LensExtension<Dependencies extends LensExtensionDependencies = LensExtensionDependencies> {
  readonly id: LensExtensionId;
  readonly manifest: LensExtensionManifest;
  readonly manifestPath: string;
  readonly isBundled: boolean;

  get sanitizedExtensionId() {
    return sanitizeExtensionName(this.name);
  }

  protocolHandlers: ProtocolHandlerRegistration[] = [];

  @observable private _isEnabled = false;

  @computed get isEnabled() {
    return this._isEnabled;
  }

  [Disposers] = disposer();

  constructor({ id, manifest, manifestPath, isBundled }: InstalledExtension) {
    makeObservable(this);
    this.id = id;
    this.manifest = manifest;
    this.manifestPath = manifestPath;
    this.isBundled = !!isBundled;
  }

  get name() {
    return this.manifest.name;
  }

  get version() {
    return this.manifest.version;
  }

  get description() {
    return this.manifest.description;
  }

  readonly [lensExtensionDependencies]!: Dependencies;

  /**
   * getExtensionFileFolder returns the path to an already created folder. This
   * folder is for the sole use of this extension.
   *
   * Note: there is no security done on this folder, only obfuscation of the
   * folder name.
   */
  async getExtensionFileFolder(): Promise<string> {
    return this[lensExtensionDependencies].fileSystemProvisionerStore.requestDirectory(this.id);
  }

  @action
  async enable(register: (ext: this) => Promise<Disposer[]>) {
    if (this._isEnabled) {
      return;
    }

    try {
      this._isEnabled = true;

      this[Disposers].push(...await register(this));
      logger.info(`[EXTENSION]: enabled ${this.name}@${this.version}`);

    } catch (error) {
      logger.error(`[EXTENSION]: failed to activate ${this.name}@${this.version}: ${error}`);
    }
  }

  @action
  async disable() {
    if (!this._isEnabled) {
      return;
    }

    this._isEnabled = false;

    try {
      await this.onDeactivate();
      this[Disposers]();
      logger.info(`[EXTENSION]: disabled ${this.name}@${this.version}`);
    } catch (error) {
      logger.error(`[EXTENSION]: disabling ${this.name}@${this.version} threw an error: ${error}`);
    }
  }

  async activate(): Promise<void> {
    return this.onActivate();
  }

  protected onActivate(): Promise<void> | void {
    return;
  }

  protected onDeactivate(): Promise<void> | void {
    return;
  }
}

export function sanitizeExtensionName(name: string) {
  return name.replace("@", "").replace("/", "--");
}

export function getSanitizedPath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
} // normalize multi-slashes (e.g. coming from page.id)

export function extensionDisplayName(name: string, version: string) {
  return `${name}@${version}`;
}
