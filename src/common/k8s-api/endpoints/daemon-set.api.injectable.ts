/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import assert from "assert";
import { storesAndApisCanBeCreatedInjectionToken } from "../stores-apis-can-be-created.token";
import { DaemonSetApi } from "./daemon-set.api";

const daemonSetApiInjectable = getInjectable({
  id: "daemon-set-api",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectionToken), "daemonSetApi is only available in certain environements");

    return new DaemonSetApi();
  },
});

export default daemonSetApiInjectable;
