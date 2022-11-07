/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import periodicalCheckForUpdatesInjectable from "./periodical-check-for-updates.injectable";
import { beforeQuitOfBackEndInjectionToken } from "../../../../../main/start-main-application/runnable-tokens/before-quit-of-back-end-injection-token";

const stopCheckingForUpdatesInjectable = getInjectable({
  id: "stop-checking-for-updates",

  instantiate: (di) => {
    const periodicalCheckForUpdates = di.inject(periodicalCheckForUpdatesInjectable);

    return {
      id: "stop-checking-for-updates",
      run: () => {
        if (periodicalCheckForUpdates.started) {
          periodicalCheckForUpdates.stop();
        }

        return undefined;
      },
    };
  },

  injectionToken: beforeQuitOfBackEndInjectionToken,
});

export default stopCheckingForUpdatesInjectable;
