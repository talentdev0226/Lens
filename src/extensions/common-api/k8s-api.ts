/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// NOTE: this file is not currently exported as part of `Common`, but should be.
//       It is here to consolidate the common parts which are exported to `Main`
//       and to `Renderer`

export { ResourceStack } from "../../common/k8s/resource-stack";
import apiManagerInjectable from "../../common/k8s-api/api-manager/manager.injectable";
import { asLegacyGlobalForExtensionApi } from "../as-legacy-globals-for-extension-api/as-legacy-global-object-for-extension-api";

export const apiManager = asLegacyGlobalForExtensionApi(apiManagerInjectable);

export {
  KubeApi,
  forCluster,
  forRemoteCluster,
  type ILocalKubeApiConfig,
  type IRemoteKubeApiConfig,
  type IKubeApiCluster,
} from "../../common/k8s-api/kube-api";

export {
  KubeObject,
  KubeStatus,
  type OwnerReference,
  type KubeObjectMetadata,
  type NamespaceScopedMetadata,
  type ClusterScopedMetadata,
  type BaseKubeJsonApiObjectMetadata,
  type KubeJsonApiObjectMetadata,
  type KubeStatusData,
} from "../../common/k8s-api/kube-object";

export {
  type KubeJsonApiData,
} from "../../common/k8s-api/kube-json-api";

export {
  KubeObjectStore,
  type JsonPatch,
  type KubeObjectStoreLoadAllParams,
  type KubeObjectStoreLoadingParams,
  type KubeObjectStoreSubscribeParams,
} from "../../common/k8s-api/kube-object.store";

export {
  type PodContainer as IPodContainer,
  type PodContainerStatus as IPodContainerStatus,
  Pod,
  PodApi as PodsApi,
  Node,
  NodeApi as NodesApi,
  Deployment,
  DeploymentApi,
  DaemonSet,
  StatefulSet,
  Job,
  CronJob,
  ConfigMap,
  type SecretReference as ISecretRef,
  Secret,
  ReplicaSet,
  ResourceQuota,
  LimitRange,
  HorizontalPodAutoscaler,
  PodDisruptionBudget,
  PriorityClass,
  Service,
  Endpoints as Endpoint,
  Ingress, IngressApi,
  NetworkPolicy,
  PersistentVolume,
  PersistentVolumeClaim,
  PersistentVolumeClaimApi as PersistentVolumeClaimsApi,
  StorageClass,
  Namespace,
  KubeEvent,
  ServiceAccount,
  Role,
  RoleBinding,
  ClusterRole,
  ClusterRoleBinding,
  CustomResourceDefinition,
} from "../../common/k8s-api/endpoints";
