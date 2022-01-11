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

import fs from "fs";
import mockFs from "mock-fs";
import yaml from "js-yaml";
import path from "path";
import fse from "fs-extra";
import type { Cluster } from "../cluster/cluster";
import { ClusterStore } from "../cluster-store/cluster-store";
import { Console } from "console";
import { stdout, stderr } from "process";
import getCustomKubeConfigDirectoryInjectable from "../app-paths/get-custom-kube-config-directory/get-custom-kube-config-directory.injectable";
import clusterStoreInjectable from "../cluster-store/cluster-store.injectable";
import type { ClusterModel } from "../cluster-types";
import type {
  DependencyInjectionContainer,
} from "@ogre-tools/injectable";


import { getDisForUnitTesting } from "../../test-utils/get-dis-for-unit-testing";
import { createClusterInjectionToken } from "../cluster/create-cluster-injection-token";

import directoryForUserDataInjectable
  from "../app-paths/directory-for-user-data/directory-for-user-data.injectable";

console = new Console(stdout, stderr);

const testDataIcon = fs.readFileSync(
  "test-data/cluster-store-migration-icon.png",
);
const kubeconfig = `
apiVersion: v1
clusters:
- cluster:
    server: https://localhost
  name: test
contexts:
- context:
    cluster: test
    user: test
  name: foo
- context:
    cluster: test
    user: test
  name: foo2
current-context: test
kind: Config
preferences: {}
users:
- name: test
  user:
    token: kubeconfig-user-q4lm4:xxxyyyy
`;

const embed = (directoryName: string, contents: any): string => {
  fse.ensureDirSync(path.dirname(directoryName));
  fse.writeFileSync(directoryName, contents, {
    encoding: "utf-8",
    mode: 0o600,
  });

  return directoryName;
};

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    off: jest.fn(),
    send: jest.fn(),
  },
}));

