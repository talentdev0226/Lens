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
import "@testing-library/jest-dom/extend-expect";
import { KubeConfig } from "@kubernetes/client-node";
import { fireEvent, render } from "@testing-library/react";
import mockFs from "mock-fs";
import React from "react";
import * as selectEvent from "react-select-event";

import type { Cluster } from "../../../../common/cluster/cluster";
import { DeleteClusterDialog } from "../delete-cluster-dialog";

import type { ClusterModel } from "../../../../common/cluster-types";
import { getDisForUnitTesting } from "../../../../test-utils/get-dis-for-unit-testing";
import { createClusterInjectionToken } from "../../../../common/cluster/create-cluster-injection-token";

jest.mock("electron", () => ({
  app: {
    getVersion: () => "99.99.99",
    getName: () => "lens",
    setName: jest.fn(),
    setPath: jest.fn(),
    getPath: () => "tmp",
    getLocale: () => "en",
    setLoginItemSettings: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
}));

const kubeconfig = `
apiVersion: v1
clusters:
- cluster:
    server: https://localhost
  name: test
- cluster:
    server: http://localhost
  name: other-cluster
contexts:
- context:
    cluster: test
    user: test
  name: test
- context:
    cluster: test
    user: test
  name: test2
- context:
    cluster: other-cluster
    user: test
  name: other-context
current-context: other-context
kind: Config
preferences: {}
users:
- name: test
  user:
    token: kubeconfig-user-q4lm4:xxxyyyy
`;

const singleClusterConfig = `
apiVersion: v1
clusters:
- cluster:
    server: http://localhost
  name: other-cluster
contexts:
- context:
    cluster: other-cluster
    user: test
  name: other-context
current-context: other-context
kind: Config
preferences: {}
users:
- name: test
  user:
    token: kubeconfig-user-q4lm4:xxxyyyy
`;

let config: KubeConfig;

describe("<DeleteClusterDialog />", () => {
  let createCluster: (model: ClusterModel) => Cluster;

  beforeEach(async () => {
    const { mainDi, runSetups } = getDisForUnitTesting({ doGeneralOverrides: true });
    
    mockFs();

    await runSetups();

    createCluster = mainDi.inject(createClusterInjectionToken);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("Kubeconfig with different clusters", () => {
    beforeEach(async () => {
      const mockOpts = {
        "temp-kube-config": kubeconfig,
      };

      mockFs(mockOpts);

      config = new KubeConfig();
      config.loadFromString(kubeconfig);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("renders w/o errors", () => {
      const { container } = render(<DeleteClusterDialog />);

      expect(container).toBeInstanceOf(HTMLElement);
    });

    it("shows warning when deleting non-current-context cluster", () => {
      const cluster = createCluster({
        id: "test",
        contextName: "test",
        preferences: {
          clusterName: "minikube",
        },
        kubeConfigPath: "./temp-kube-config",
      });

      DeleteClusterDialog.open({ cluster, config });
      const { getByText } = render(<DeleteClusterDialog />);

      const message = "The contents of kubeconfig file will be changed!";

      expect(getByText(message)).toBeInstanceOf(HTMLElement);
    });

    it("shows warning when deleting current-context cluster", () => {
      const cluster = createCluster({
        id: "other-cluster",
        contextName: "other-context",
        preferences: {
          clusterName: "other-cluster",
        },
        kubeConfigPath: "./temp-kube-config",
      });

      DeleteClusterDialog.open({ cluster, config });

      const { getByTestId } = render(<DeleteClusterDialog />);

      expect(getByTestId("current-context-warning")).toBeInstanceOf(HTMLElement);
    });

    it("shows context switcher when deleting current cluster", async () => {
      const cluster = createCluster({
        id: "other-cluster",
        contextName: "other-context",
        preferences: {
          clusterName: "other-cluster",
        },
        kubeConfigPath: "./temp-kube-config",
      });

      DeleteClusterDialog.open({ cluster, config });

      const { getByText } = render(<DeleteClusterDialog />);

      expect(getByText("Select...")).toBeInTheDocument();
      selectEvent.openMenu(getByText("Select..."));

      expect(getByText("test")).toBeInTheDocument();
      expect(getByText("test2")).toBeInTheDocument();
    });

    it("shows context switcher after checkbox click", async () => {
      const cluster = createCluster({
        id: "some-cluster",
        contextName: "test",
        preferences: {
          clusterName: "test",
        },
        kubeConfigPath: "./temp-kube-config",
      });

      DeleteClusterDialog.open({ cluster, config });

      const { getByText, getByTestId } = render(<DeleteClusterDialog />);
      const link = getByTestId("context-switch");

      expect(link).toBeInstanceOf(HTMLElement);
      fireEvent.click(link);

      expect(getByText("Select...")).toBeInTheDocument();
      selectEvent.openMenu(getByText("Select..."));

      expect(getByText("test")).toBeInTheDocument();
      expect(getByText("test2")).toBeInTheDocument();
    });

    it("shows warning for internal kubeconfig cluster", () => {
      const cluster = createCluster({
        id: "some-cluster",
        contextName: "test",
        preferences: {
          clusterName: "test",
        },
        kubeConfigPath: "./temp-kube-config",
      });

      const spy = jest.spyOn(cluster, "isInLocalKubeconfig").mockImplementation(() => true);

      DeleteClusterDialog.open({ cluster, config });

      const { getByTestId } = render(<DeleteClusterDialog />);

      expect(getByTestId("internal-kubeconfig-warning")).toBeInstanceOf(HTMLElement);

      spy.mockRestore();
    });
  });

  describe("Kubeconfig with single cluster", () => {
    beforeEach(async () => {
      const mockOpts = {
        "temp-kube-config": singleClusterConfig,
      };

      mockFs(mockOpts);

      config = new KubeConfig();
      config.loadFromString(singleClusterConfig);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("shows warning if no other contexts left", () => {
      const cluster = createCluster({
        id: "other-cluster",
        contextName: "other-context",
        preferences: {
          clusterName: "other-cluster",
        },
        kubeConfigPath: "./temp-kube-config",
      });

      DeleteClusterDialog.open({ cluster, config });

      const { getByTestId } = render(<DeleteClusterDialog />);

      expect(getByTestId("no-more-contexts-warning")).toBeInstanceOf(HTMLElement);
    });
  });
});
