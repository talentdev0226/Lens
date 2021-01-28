import "./pod-security-policies.scss";

import React from "react";
import { observer } from "mobx-react";
import { KubeObjectListLayout } from "../kube-object";
import { podSecurityPoliciesStore } from "./pod-security-policies.store";
import { PodSecurityPolicy } from "../../api/endpoints";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";

enum columnId {
  name = "name",
  volumes = "volumes",
  privileged = "privileged",
  age = "age",
}

@observer
export class PodSecurityPolicies extends React.Component {
  render() {
    return (
      <KubeObjectListLayout
        isConfigurable
        tableId="access_roles"
        className="PodSecurityPolicies"
        isClusterScoped={true}
        store={podSecurityPoliciesStore}
        sortingCallbacks={{
          [columnId.name]: (item: PodSecurityPolicy) => item.getName(),
          [columnId.volumes]: (item: PodSecurityPolicy) => item.getVolumes(),
          [columnId.privileged]: (item: PodSecurityPolicy) => +item.isPrivileged(),
          [columnId.age]: (item: PodSecurityPolicy) => item.metadata.creationTimestamp,
        }}
        searchFilters={[
          (item: PodSecurityPolicy) => item.getSearchFields(),
          (item: PodSecurityPolicy) => item.getVolumes(),
          (item: PodSecurityPolicy) => Object.values(item.getRules()),
        ]}
        renderHeaderTitle="Pod Security Policies"
        renderTableHeader={[
          { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
          { className: "warning", showWithColumn: columnId.name },
          { title: "Privileged", className: "privileged", sortBy: columnId.privileged, id: columnId.privileged },
          { title: "Volumes", className: "volumes", sortBy: columnId.volumes, id: columnId.volumes },
          { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
        ]}
        renderTableContents={(item: PodSecurityPolicy) => {
          return [
            item.getName(),
            <KubeObjectStatusIcon key="icon" object={item} />,
            item.isPrivileged() ? "Yes" : "No",
            item.getVolumes().join(", "),
            item.getAge(),
          ];
        }}
      />
    );
  }
}