describe("cluster-store", () => {
  let mainDi: DependencyInjectionContainer;
  let clusterStore: ClusterStore;
  let createCluster: (model: ClusterModel) => Cluster;

  beforeEach(async () => {
    const dis = getDisForUnitTesting({ doGeneralOverrides: true });

    mockFs();

    mainDi = dis.mainDi;

    mainDi.override(directoryForUserDataInjectable, () => "some-directory-for-user-data");

    await dis.runSetups();

    createCluster = mainDi.inject(createClusterInjectionToken);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("empty config", () => {
    let getCustomKubeConfigDirectory: (directoryName: string) => string;

    beforeEach(async () => {
      getCustomKubeConfigDirectory = mainDi.inject(
        getCustomKubeConfigDirectoryInjectable,
      );

      // TODO: Remove these by removing Singleton base-class from BaseStore
      ClusterStore.getInstance(false)?.unregisterIpcListener();
      ClusterStore.resetInstance();

      const mockOpts = {
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({}),
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    describe("with foo cluster added", () => {
      beforeEach(() => {
        const cluster = createCluster({
          id: "foo",
          contextName: "foo",
          preferences: {
            terminalCWD: "/some-directory-for-user-data",
            icon: "data:image/jpeg;base64, iVBORw0KGgoAAAANSUhEUgAAA1wAAAKoCAYAAABjkf5",
            clusterName: "minikube",
          },
          kubeConfigPath: embed(
            getCustomKubeConfigDirectory("foo"),
            kubeconfig,
          ),
        });

        clusterStore.addCluster(cluster);
      });

      it("adds new cluster to store", async () => {
        const storedCluster = clusterStore.getById("foo");

        expect(storedCluster.id).toBe("foo");
        expect(storedCluster.preferences.terminalCWD).toBe("/some-directory-for-user-data");
        expect(storedCluster.preferences.icon).toBe(
          "data:image/jpeg;base64, iVBORw0KGgoAAAANSUhEUgAAA1wAAAKoCAYAAABjkf5",
        );
      });
    });

    describe("with prod and dev clusters added", () => {
      beforeEach(() => {
        const store = clusterStore;

        store.addCluster({
          id: "prod",
          contextName: "foo",
          preferences: {
            clusterName: "prod",
          },
          kubeConfigPath: embed(
            getCustomKubeConfigDirectory("prod"),
            kubeconfig,
          ),
        });
        store.addCluster({
          id: "dev",
          contextName: "foo2",
          preferences: {
            clusterName: "dev",
          },
          kubeConfigPath: embed(
            getCustomKubeConfigDirectory("dev"),
            kubeconfig,
          ),
        });
      });

      it("check if store can contain multiple clusters", () => {
        expect(clusterStore.hasClusters()).toBeTruthy();
        expect(clusterStore.clusters.size).toBe(2);
      });

      it("check if cluster's kubeconfig file saved", () => {
        const file = embed(getCustomKubeConfigDirectory("boo"), "kubeconfig");

        expect(fs.readFileSync(file, "utf8")).toBe("kubeconfig");
      });
    });
  });

  describe("config with existing clusters", () => {
    beforeEach(() => {
      ClusterStore.resetInstance();

      const mockOpts = {
        "temp-kube-config": kubeconfig,
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({
            __internal__: {
              migrations: {
                version: "99.99.99",
              },
            },
            clusters: [
              {
                id: "cluster1",
                kubeConfigPath: "./temp-kube-config",
                contextName: "foo",
                preferences: { terminalCWD: "/foo" },
                workspace: "default",
              },
              {
                id: "cluster2",
                kubeConfigPath: "./temp-kube-config",
                contextName: "foo2",
                preferences: { terminalCWD: "/foo2" },
              },
              {
                id: "cluster3",
                kubeConfigPath: "./temp-kube-config",
                contextName: "foo",
                preferences: { terminalCWD: "/foo" },
                workspace: "foo",
                ownerRef: "foo",
              },
            ],
          }),
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("allows to retrieve a cluster", () => {
      const storedCluster = clusterStore.getById("cluster1");

      expect(storedCluster.id).toBe("cluster1");
      expect(storedCluster.preferences.terminalCWD).toBe("/foo");
    });

    it("allows getting all of the clusters", async () => {
      const storedClusters = clusterStore.clustersList;

      expect(storedClusters.length).toBe(3);
      expect(storedClusters[0].id).toBe("cluster1");
      expect(storedClusters[0].preferences.terminalCWD).toBe("/foo");
      expect(storedClusters[1].id).toBe("cluster2");
      expect(storedClusters[1].preferences.terminalCWD).toBe("/foo2");
      expect(storedClusters[2].id).toBe("cluster3");
    });
  });

  describe("config with invalid cluster kubeconfig", () => {
    beforeEach(() => {
      const invalidKubeconfig = `
apiVersion: v1
clusters:
- cluster:
    server: https://localhost
  name: test2
contexts:
- context:
    cluster: test
    user: test
  name: test
current-context: test
kind: Config
preferences: {}
users:
- name: test
  user:
    token: kubeconfig-user-q4lm4:xxxyyyy
`;

      ClusterStore.resetInstance();

      const mockOpts = {
        "invalid-kube-config": invalidKubeconfig,
        "valid-kube-config": kubeconfig,
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({
            __internal__: {
              migrations: {
                version: "99.99.99",
              },
            },
            clusters: [
              {
                id: "cluster1",
                kubeConfigPath: "./invalid-kube-config",
                contextName: "test",
                preferences: { terminalCWD: "/foo" },
                workspace: "foo",
              },
              {
                id: "cluster2",
                kubeConfigPath: "./valid-kube-config",
                contextName: "foo",
                preferences: { terminalCWD: "/foo" },
                workspace: "default",
              },
            ],
          }),
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("does not enable clusters with invalid kubeconfig", () => {
      const storedClusters = clusterStore.clustersList;

      expect(storedClusters.length).toBe(1);
    });
  });

  describe("pre 2.0 config with an existing cluster", () => {
    beforeEach(() => {
      ClusterStore.resetInstance();

      const mockOpts = {
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({
            __internal__: {
              migrations: {
                version: "1.0.0",
              },
            },
            cluster1: minimalValidKubeConfig,
          }),
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("migrates to modern format with kubeconfig in a file", async () => {
      const config = clusterStore.clustersList[0].kubeConfigPath;

      expect(fs.readFileSync(config, "utf8")).toContain(`"contexts":[`);
    });
  });

  describe("pre 2.6.0 config with a cluster that has arrays in auth config", () => {
    beforeEach(() => {
      ClusterStore.resetInstance();
      const mockOpts = {
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({
            __internal__: {
              migrations: {
                version: "2.4.1",
              },
            },
            cluster1: {
              kubeConfig: JSON.stringify({
                apiVersion: "v1",
                clusters: [
                  {
                    cluster: {
                      server: "https://10.211.55.6:8443",
                    },
                    name: "minikube",
                  },
                ],
                contexts: [
                  {
                    context: {
                      cluster: "minikube",
                      user: "minikube",
                      name: "minikube",
                    },
                    name: "minikube",
                  },
                ],
                "current-context": "minikube",
                kind: "Config",
                preferences: {},
                users: [
                  {
                    name: "minikube",
                    user: {
                      "client-certificate": "/Users/foo/.minikube/client.crt",
                      "client-key": "/Users/foo/.minikube/client.key",
                      "auth-provider": {
                        config: {
                          "access-token": ["should be string"],
                          expiry: ["should be string"],
                        },
                      },
                    },
                  },
                ],
              }),
            },
          }),
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("replaces array format access token and expiry into string", async () => {
      const file = clusterStore.clustersList[0].kubeConfigPath;
      const config = fs.readFileSync(file, "utf8");
      const kc = yaml.load(config) as Record<string, any>;

      expect(kc.users[0].user["auth-provider"].config["access-token"]).toBe(
        "should be string",
      );
      expect(kc.users[0].user["auth-provider"].config["expiry"]).toBe(
        "should be string",
      );
    });
  });

  describe("pre 2.6.0 config with a cluster icon", () => {
    beforeEach(() => {
      ClusterStore.resetInstance();
      const mockOpts = {
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({
            __internal__: {
              migrations: {
                version: "2.4.1",
              },
            },
            cluster1: {
              kubeConfig: minimalValidKubeConfig,
              icon: "icon_path",
              preferences: {
                terminalCWD: "/some-directory-for-user-data",
              },
            },
          }),
          icon_path: testDataIcon,
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("moves the icon into preferences", async () => {
      const storedClusterData = clusterStore.clustersList[0];

      expect(Object.prototype.hasOwnProperty.call(storedClusterData, "icon")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(storedClusterData.preferences, "icon")).toBe(true);
      expect(storedClusterData.preferences.icon.startsWith("data:;base64,")).toBe(true);
    });
  });

  describe("pre 3.6.0-beta.1 config with an existing cluster", () => {
    beforeEach(() => {
      ClusterStore.resetInstance();
      const mockOpts = {
        "some-directory-for-user-data": {
          "lens-cluster-store.json": JSON.stringify({
            __internal__: {
              migrations: {
                version: "3.5.0",
              },
            },
            clusters: [
              {
                id: "cluster1",
                kubeConfig: minimalValidKubeConfig,
                contextName: "cluster",
                preferences: {
                  icon: "store://icon_path",
                },
              },
            ],
          }),
          icon_path: testDataIcon,
        },
      };

      mockFs(mockOpts);

      clusterStore = mainDi.inject(clusterStoreInjectable);
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("migrates to modern format with kubeconfig in a file", async () => {
      const config = clusterStore.clustersList[0].kubeConfigPath;

      expect(fs.readFileSync(config, "utf8")).toBe(minimalValidKubeConfig);
    });

    it("migrates to modern format with icon not in file", async () => {
      const { icon } = clusterStore.clustersList[0].preferences;

      expect(icon.startsWith("data:;base64,")).toBe(true);
    });
  });
});

const minimalValidKubeConfig = JSON.stringify({
  apiVersion: "v1",
  clusters: [
    {
      name: "minikube",
      cluster: {
        server: "https://192.168.64.3:8443",
      },
    },
  ],
  "current-context": "minikube",
  contexts: [
    {
      context: {
        cluster: "minikube",
        user: "minikube",
      },
      name: "minikube",
    },
  ],
  users: [
    {
      name: "minikube",
      user: {
        "client-certificate": "/Users/foo/.minikube/client.crt",
        "client-key": "/Users/foo/.minikube/client.key",
      },
    },
  ],
  kind: "Config",
  preferences: {},
});
