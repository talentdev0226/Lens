/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import upgradeChartTabStoreInjectable from "./store.injectable";
import dockStoreInjectable from "../dock/store.injectable";
import type { HelmRelease } from "../../../../common/k8s-api/endpoints/helm-releases.api";
import { DockStore, DockTabCreateSpecific, TabId, TabKind } from "../dock/store";
import type { UpgradeChartTabStore } from "./store";
import { runInAction } from "mobx";

interface Dependencies {
  upgradeChartStore: UpgradeChartTabStore;
  dockStore: DockStore
}

const createUpgradeChartTab = ({ upgradeChartStore, dockStore }: Dependencies) => (release: HelmRelease, tabParams: DockTabCreateSpecific = {}): TabId => {
  const tabId = upgradeChartStore.getTabIdByRelease(release.getName());

  if (tabId) {
    dockStore.open();
    dockStore.selectTab(tabId);

    return tabId;
  }

  return runInAction(() => {
    const tab = dockStore.createTab(
      {
        title: `Helm Upgrade: ${release.getName()}`,
        ...tabParams,
        kind: TabKind.UPGRADE_CHART,
      },
      false,
    );

    upgradeChartStore.setData(tab.id, {
      releaseName: release.getName(),
      releaseNamespace: release.getNs(),
    });

    return tab.id;
  });
};

const createUpgradeChartTabInjectable = getInjectable({
  instantiate: (di) => createUpgradeChartTab({
    upgradeChartStore: di.inject(upgradeChartTabStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
  }),

  lifecycle: lifecycleEnum.singleton,
});

export default createUpgradeChartTabInjectable;
