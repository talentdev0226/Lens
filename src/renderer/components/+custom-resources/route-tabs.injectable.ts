/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed, IComputedValue } from "mobx";
import type { CustomResourceDefinition } from "../../../common/k8s-api/endpoints";
import { crdURL, crdDefinitionsRoute } from "../../../common/routes";
import type { TabLayoutRoute } from "../layout/tab-layout";
import groupedCustomResourceDefinitionsInjectable from "./grouped-custom-resources.injectable";

export interface CustomResourceTabLayoutRoute extends Omit<TabLayoutRoute, "component"> {
  id: string;
}

export interface CustomResourceGroupTabLayoutRoute extends CustomResourceTabLayoutRoute {
  subRoutes?: CustomResourceTabLayoutRoute[];
}

interface Dependencies {
  customResourcesDefinitions: IComputedValue<Map<string, CustomResourceDefinition[]>>;
}

function getRouteTabs({ customResourcesDefinitions }: Dependencies) {
  return computed(() => {
    const tabs: CustomResourceGroupTabLayoutRoute[] = [
      {
        id: "definitions",
        title: "Definitions",
        url: crdURL(),
        routePath: String(crdDefinitionsRoute.path),
        exact: true,
      },
    ];

    for (const [group, definitions] of customResourcesDefinitions.get()) {
      tabs.push({
        id: `crd-group:${group}`,
        title: group,
        routePath: crdURL({ query: { groups: group }}),
        subRoutes: definitions.map(crd => ({
          id: `crd-resource:${crd.getResourceApiBase()}`,
          title: crd.getResourceKind(),
          routePath: crd.getResourceUrl(),
        })),
      });
    }

    return tabs;
  });
}

const customResourcesRouteTabsInjectable = getInjectable({
  id: "custom-resources-route-tabs",

  instantiate: (di) => getRouteTabs({
    customResourcesDefinitions: di.inject(groupedCustomResourceDefinitionsInjectable),
  }),
});

export default customResourcesRouteTabsInjectable;
