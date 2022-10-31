/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { afterApplicationIsLoadedInjectionToken } from "../../../main/start-main-application/runnable-tokens/after-application-is-loaded-injection-token";
import emitAppEventInjectable from "../../../common/app-event-bus/emit-event.injectable";
import { getCurrentDateTime } from "../../../common/utils/date/get-current-date-time";
import buildVersionInjectable from "../../../main/vars/build-version/build-version.injectable";

const emitCurrentVersionToAnalyticsInjectable = getInjectable({
  id: "emit-current-version-to-analytics",

  instantiate: (di) => {
    const emitAppEvent = di.inject(emitAppEventInjectable);
    const buildVersion = di.inject(buildVersionInjectable);

    return {
      id: "emit-current-version-to-analytics",
      run: () => {
        emitAppEvent({
          name: "app",
          action: "current-version",

          params: {
            version: buildVersion.get(),
            currentDateTime: getCurrentDateTime(),
          },
        });
      },
    };
  },

  injectionToken: afterApplicationIsLoadedInjectionToken,
});

export default emitCurrentVersionToAnalyticsInjectable;
