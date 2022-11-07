/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectionToken } from "@ogre-tools/injectable";
import type { RunnableSync } from "../../../common/runnable/run-many-sync-for";

export const beforeQuitOfFrontEndInjectionToken = getInjectionToken<RunnableSync>({
  id: "before-quit-of-front-end",
});
