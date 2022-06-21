/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import styles from "./cluster-overview.module.scss";

import React from "react";
import { reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import type { NodeStore } from "../+nodes/store";
import type { PodStore } from "../+workloads-pods/store";
import { interval } from "../../utils";
import { TabLayout } from "../layout/tab-layout";
import { Spinner } from "../spinner";
import { ClusterIssues } from "./cluster-issues";
import { ClusterMetrics } from "./cluster-metrics";
import type { ClusterOverviewStore } from "./cluster-overview-store/cluster-overview-store";
import { ClusterPieCharts } from "./cluster-pie-charts";
import { ClusterMetricsResourceType } from "../../../common/cluster-types";
import type { EventStore } from "../+events/store";
import { withInjectables } from "@ogre-tools/injectable-react";
import clusterOverviewStoreInjectable from "./cluster-overview-store/cluster-overview-store.injectable";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { Cluster } from "../../../common/cluster/cluster";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import assert from "assert";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import podStoreInjectable from "../+workloads-pods/store.injectable";
import eventStoreInjectable from "../+events/store.injectable";
import nodeStoreInjectable from "../+nodes/store.injectable";

interface Dependencies {
  subscribeStores: SubscribeStores;
  clusterOverviewStore: ClusterOverviewStore;
  hostedCluster: Cluster;
  podStore: PodStore;
  eventStore: EventStore;
  nodeStore: NodeStore;
}

@observer
class NonInjectedClusterOverview extends React.Component<Dependencies> {
  private metricPoller = interval(60, () => this.loadMetrics());

  loadMetrics() {
    if (this.props.hostedCluster.available) {
      this.props.clusterOverviewStore.loadMetrics();
    }
  }

  componentDidMount() {
    this.metricPoller.start(true);

    disposeOnUnmount(this, [
      this.props.subscribeStores([
        this.props.podStore,
        this.props.eventStore,
        this.props.nodeStore,
      ]),

      reaction(
        () => this.props.clusterOverviewStore.metricNodeRole, // Toggle Master/Worker node switcher
        () => this.metricPoller.restart(true),
      ),
    ]);
  }

  componentWillUnmount() {
    this.metricPoller.stop();
  }

  renderMetrics(isMetricsHidden: boolean) {
    if (isMetricsHidden) {
      return null;
    }

    return (
      <>
        <ClusterMetrics/>
        <ClusterPieCharts/>
      </>
    );
  }

  renderClusterOverview(isLoaded: boolean, isMetricsHidden: boolean) {
    if (!isLoaded) {
      return <Spinner center/>;
    }

    return (
      <>
        {this.renderMetrics(isMetricsHidden)}
        <ClusterIssues className={isMetricsHidden ? "OnlyClusterIssues" : ""}/>
      </>
    );
  }

  render() {
    const { eventStore, nodeStore, hostedCluster } = this.props;
    const isLoaded = nodeStore.isLoaded && eventStore.isLoaded;
    const isMetricHidden = hostedCluster.isMetricHidden(ClusterMetricsResourceType.Cluster);

    return (
      <TabLayout>
        <div className={styles.ClusterOverview} data-testid="cluster-overview-page">
          {this.renderClusterOverview(isLoaded, isMetricHidden)}
        </div>
      </TabLayout>
    );
  }
}

export const ClusterOverview = withInjectables<Dependencies>(NonInjectedClusterOverview, {
  getProps: (di) => {
    const hostedCluster = di.inject(hostedClusterInjectable);

    assert(hostedCluster, "Only allowed to renderer ClusterOverview within cluster frame");

    return {
      subscribeStores: di.inject(subscribeStoresInjectable),
      clusterOverviewStore: di.inject(clusterOverviewStoreInjectable),
      hostedCluster,
      podStore: di.inject(podStoreInjectable),
      eventStore: di.inject(eventStoreInjectable),
      nodeStore: di.inject(nodeStoreInjectable),
    };
  },
});
