import React from "react";
import { observer } from "mobx-react";
import { Redirect, Route, Switch } from "react-router";
import { TabLayout, TabLayoutRoute } from "../layout/tab-layout";
import { crdResourcesRoute, crdRoute, crdURL, crdDefinitionsRoute } from "./crd.route";
import { CrdList } from "./crd-list";
import { CrdResources } from "./crd-resources";

@observer
export class CustomResources extends React.Component {
  static get tabRoutes(): TabLayoutRoute[] {
    return [
      {
        title: "Definitions",
        component: CustomResources,
        url: crdURL(),
        routePath: crdRoute.path.toString(),
      }
    ];
  }

  render() {
    return (
      <TabLayout>
        <Switch>
          <Route component={CrdList} {...crdDefinitionsRoute} exact/>
          <Route component={CrdResources} {...crdResourcesRoute}/>
          <Redirect to={crdURL()}/>
        </Switch>
      </TabLayout>
    );
  }
}
