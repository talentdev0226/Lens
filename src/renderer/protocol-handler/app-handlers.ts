import { addClusterURL } from "../components/+add-cluster";
import { clusterSettingsURL } from "../components/+cluster-settings";
import { extensionsURL } from "../components/+extensions";
import { catalogURL } from "../components/+catalog";
import { preferencesURL } from "../components/+preferences";
import { clusterViewURL } from "../components/cluster-manager/cluster-view.route";
import { LensProtocolRouterRenderer } from "./router";
import { navigate } from "../navigation/helpers";
import { clusterStore } from "../../common/cluster-store";

export function bindProtocolAddRouteHandlers() {
  LensProtocolRouterRenderer
    .getInstance<LensProtocolRouterRenderer>()
    .addInternalHandler("/preferences", ({ search: { highlight }}) => {
      navigate(preferencesURL({ fragment: highlight }));
    })
    .addInternalHandler("/", () => {
      navigate(catalogURL());
    })
    .addInternalHandler("/landing", () => {
      navigate(catalogURL());
    })
    .addInternalHandler("/cluster", () => {
      navigate(addClusterURL());
    })
    .addInternalHandler("/cluster/:clusterId", ({ pathname: { clusterId } }) => {
      const cluster = clusterStore.getById(clusterId);

      if (cluster) {
        navigate(clusterViewURL({ params: { clusterId } }));
      } else {
        console.log("[APP-HANDLER]: cluster with given ID does not exist", { clusterId });
      }
    })
    .addInternalHandler("/cluster/:clusterId/settings", ({ pathname: { clusterId } }) => {
      const cluster = clusterStore.getById(clusterId);

      if (cluster) {
        navigate(clusterSettingsURL({ params: { clusterId } }));
      } else {
        console.log("[APP-HANDLER]: cluster with given ID does not exist", { clusterId });
      }
    })
    .addInternalHandler("/extensions", () => {
      navigate(extensionsURL());
    });
}
