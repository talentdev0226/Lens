/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";
import { autoBind, cpuUnitsToNumber, iter, unitsToBytes } from "../../../renderer/utils";
import { IMetrics, metricsApi } from "./metrics.api";
import { KubeApi } from "../kube-api";
import type { KubeJsonApiData } from "../kube-json-api";
import { isClusterPageContext } from "../../utils/cluster-id-url-parsing";

export class NodesApi extends KubeApi<Node> {
}

export function getMetricsForAllNodes(): Promise<INodeMetrics> {
  const opts = { category: "nodes" };

  return metricsApi.getMetrics({
    memoryUsage: opts,
    workloadMemoryUsage: opts,
    memoryCapacity: opts,
    memoryAllocatableCapacity: opts,
    cpuUsage: opts,
    cpuCapacity: opts,
    fsSize: opts,
    fsUsage: opts,
  });
}

export interface INodeMetrics<T = IMetrics> {
  [metric: string]: T;
  memoryUsage: T;
  workloadMemoryUsage: T;
  memoryCapacity: T;
  memoryAllocatableCapacity: T;
  cpuUsage: T;
  cpuCapacity: T;
  fsUsage: T;
  fsSize: T;
}

export interface NodeTaint {
  key: string;
  value?: string;
  effect: string;
  timeAdded: string;
}

export function formatNodeTaint(taint: NodeTaint): string {
  if (taint.value) {
    return `${taint.key}=${taint.value}:${taint.effect}`;
  }

  return `${taint.key}:${taint.effect}`;
}

export interface NodeCondition {
  type: string;
  status: string;
  lastHeartbeatTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface Node {
  spec: {
    podCIDR?: string;
    podCIDRs?: string[];
    providerID?: string;
    /**
     * @deprecated see https://issues.k8s.io/61966
     */
    externalID?: string;
    taints?: NodeTaint[];
    unschedulable?: boolean;
  };
  status: {
    capacity?: {
      cpu: string;
      "ephemeral-storage": string;
      "hugepages-1Gi": string;
      "hugepages-2Mi": string;
      memory: string;
      pods: string;
    };
    allocatable?: {
      cpu: string;
      "ephemeral-storage": string;
      "hugepages-1Gi": string;
      "hugepages-2Mi": string;
      memory: string;
      pods: string;
    };
    conditions?: NodeCondition[];
    addresses?: {
      type: string;
      address: string;
    }[];
    daemonEndpoints?: {
      kubeletEndpoint: {
        Port: number; //it must be uppercase for backwards compatibility
      }
    }
    nodeInfo?: {
      machineID: string;
      systemUUID: string;
      bootID: string;
      kernelVersion: string;
      osImage: string;
      containerRuntimeVersion: string;
      kubeletVersion: string;
      kubeProxyVersion: string;
      operatingSystem: string;
      architecture: string;
    };
    images?: {
      names: string[];
      sizeBytes?: number;
    }[];
    volumesInUse?: string[];
    volumesAttached?: {
      name: string;
      devicePath: string;
    }[];
  };
}

/**
 * Iterate over `conditions` yielding the `type` field if the `status` field is
 * the string `"True"`
 * @param conditions An iterator of some conditions
 */
function* getTrueConditionTypes(conditions: IterableIterator<NodeCondition> | Iterable<NodeCondition>): IterableIterator<string> {
  for (const { status, type } of conditions) {
    if (status === "True") {
      yield type;
    }
  }
}

export class Node extends KubeObject {
  static kind = "Node";
  static namespaced = false;
  static apiBase = "/api/v1/nodes";

  constructor(data: KubeJsonApiData) {
    super(data);
    autoBind(this);
  }

  /**
   * Returns the concatination of all current condition types which have a status
   * of `"True"`
   */
  getNodeConditionText(): string {
    return iter.join(
      getTrueConditionTypes(this.status?.conditions ?? []),
      " ",
    );
  }

  getTaints() {
    return this.spec.taints || [];
  }

  getRoleLabels() {
    if (!this.metadata?.labels || typeof this.metadata.labels !== "object") {
      return "";
    }

    const roleLabels = Object.keys(this.metadata.labels)
      .filter(key => key.includes("node-role.kubernetes.io"))
      .map(key => key.match(/([^/]+$)/)[0]); // all after last slash

    if (this.metadata.labels["kubernetes.io/role"] != undefined) {
      roleLabels.push(this.metadata.labels["kubernetes.io/role"]);
    }

    return roleLabels.join(", ");
  }

  getCpuCapacity() {
    if (!this.status.capacity || !this.status.capacity.cpu) return 0;

    return cpuUnitsToNumber(this.status.capacity.cpu);
  }

  getMemoryCapacity() {
    if (!this.status.capacity || !this.status.capacity.memory) return 0;

    return unitsToBytes(this.status.capacity.memory);
  }

  getConditions() {
    const conditions = this.status.conditions || [];

    if (this.isUnschedulable()) {
      return [{ type: "SchedulingDisabled", status: "True" }, ...conditions];
    }

    return conditions;
  }

  getActiveConditions() {
    return this.getConditions().filter(c => c.status === "True");
  }

  getWarningConditions() {
    const goodConditions = ["Ready", "HostUpgrades", "SchedulingDisabled"];

    return this.getActiveConditions().filter(condition => {
      return !goodConditions.includes(condition.type);
    });
  }

  getKubeletVersion() {
    return this.status.nodeInfo.kubeletVersion;
  }

  getOperatingSystem(): string {
    return this.metadata?.labels?.["kubernetes.io/os"]
      || this.metadata?.labels?.["beta.kubernetes.io/os"]
      || this.status?.nodeInfo?.operatingSystem
      || "linux";
  }

  isUnschedulable() {
    return this.spec.unschedulable;
  }
}

let nodesApi: NodesApi;

if (isClusterPageContext()) {
  nodesApi = new NodesApi({
    objectConstructor: Node,
  });
}

export {
  nodesApi,
};
