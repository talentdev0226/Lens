import React from "react";
import uniqueId from "lodash/uniqueId";
import { clusterSettingsURL } from "../+cluster-settings";
import { catalogURL } from "../+catalog";

import { clusterStore } from "../../../common/cluster-store";
import { broadcastMessage, requestMain } from "../../../common/ipc";
import { clusterDisconnectHandler } from "../../../common/cluster-ipc";
import { ConfirmDialog } from "../confirm-dialog";
import { Cluster } from "../../../main/cluster";
import { Tooltip } from "../../components//tooltip";
import { IpcRendererNavigationEvents } from "../../navigation/events";

const navigate = (route: string) =>
  broadcastMessage(IpcRendererNavigationEvents.NAVIGATE_IN_APP, route);

/**
 * Creates handlers for high-level actions
 * that could be performed on an individual cluster
 * @param cluster Cluster
 */
export const ClusterActions = (cluster: Cluster) => ({
  showSettings: () => navigate(clusterSettingsURL({
    params: { clusterId: cluster.id }
  })),
  disconnect: async () => {
    clusterStore.deactivate(cluster.id);
    navigate(catalogURL());
    await requestMain(clusterDisconnectHandler, cluster.id);
  },
  remove: () => {
    const tooltipId = uniqueId("tooltip_target_");

    return ConfirmDialog.open({
      okButtonProps: {
        primary: false,
        accent: true,
        label: "Remove"
      },
      ok: () => {
        clusterStore.deactivate(cluster.id);
        clusterStore.removeById(cluster.id);
        navigate(catalogURL());
      },
      message: <p>
        Are you sure want to remove cluster <b id={tooltipId}>{cluster.name}</b>?
        <Tooltip  targetId={tooltipId}>{cluster.id}</Tooltip>
      </p>
    });
  }
});
