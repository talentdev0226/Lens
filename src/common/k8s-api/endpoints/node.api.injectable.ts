/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import assert from "assert";
import { storesAndApisCanBeCreatedInjectionToken } from "../stores-apis-can-be-created.token";
import { NodeApi } from "./node.api";

const nodeApiInjectable = getInjectable({
  id: "node-api",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectionToken), "nodeApi is only available in certain environments");

    return new NodeApi();
  },
});

export default nodeApiInjectable;
