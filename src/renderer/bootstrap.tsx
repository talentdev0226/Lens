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

import "./components/app.scss";

import React from "react";
import * as Mobx from "mobx";
import * as MobxReact from "mobx-react";
import * as ReactRouter from "react-router";
import * as ReactRouterDom from "react-router-dom";
import { render, unmountComponentAtNode } from "react-dom";
import { delay } from "../common/utils";
import { isMac, isDevelopment } from "../common/vars";
import { HotbarStore } from "../common/hotbar-store";
import { ClusterStore } from "../common/cluster-store";
import { UserStore } from "../common/user-store";
import * as LensExtensions from "../extensions/extension-api";
import { ExtensionDiscovery } from "../extensions/extension-discovery";
import { ExtensionLoader } from "../extensions/extension-loader";
import { ExtensionsStore } from "../extensions/extensions-store";
import { FilesystemProvisionerStore } from "../main/extension-filesystem";
import { App } from "./components/app";
import { LensApp } from "./lens-app";
import { ThemeStore } from "./theme.store";
import { HelmRepoManager } from "../main/helm/helm-repo-manager";
import { ExtensionInstallationStateStore } from "./components/+extensions/extension-install.store";
import { DefaultProps } from "./mui-base-theme";

/**
 * If this is a development buid, wait a second to attach
 * Chrome Debugger to renderer process
 * https://stackoverflow.com/questions/52844870/debugging-electron-renderer-process-with-vscode
 */
async function attachChromeDebugger() {
  if (isDevelopment) {
    await delay(1000);
  }
}

type AppComponent = React.ComponentType & {
  init?(): Promise<void>;
};

export {
  React,
  ReactRouter,
  ReactRouterDom,
  Mobx,
  MobxReact,
  LensExtensions
};

export async function bootstrap(App: AppComponent) {
  const rootElem = document.getElementById("app");

  await attachChromeDebugger();
  rootElem.classList.toggle("is-mac", isMac);

  ExtensionLoader.createInstance().init();
  ExtensionDiscovery.createInstance().init();

  const userStore = UserStore.createInstance();
  const clusterStore = ClusterStore.createInstance();
  const extensionsStore = ExtensionsStore.createInstance();
  const filesystemStore = FilesystemProvisionerStore.createInstance();
  const themeStore = ThemeStore.createInstance();
  const hotbarStore = HotbarStore.createInstance();

  ExtensionInstallationStateStore.bindIpcListeners();
  HelmRepoManager.createInstance(); // initialize the manager

  // preload common stores
  await Promise.all([
    userStore.load(),
    hotbarStore.load(),
    clusterStore.load(),
    extensionsStore.load(),
    filesystemStore.load(),
    themeStore.init(),
  ]);

  // Register additional store listeners
  clusterStore.registerIpcListener();

  // init app's dependencies if any
  if (App.init) {
    await App.init();
  }
  window.addEventListener("message", (ev: MessageEvent) => {
    if (ev.data === "teardown") {
      UserStore.getInstance(false)?.unregisterIpcListener();
      ClusterStore.getInstance(false)?.unregisterIpcListener();
      unmountComponentAtNode(rootElem);
      window.location.href = "about:blank";
    }
  });
  render(<>
    {isMac && <div id="draggable-top" />}
    {DefaultProps(App)}
  </>, rootElem);
}

// run
bootstrap(process.isMainFrame ? LensApp : App);
