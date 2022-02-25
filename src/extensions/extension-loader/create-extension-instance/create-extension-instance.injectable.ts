/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { createExtensionInstance } from "./create-extension-instance";
import fileSystemProvisionerStoreInjectable from "./file-system-provisioner-store/file-system-provisioner-store.injectable";

const createExtensionInstanceInjectable = getInjectable({
  id: "create-extension-instance",

  instantiate: (di) => createExtensionInstance({
    fileSystemProvisionerStore: di.inject(fileSystemProvisionerStoreInjectable),
  }),
});

export default createExtensionInstanceInjectable;
