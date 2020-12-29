import "./network.scss";

import React from "react";
import { observer } from "mobx-react";
import { TabLayout, TabLayoutRoute } from "../layout/tab-layout";
import { Services, servicesRoute, servicesURL } from "../+network-services";
import { endpointRoute, Endpoints, endpointURL } from "../+network-endpoints";
import { Ingresses, ingressRoute, ingressURL } from "../+network-ingresses";
import { NetworkPolicies, networkPoliciesRoute, networkPoliciesURL } from "../+network-policies";
import { namespaceUrlParam } from "../+namespaces/namespace.store";
import { isAllowedResource } from "../../../common/rbac";

@observer
export class Network extends React.Component {
  static get tabRoutes(): TabLayoutRoute[] {
    const query = namespaceUrlParam.toObjectParam();
    const routes: TabLayoutRoute[] = [];

    if (isAllowedResource("services")) {
      routes.push({
        title: "Services",
        component: Services,
        url: servicesURL({ query }),
        routePath: servicesRoute.path.toString(),
      });
    }

    if (isAllowedResource("endpoints")) {
      routes.push({
        title: "Endpoints",
        component: Endpoints,
        url: endpointURL({ query }),
        routePath: endpointRoute.path.toString(),
      });
    }

    if (isAllowedResource("ingresses")) {
      routes.push({
        title: "Ingresses",
        component: Ingresses,
        url: ingressURL({ query }),
        routePath: ingressRoute.path.toString(),
      });
    }

    if (isAllowedResource("networkpolicies")) {
      routes.push({
        title: "Network Policies",
        component: NetworkPolicies,
        url: networkPoliciesURL({ query }),
        routePath: networkPoliciesRoute.path.toString(),
      });
    }

    return routes;
  }

  render() {
    return (
      <TabLayout className="Network" tabs={Network.tabRoutes}/>
    );
  }
}
