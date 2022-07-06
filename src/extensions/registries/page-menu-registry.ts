/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Extensions-api -> Register page menu items
import type { IconProps } from "../../renderer/components/icon";
import type React from "react";
import type { PageTarget } from "./page-registry";
import type { IComputedValue } from "mobx";

export interface ClusterPageMenuRegistration {
  id?: string;
  parentId?: string;
  target?: PageTarget;
  title: React.ReactNode;
  components: ClusterPageMenuComponents;
  visible?: IComputedValue<boolean>;
}

export interface ClusterPageMenuComponents {
  Icon: React.ComponentType<IconProps>;
}
