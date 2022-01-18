/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import { autoBind } from "../../utils";
import { PersistentVolume, persistentVolumeApi } from "../../../common/k8s-api/endpoints/persistent-volume.api";
import { apiManager } from "../../../common/k8s-api/api-manager";
import type { StorageClass } from "../../../common/k8s-api/endpoints/storage-class.api";

export class PersistentVolumesStore extends KubeObjectStore<PersistentVolume> {
  api = persistentVolumeApi;

  constructor() {
    super();
    autoBind(this);
  }

  getByStorageClass(storageClass: StorageClass): PersistentVolume[] {
    return this.items.filter(volume =>
      volume.getStorageClassName() === storageClass.getName(),
    );
  }
}

export const volumesStore = new PersistentVolumesStore();
apiManager.registerStore(volumesStore);
