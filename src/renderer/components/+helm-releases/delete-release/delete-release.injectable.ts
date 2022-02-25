/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import {
  deleteRelease,
  HelmRelease,
} from "../../../../common/k8s-api/endpoints/helm-releases.api";
import releasesInjectable from "../releases.injectable";

const deleteReleaseInjectable = getInjectable({
  id: "delete-release",

  instantiate: (di) => {
    const releases = di.inject(releasesInjectable);

    return async (release: HelmRelease) => {
      await deleteRelease(release.getName(), release.getNs());

      releases.invalidate();
    };
  },
});

export default deleteReleaseInjectable;
