/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { LabelSelector, NamespaceScopedMetadata } from "../kube-object";
import { KubeObject } from "../kube-object";
import type { DerivedKubeApiOptions } from "../kube-api";
import { KubeApi } from "../kube-api";

export interface PodDisruptionBudgetSpec {
  minAvailable: string;
  maxUnavailable: string;
  selector: LabelSelector;
}

export interface PodDisruptionBudgetStatus {
  currentHealthy: number;
  desiredHealthy: number;
  disruptionsAllowed: number;
  expectedPods: number;
}

export class PodDisruptionBudget extends KubeObject<
  NamespaceScopedMetadata,
  PodDisruptionBudgetStatus,
  PodDisruptionBudgetSpec
> {
  static readonly kind = "PodDisruptionBudget";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/policy/v1beta1/poddisruptionbudgets";

  getSelectors() {
    return KubeObject.stringifyLabels(this.spec.selector.matchLabels);
  }

  getMinAvailable() {
    return this.spec.minAvailable || "N/A";
  }

  getMaxUnavailable() {
    return this.spec.maxUnavailable || "N/A";
  }

  getCurrentHealthy() {
    return this.status?.currentHealthy ?? 0;
  }

  getDesiredHealthy() {
    return this.status?.desiredHealthy ?? 0;
  }
}

export class PodDisruptionBudgetApi extends KubeApi<PodDisruptionBudget> {
  constructor(opts: DerivedKubeApiOptions = {}) {
    super({
      objectConstructor: PodDisruptionBudget,
      ...opts,
    });
  }
}
