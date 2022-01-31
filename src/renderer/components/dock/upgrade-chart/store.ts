/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, computed, makeObservable } from "mobx";
import type { TabId } from "../dock/store";
import { DockTabStorageState, DockTabStore } from "../dock-tab-store/dock-tab.store";
import { getReleaseValues } from "../../../../common/k8s-api/endpoints/helm-releases.api";
import type { StorageHelper } from "../../../utils";

export interface IChartUpgradeData {
  releaseName: string;
  releaseNamespace: string;
}

interface Dependencies {
  valuesStore: DockTabStore<string>;
  createStorage: <T>(storageKey: string, options: DockTabStorageState<T>) => StorageHelper<DockTabStorageState<T>>;
}

export class UpgradeChartTabStore extends DockTabStore<IChartUpgradeData> {
  @computed private get releaseNameReverseLookup(): Map<string, string> {
    return new Map(this.getAllData().map(([id, { releaseName }]) => [releaseName, id]));
  }

  get values() {
    return this.dependencies.valuesStore;
  }

  constructor(protected dependencies : Dependencies) {
    super(dependencies, {
      storageKey: "chart_releases",
    });

    makeObservable(this);
  }

  @action
  async reloadValues(tabId: TabId) {
    this.values.clearData(tabId); // reset
    const { releaseName, releaseNamespace } = this.getData(tabId);
    const values = await getReleaseValues(releaseName, releaseNamespace, true);

    this.values.setData(tabId, values);
  }

  getTabIdByRelease(releaseName: string): TabId {
    return this.releaseNameReverseLookup.get(releaseName);
  }
}
