/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import assert from "assert";
import { storesAndApisCanBeCreatedInjectionToken } from "../../../../common/k8s-api/stores-apis-can-be-created.token";
import clusterRoleBindingApiInjectable from "../../../../common/k8s-api/endpoints/cluster-role-binding.api.injectable";
import { kubeObjectStoreInjectionToken } from "../../../../common/k8s-api/api-manager/manager.injectable";
import { ClusterRoleBindingStore } from "./store";

const clusterRoleBindingStoreInjectable = getInjectable({
  id: "cluster-role-binding-store",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectionToken), "clusterRoleBindingStore is only accessible in certain environments");

    const api = di.inject(clusterRoleBindingApiInjectable);

    return new ClusterRoleBindingStore(api);
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default clusterRoleBindingStoreInjectable;
