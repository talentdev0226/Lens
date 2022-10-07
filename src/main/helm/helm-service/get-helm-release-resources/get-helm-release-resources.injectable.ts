/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import callForHelmManifestInjectable from "./call-for-helm-manifest/call-for-helm-manifest.injectable";
import type { KubeJsonApiData, KubeJsonApiDataList } from "../../../../common/k8s-api/kube-json-api";
import type { AsyncResult } from "../../../../common/utils/async-result";

export type GetHelmReleaseResources = (
  name: string,
  namespace: string,
  kubeconfigPath: string,
) => Promise<AsyncResult<KubeJsonApiData[], string>>;

const getHelmReleaseResourcesInjectable = getInjectable({
  id: "get-helm-release-resources",

  instantiate: (di): GetHelmReleaseResources => {
    const callForHelmManifest = di.inject(callForHelmManifestInjectable);

    return async (name, namespace, kubeconfigPath) => {
      const result = await callForHelmManifest(name, namespace, kubeconfigPath);

      if (!result.callWasSuccessful) {
        return result;
      }

      return {
        callWasSuccessful: true,
        response: result.response.flatMap(item => (
          Array.isArray(item.items)
            ? (item as KubeJsonApiDataList).items
            : item as KubeJsonApiData
        )),
      };
    };
  },
});

export default getHelmReleaseResourcesInjectable;
