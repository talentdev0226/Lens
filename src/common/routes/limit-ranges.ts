/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { RouteProps } from "react-router";
import { buildURL } from "../utils/buildUrl";

export const limitRangesRoute: RouteProps = {
  path: "/limitranges",
};

export interface LimitRangeRouteParams {
}

export const limitRangeURL = buildURL<LimitRangeRouteParams>(limitRangesRoute.path);
