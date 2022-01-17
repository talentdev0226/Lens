/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import extensionLoaderInjectable from "../../../../extensions/extension-loader/extension-loader.injectable";
import uninstallExtensionInjectable from "../uninstall-extension/uninstall-extension.injectable";
import { attemptInstall } from "./attempt-install";
import unpackExtensionInjectable from "./unpack-extension/unpack-extension.injectable";
import getExtensionDestFolderInjectable
  from "./get-extension-dest-folder/get-extension-dest-folder.injectable";
import createTempFilesAndValidateInjectable from "./create-temp-files-and-validate/create-temp-files-and-validate.injectable";
import extensionInstallationStateStoreInjectable
  from "../../../../extensions/extension-installation-state-store/extension-installation-state-store.injectable";

const attemptInstallInjectable = getInjectable({
  instantiate: (di) =>
    attemptInstall({
      extensionLoader: di.inject(extensionLoaderInjectable),
      uninstallExtension: di.inject(uninstallExtensionInjectable),
      unpackExtension: di.inject(unpackExtensionInjectable),
      createTempFilesAndValidate: di.inject(createTempFilesAndValidateInjectable),
      getExtensionDestFolder: di.inject(getExtensionDestFolderInjectable),
      extensionInstallationStateStore: di.inject(extensionInstallationStateStoreInjectable),
    }),

  lifecycle: lifecycleEnum.singleton,
});

export default attemptInstallInjectable;
