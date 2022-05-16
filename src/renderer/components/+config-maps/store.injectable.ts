/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import assert from "assert";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/manager.injectable";
import configMapApiInjectable from "../../../common/k8s-api/endpoints/config-map.api.injectable";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import { ConfigMapStore } from "./store";

const configMapStoreInjectable = getInjectable({
  id: "config-map-store",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectable), "configMapStore is only available in certain environments");

    const api = di.inject(configMapApiInjectable);

    return new ConfigMapStore(api);
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default configMapStoreInjectable;
