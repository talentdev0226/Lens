/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./endpoints.scss";

import React from "react";
import { observer } from "mobx-react";
import type { RouteComponentProps } from "react-router-dom";
import { endpointStore } from "./endpoints.store";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import type { EndpointRouteParams } from "../../../common/routes";

enum columnId {
  name = "name",
  namespace = "namespace",
  endpoints = "endpoints",
  age = "age",
}

export interface EndpointsProps extends RouteComponentProps<EndpointRouteParams> {
}

@observer
export class Endpoints extends React.Component<EndpointsProps> {
  render() {
    return (
      <KubeObjectListLayout
        isConfigurable
        tableId="network_endpoints"
        className="Endpoints" store={endpointStore}
        sortingCallbacks={{
          [columnId.name]: endpoint => endpoint.getName(),
          [columnId.namespace]: endpoint => endpoint.getNs(),
          [columnId.age]: endpoint => endpoint.getTimeDiffFromNow(),
        }}
        searchFilters={[
          endpoint => endpoint.getSearchFields(),
        ]}
        renderHeaderTitle="Endpoints"
        renderTableHeader={[
          { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
          { className: "warning", showWithColumn: columnId.name },
          { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
          { title: "Endpoints", className: "endpoints", id: columnId.endpoints },
          { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
        ]}
        renderTableContents={endpoint => [
          endpoint.getName(),
          <KubeObjectStatusIcon key="icon" object={endpoint} />,
          endpoint.getNs(),
          endpoint.toString(),
          endpoint.getAge(),
        ]}
        tableProps={{
          customRowHeights: (item, lineHeight, paddings) => {
            const lines = item.getEndpointSubsets().length || 1;

            return lines * lineHeight + paddings;
          },
        }}
      />
    );
  }
}
