/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { FileSystemProvisionerStore } from "./file-system-provisioner-store";
import directoryForExtensionDataInjectable from "./directory-for-extension-data/directory-for-extension-data.injectable";

const fileSystemProvisionerStoreInjectable = getInjectable({
  id: "file-system-provisioner-store",

  instantiate: (di) =>
    FileSystemProvisionerStore.createInstance({
      directoryForExtensionData: di.inject(
        directoryForExtensionDataInjectable,
      ),
    }),
});

export default fileSystemProvisionerStoreInjectable;
