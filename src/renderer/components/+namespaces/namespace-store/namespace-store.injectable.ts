/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { NamespaceStore } from "./namespace.store";
import apiManagerInjectable from "../../kube-object-menu/dependencies/api-manager.injectable";
import createStorageInjectable from "../../../utils/create-storage/create-storage.injectable";

const namespaceStoreInjectable = getInjectable({
  instantiate: (di) => {
    const createStorage = di.inject(createStorageInjectable);

    const storage = createStorage<string[] | undefined>(
      "selected_namespaces",
      undefined,
    );

    const namespaceStore = new NamespaceStore({
      storage,
    });

    const apiManager = di.inject(apiManagerInjectable);

    apiManager.registerStore(namespaceStore);

    return namespaceStore;
  },

  lifecycle: lifecycleEnum.singleton,
});

export default namespaceStoreInjectable;
