/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { action, autorun, makeObservable } from "mobx";
import { DockStore, TabId, TabKind } from "../dock-store/dock.store";
import { DockTabStorageState, DockTabStore } from "../dock-tab-store/dock-tab.store";
import { getChartDetails, getChartValues } from "../../../../common/k8s-api/endpoints/helm-charts.api";
import type { IReleaseUpdateDetails } from "../../../../common/k8s-api/endpoints/helm-releases.api";
import { Notifications } from "../../notifications";
import type { StorageHelper } from "../../../utils";

export interface IChartInstallData {
  name: string;
  repo: string;
  version: string;
  values?: string;
  releaseName?: string;
  description?: string;
  namespace?: string;
  lastVersion?: boolean;
}

interface Dependencies {
  dockStore: DockStore,
  createStorage: <T>(storageKey: string, options: DockTabStorageState<T>) => StorageHelper<DockTabStorageState<T>>

  versionsStore: DockTabStore<string[]>,
  detailsStore: DockTabStore<IReleaseUpdateDetails>
}

export class InstallChartStore extends DockTabStore<IChartInstallData> {
  constructor(protected dependencies: Dependencies) {
    super(
      dependencies,
      { storageKey: "install_charts" },
    );
    
    makeObservable(this);
    autorun(() => {
      const { selectedTab, isOpen } = dependencies.dockStore;

      if (selectedTab?.kind === TabKind.INSTALL_CHART && isOpen) {
        this.loadData(selectedTab.id)
          .catch(err => Notifications.error(String(err)));
      }
    }, { delay: 250 });
  }

  get versions() {
    return this.dependencies.versionsStore;
  }

  get details() {
    return this.dependencies.detailsStore;
  }

  @action
  async loadData(tabId: string) {
    const promises = [];

    if (!this.getData(tabId).values) {
      promises.push(this.loadValues(tabId));
    }

    if (!this.versions.getData(tabId)) {
      promises.push(this.loadVersions(tabId));
    }

    await Promise.all(promises);
  }

  @action
  async loadVersions(tabId: TabId) {
    const { repo, name, version } = this.getData(tabId);

    this.versions.clearData(tabId); // reset
    const charts = await getChartDetails(repo, name, { version });
    const versions = charts.versions.map(chartVersion => chartVersion.version);

    this.versions.setData(tabId, versions);
  }

  @action
  async loadValues(tabId: TabId, attempt = 0): Promise<void> {
    const data = this.getData(tabId);
    const { repo, name, version } = data;
    const values = await getChartValues(repo, name, version);

    if (values) {
      this.setData(tabId, { ...data, values });
    } else if (attempt < 4) {
      return this.loadValues(tabId, attempt + 1);
    }
  }

  setData(tabId: TabId, data: IChartInstallData){
    super.setData(tabId, data);
  }
}
