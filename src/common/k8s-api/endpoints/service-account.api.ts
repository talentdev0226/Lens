/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { KubeObjectMetadata, KubeObjectScope, LocalObjectReference, NamespaceScopedMetadata, ObjectReference } from "../kube-object";
import { KubeObject } from "../kube-object";
import type { DerivedKubeApiOptions } from "../kube-api";
import { KubeApi } from "../kube-api";
import type { KubeJsonApiData } from "../kube-json-api";

export interface ServiceAccountData extends KubeJsonApiData<KubeObjectMetadata<KubeObjectScope.Namespace>, void, void> {
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: LocalObjectReference[];
  secrets?: ObjectReference[];
}

export class ServiceAccount extends KubeObject<
  NamespaceScopedMetadata,
  void,
  void
> {
  static readonly kind = "ServiceAccount";
  static readonly namespaced = true;
  static readonly apiBase = "/api/v1/serviceaccounts";

  automountServiceAccountToken?: boolean;
  imagePullSecrets?: LocalObjectReference[];
  secrets?: ObjectReference[];

  constructor({
    automountServiceAccountToken,
    imagePullSecrets,
    secrets,
    ...rest
  }: ServiceAccountData) {
    super(rest);
    this.automountServiceAccountToken = automountServiceAccountToken;
    this.imagePullSecrets = imagePullSecrets;
    this.secrets = secrets;
  }

  getSecrets() {
    return this.secrets || [];
  }

  getImagePullSecrets() {
    return this.imagePullSecrets || [];
  }
}

export class ServiceAccountApi extends KubeApi<ServiceAccount, ServiceAccountData> {
  constructor(opts: DerivedKubeApiOptions = {}) {
    super({
      ...opts,
      objectConstructor: ServiceAccount,
    });
  }
}
