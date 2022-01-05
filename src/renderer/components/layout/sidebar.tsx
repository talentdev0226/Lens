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

import styles from "./sidebar.module.scss";
import type { TabLayoutRoute } from "./tab-layout";

import React from "react";
import { disposeOnUnmount, observer } from "mobx-react";
import { cssNames, Disposer } from "../../utils";
import { Icon } from "../icon";
import { Workloads } from "../+workloads";
import { UserManagement } from "../+user-management";
import { Storage } from "../+storage";
import { Network } from "../+network";
import { crdStore } from "../+custom-resources/crd.store";
import { CustomResources } from "../+custom-resources/custom-resources";
import { isActiveRoute } from "../../navigation";
import { isAllowedResource } from "../../../common/utils/allowed-resource";
import { Spinner } from "../spinner";
import { ClusterPageMenuRegistration, ClusterPageMenuRegistry, ClusterPageRegistry, getExtensionPageUrl } from "../../../extensions/registries";
import { SidebarItem } from "./sidebar-item";
import { Apps } from "../+apps";
import * as routes from "../../../common/routes";
import { Config } from "../+config";
import { catalogEntityRegistry } from "../../api/catalog-entity-registry";
import { SidebarCluster } from "./sidebar-cluster";
import type { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import type { KubeObject } from "../../../common/k8s-api/kube-object";
import { withInjectables } from "@ogre-tools/injectable-react";
import kubeWatchApiInjectable
  from "../../kube-watch-api/kube-watch-api.injectable";

interface Props {
  className?: string;
}

interface Dependencies {
  subscribeStores: (stores: KubeObjectStore<KubeObject>[]) => Disposer
}

@observer
class NonInjectedSidebar extends React.Component<Props & Dependencies> {
  static displayName = "Sidebar";

  componentDidMount() {
    disposeOnUnmount(this, [
      this.props.subscribeStores([
        crdStore,
      ]),
    ]);
  }

  renderCustomResources() {
    if (crdStore.isLoading) {
      return (
        <div className="flex justify-center">
          <Spinner/>
        </div>
      );
    }

    return Object.entries(crdStore.groups).map(([group, crds]) => {
      const id = `crd-group:${group}`;
      const crdGroupsPageUrl = routes.crdURL({ query: { groups: group }});

      return (
        <SidebarItem key={id} id={id} text={group} url={crdGroupsPageUrl}>
          {crds.map((crd) => (
            <SidebarItem
              key={crd.getResourceApiBase()}
              id={`crd-resource:${crd.getResourceApiBase()}`}
              url={crd.getResourceUrl()}
              text={crd.getResourceKind()}
            />
          ))}
        </SidebarItem>
      );
    });
  }

  renderTreeFromTabRoutes(tabRoutes: TabLayoutRoute[] = []): React.ReactNode {
    if (!tabRoutes.length) {
      return null;
    }

    return tabRoutes.map(({ title, routePath, url = routePath, exact = true }) => {
      const subMenuItemId = `tab-route-item-${url}`;

      return (
        <SidebarItem
          key={subMenuItemId}
          id={subMenuItemId}
          url={url}
          text={title}
          isActive={isActiveRoute({ path: routePath, exact })}
        />
      );
    });
  }

  getTabLayoutRoutes(menu: ClusterPageMenuRegistration): TabLayoutRoute[] {
    if (!menu.id) {
      return [];
    }

    const routes: TabLayoutRoute[] = [];
    const subMenus = ClusterPageMenuRegistry.getInstance().getSubItems(menu);
    const clusterPageRegistry = ClusterPageRegistry.getInstance();

    for (const subMenu of subMenus) {
      const page = clusterPageRegistry.getByPageTarget(subMenu.target);

      if (!page) {
        continue;
      }

      const { extensionId, id: pageId, url, components } = page;

      if (subMenu.components.Icon) {
        console.warn(
          "ClusterPageMenuRegistration has components.Icon defined and a valid parentId. Icon will not be displayed",
          {
            id: subMenu.id,
            parentId: subMenu.parentId,
            target: subMenu.target,
          },
        );
      }

      routes.push({
        routePath: url,
        url: getExtensionPageUrl({ extensionId, pageId, params: subMenu.target.params }),
        title: subMenu.title,
        component: components.Page,
      });
    }

    return routes;
  }

  renderRegisteredMenus() {
    return ClusterPageMenuRegistry.getInstance().getRootItems().map((menuItem, index) => {
      const registeredPage = ClusterPageRegistry.getInstance().getByPageTarget(menuItem.target);
      const tabRoutes = this.getTabLayoutRoutes(menuItem);
      const id = `registered-item-${index}`;
      let pageUrl: string;
      let isActive = false;

      if (registeredPage) {
        const { extensionId, id: pageId } = registeredPage;

        pageUrl = getExtensionPageUrl({ extensionId, pageId, params: menuItem.target.params });
        isActive = isActiveRoute(registeredPage.url);
      } else if (tabRoutes.length > 0) {
        pageUrl = tabRoutes[0].url;
        isActive = isActiveRoute(tabRoutes.map((tab) => tab.routePath));
      } else {
        return null;
      }

      return (
        <SidebarItem
          key={id}
          id={id}
          url={pageUrl}
          isActive={isActive}
          text={menuItem.title}
          icon={<menuItem.components.Icon/>}
        >
          {this.renderTreeFromTabRoutes(tabRoutes)}
        </SidebarItem>
      );
    });
  }

  get clusterEntity() {
    return catalogEntityRegistry.activeEntity;
  }

  render() {
    const { className } = this.props;

    return (
      <div className={cssNames("flex flex-col", className)} data-testid="cluster-sidebar">
        <SidebarCluster clusterEntity={this.clusterEntity}/>
        <div className={styles.sidebarNav}>
          <SidebarItem
            id="cluster"
            text="Cluster"
            isActive={isActiveRoute(routes.clusterRoute)}
            isHidden={!isAllowedResource("nodes")}
            url={routes.clusterURL()}
            icon={<Icon svg="kube"/>}
          />
          <SidebarItem
            id="nodes"
            text="Nodes"
            isActive={isActiveRoute(routes.nodesRoute)}
            isHidden={!isAllowedResource("nodes")}
            url={routes.nodesURL()}
            icon={<Icon svg="nodes"/>}
          />
          <SidebarItem
            id="workloads"
            text="Workloads"
            isActive={isActiveRoute(routes.workloadsRoute)}
            isHidden={Workloads.tabRoutes.length == 0}
            url={routes.workloadsURL()}
            icon={<Icon svg="workloads"/>}
          >
            {this.renderTreeFromTabRoutes(Workloads.tabRoutes)}
          </SidebarItem>
          <SidebarItem
            id="config"
            text="Configuration"
            isActive={isActiveRoute(routes.configRoute)}
            isHidden={Config.tabRoutes.length == 0}
            url={routes.configURL()}
            icon={<Icon material="list"/>}
          >
            {this.renderTreeFromTabRoutes(Config.tabRoutes)}
          </SidebarItem>
          <SidebarItem
            id="networks"
            text="Network"
            isActive={isActiveRoute(routes.networkRoute)}
            isHidden={Network.tabRoutes.length == 0}
            url={routes.networkURL()}
            icon={<Icon material="device_hub"/>}
          >
            {this.renderTreeFromTabRoutes(Network.tabRoutes)}
          </SidebarItem>
          <SidebarItem
            id="storage"
            text="Storage"
            isActive={isActiveRoute(routes.storageRoute)}
            isHidden={Storage.tabRoutes.length == 0}
            url={routes.storageURL()}
            icon={<Icon svg="storage"/>}
          >
            {this.renderTreeFromTabRoutes(Storage.tabRoutes)}
          </SidebarItem>
          <SidebarItem
            id="namespaces"
            text="Namespaces"
            isActive={isActiveRoute(routes.namespacesRoute)}
            isHidden={!isAllowedResource("namespaces")}
            url={routes.namespacesURL()}
            icon={<Icon material="layers"/>}
          />
          <SidebarItem
            id="events"
            text="Events"
            isActive={isActiveRoute(routes.eventRoute)}
            isHidden={!isAllowedResource("events")}
            url={routes.eventsURL()}
            icon={<Icon material="access_time"/>}
          />
          <SidebarItem
            id="apps"
            text="Apps" // helm charts
            isActive={isActiveRoute(routes.appsRoute)}
            url={routes.appsURL()}
            icon={<Icon material="apps"/>}
          >
            {this.renderTreeFromTabRoutes(Apps.tabRoutes)}
          </SidebarItem>
          <SidebarItem
            id="users"
            text="Access Control"
            isActive={isActiveRoute(routes.usersManagementRoute)}
            isHidden={UserManagement.tabRoutes.length === 0}
            url={routes.usersManagementURL()}
            icon={<Icon material="security"/>}
          >
            {this.renderTreeFromTabRoutes(UserManagement.tabRoutes)}
          </SidebarItem>
          <SidebarItem
            id="custom-resources"
            text="Custom Resources"
            url={routes.crdURL()}
            isActive={isActiveRoute(routes.crdRoute)}
            isHidden={!isAllowedResource("customresourcedefinitions")}
            icon={<Icon material="extension"/>}
          >
            {this.renderTreeFromTabRoutes(CustomResources.tabRoutes)}
            {this.renderCustomResources()}
          </SidebarItem>
          {this.renderRegisteredMenus()}
        </div>
      </div>
    );
  }
}

export const Sidebar = withInjectables<Dependencies, Props>(
  NonInjectedSidebar,

  {
    getProps: (di, props) => ({
      subscribeStores: di.inject(kubeWatchApiInjectable).subscribeStores,
      ...props,
    }),
  },
);
