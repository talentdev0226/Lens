import "./storage.scss";

import React from "react";
import { observer } from "mobx-react";
import { TabLayout, TabLayoutRoute } from "../layout/tab-layout";
import { PersistentVolumes, volumesRoute, volumesURL } from "../+storage-volumes";
import { StorageClasses, storageClassesRoute, storageClassesURL } from "../+storage-classes";
import { PersistentVolumeClaims, volumeClaimsRoute, volumeClaimsURL } from "../+storage-volume-claims";
import { namespaceUrlParam } from "../+namespaces/namespace.store";
import { isAllowedResource } from "../../../common/rbac";

@observer
export class Storage extends React.Component {
  static get tabRoutes() {
    const tabRoutes: TabLayoutRoute[] = [];
    const query = namespaceUrlParam.toObjectParam();

    if (isAllowedResource("persistentvolumeclaims")) {
      tabRoutes.push({
        title: "Persistent Volume Claims",
        component: PersistentVolumeClaims,
        url: volumeClaimsURL({ query }),
        routePath: volumeClaimsRoute.path.toString(),
      });
    }

    if (isAllowedResource("persistentvolumes")) {
      tabRoutes.push({
        title: "Persistent Volumes",
        component: PersistentVolumes,
        url: volumesURL(),
        routePath: volumesRoute.path.toString(),
      });
    }

    if (isAllowedResource("storageclasses")) {
      tabRoutes.push({
        title: "Storage Classes",
        component: StorageClasses,
        url: storageClassesURL(),
        routePath: storageClassesRoute.path.toString(),
      });
    }

    return tabRoutes;
  }

  render() {
    return (
      <TabLayout className="Storage" tabs={Storage.tabRoutes}/>
    );
  }
}
