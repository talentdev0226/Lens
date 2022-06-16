/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import isAllowedResourceInjectable from "../../../../../utils/is-allowed-resource.injectable";
import { frontEndRouteInjectionToken } from "../../../../front-end-route-injection-token";

const rolesRouteInjectable = getInjectable({
  id: "roles-route",

  instantiate: (di) => {
    const isAllowedResource = di.inject(isAllowedResourceInjectable, "roles");

    return {
      path: "/roles",
      clusterFrame: true,
      isEnabled: isAllowedResource,
    };
  },

  injectionToken: frontEndRouteInjectionToken,
});

export default rolesRouteInjectable;
