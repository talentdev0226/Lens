/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { frontEndRouteInjectionToken } from "../../../front-end-route-injection-token";

const telemetryPreferencesRouteInjectable = getInjectable({
  id: "telemetry-preferences-route",

  instantiate: () => ({
    path: "/preferences/telemetry",
    clusterFrame: false,
    isEnabled: computed(() => true),
  }),

  injectionToken: frontEndRouteInjectionToken,
});

export default telemetryPreferencesRouteInjectable;
