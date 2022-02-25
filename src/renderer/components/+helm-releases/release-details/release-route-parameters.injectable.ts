/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { matchPath } from "react-router";
import observableHistoryInjectable from "../../../navigation/observable-history.injectable";
import { releaseRoute, ReleaseRouteParams } from "../../../../common/routes";

const releaseRouteParametersInjectable = getInjectable({
  id: "release-route-parameters",

  instantiate: (di) => {
    const observableHistory = di.inject(observableHistoryInjectable);

    return computed(() => {
      const releasePathParameters = matchPath<ReleaseRouteParams>(observableHistory.location.pathname, {
        path: releaseRoute.path,
      });

      if (!releasePathParameters) {
        return {};
      }

      return releasePathParameters.params;
    });
  },
});

export default releaseRouteParametersInjectable;
