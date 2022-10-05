/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverride } from "../test-utils/get-global-override";
import removePathInjectable from "./remove-path.injectable";

export default getGlobalOverride(removePathInjectable, () => async () => {
  throw new Error("tried to remove a path without override");
});
