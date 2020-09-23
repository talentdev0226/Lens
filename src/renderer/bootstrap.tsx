import "./components/app.scss"
import React from "react";
import { render } from "react-dom";
import { isMac } from "../common/vars";
import { userStore } from "../common/user-store";
import { workspaceStore } from "../common/workspace-store";
import { clusterStore } from "../common/cluster-store";
import { i18nStore } from "./i18n";
import { themeStore } from "./theme.store";
import { App } from "./components/app";
import { LensApp } from "./lens-app";

type AppComponent = React.ComponentType & {
  init?(): void;
}

export async function bootstrap(App: AppComponent) {
  const rootElem = document.getElementById("app")
  rootElem.classList.toggle("is-mac", isMac);

  // preload common stores
  await Promise.all([
    userStore.load(),
    workspaceStore.load(),
    clusterStore.load(),
    i18nStore.init(),
    themeStore.init(),
  ]);

  // init app's dependencies if any
  if (App.init) {
    await App.init();
  }
  render(<>
    {isMac && <div id="draggable-top" />}
    <App />
  </>, rootElem);
}

// run
bootstrap(process.isMainFrame ? LensApp : App);
