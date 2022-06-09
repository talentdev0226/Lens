/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { MetricData, IMetricsReqParams } from "./metrics.api";
import { metricsApi } from "./metrics.api";
import { KubeObject } from "../kube-object";
import type { DerivedKubeApiOptions, IgnoredKubeApiOptions } from "../kube-api";
import { KubeApi } from "../kube-api";

export class ClusterApi extends KubeApi<Cluster> {
  /**
   * @deprecated This field is legacy and never used.
   */
  static kind = "Cluster";

  /**
   * @deprecated This field is legacy and never used.
   */
  static namespaced = true;

  constructor(opts: DerivedKubeApiOptions & IgnoredKubeApiOptions = {}) {
    super({
      ...opts,
      objectConstructor: Cluster,
    });
  }
}

export function getMetricsByNodeNames(nodeNames: string[], params?: IMetricsReqParams): Promise<ClusterMetricData> {
  const nodes = nodeNames.join("|");
  const opts = { category: "cluster", nodes };

  return metricsApi.getMetrics({
    memoryUsage: opts,
    workloadMemoryUsage: opts,
    memoryRequests: opts,
    memoryLimits: opts,
    memoryCapacity: opts,
    memoryAllocatableCapacity: opts,
    cpuUsage: opts,
    cpuRequests: opts,
    cpuLimits: opts,
    cpuCapacity: opts,
    cpuAllocatableCapacity: opts,
    podUsage: opts,
    podCapacity: opts,
    podAllocatableCapacity: opts,
    fsSize: opts,
    fsUsage: opts,
  }, params);
}

export enum ClusterStatus {
  ACTIVE = "Active",
  CREATING = "Creating",
  REMOVING = "Removing",
  ERROR = "Error",
}

export interface ClusterMetricData extends Partial<Record<string, MetricData>> {
  memoryUsage: MetricData;
  memoryRequests: MetricData;
  memoryLimits: MetricData;
  memoryCapacity: MetricData;
  cpuUsage: MetricData;
  cpuRequests: MetricData;
  cpuLimits: MetricData;
  cpuCapacity: MetricData;
  podUsage: MetricData;
  podCapacity: MetricData;
  fsSize: MetricData;
  fsUsage: MetricData;
}

export interface Cluster {
  spec: {
    clusterNetwork?: {
      serviceDomain?: string;
      pods?: {
        cidrBlocks?: string[];
      };
      services?: {
        cidrBlocks?: string[];
      };
    };
    providerSpec: {
      value: {
        profile: string;
      };
    };
  };
  status?: {
    apiEndpoints: {
      host: string;
      port: string;
    }[];
    providerStatus: {
      adminUser?: string;
      adminPassword?: string;
      kubeconfig?: string;
      processState?: string;
      lensAddress?: string;
    };
    errorMessage?: string;
    errorReason?: string;
  };
}

export class Cluster extends KubeObject {
  static kind = "Cluster";
  static apiBase = "/apis/cluster.k8s.io/v1alpha1/clusters";
  static namespaced = true;

  getStatus() {
    if (this.metadata.deletionTimestamp) return ClusterStatus.REMOVING;
    if (!this.status || !this.status) return ClusterStatus.CREATING;
    if (this.status.errorMessage) return ClusterStatus.ERROR;

    return ClusterStatus.ACTIVE;
  }
}
