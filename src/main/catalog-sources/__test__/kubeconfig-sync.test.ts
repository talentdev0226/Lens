/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable, ObservableMap } from "mobx";
import type { CatalogEntity } from "../../../common/catalog";
import { loadFromOptions } from "../../../common/kube-helpers";
import type { Cluster } from "../../../common/cluster/cluster";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import directoryForTempInjectable from "../../../common/app-paths/directory-for-temp/directory-for-temp.injectable";
import { iter, strictGet } from "../../../common/utils";
import type { ComputeKubeconfigDiff } from "../kubeconfig-sync/compute-diff.injectable";
import computeKubeconfigDiffInjectable from "../kubeconfig-sync/compute-diff.injectable";
import type { ConfigToModels } from "../kubeconfig-sync/config-to-models.injectable";
import configToModelsInjectable from "../kubeconfig-sync/config-to-models.injectable";
import kubeconfigSyncManagerInjectable from "../kubeconfig-sync/manager.injectable";
import type { KubeconfigSyncManager } from "../kubeconfig-sync/manager";
import type { KubeconfigSyncValue } from "../../../common/user-store";
import kubeconfigSyncsInjectable from "../../../common/user-store/kubeconfig-syncs.injectable";
import getClusterByIdInjectable from "../../../common/cluster-store/get-by-id.injectable";
import type { DiContainer } from "@ogre-tools/injectable";
import type { AsyncFnMock } from "@async-fn/jest";
import type { Stat } from "../../../common/fs/stat/stat.injectable";
import asyncFn from "@async-fn/jest";
import statInjectable from "../../../common/fs/stat/stat.injectable";
import type { Watcher } from "../../../common/fs/watch/watch.injectable";
import watchInjectable from "../../../common/fs/watch/watch.injectable";
import EventEmitter from "events";
import type { ReadStream, Stats } from "fs";
import createReadFileStreamInjectable from "../../../common/fs/create-read-file-stream.injectable";

describe("kubeconfig-sync.source tests", () => {
  let computeKubeconfigDiff: ComputeKubeconfigDiff;
  let configToModels: ConfigToModels;
  let kubeconfigSyncs: ObservableMap<string, KubeconfigSyncValue>;
  let clusters: Map<string, Cluster>;
  let di: DiContainer;

  beforeEach(async () => {
    di = getDiForUnitTesting({ doGeneralOverrides: true });

    di.override(directoryForUserDataInjectable, () => "/some-directory-for-user-data");
    di.override(directoryForTempInjectable, () => "/some-directory-for-temp");

    clusters = new Map();
    di.override(getClusterByIdInjectable, () => id => clusters.get(id));

    kubeconfigSyncs = observable.map();

    di.override(kubeconfigSyncsInjectable, () => kubeconfigSyncs);

    computeKubeconfigDiff = di.inject(computeKubeconfigDiffInjectable);
    configToModels = di.inject(configToModelsInjectable);
  });

  describe("configsToModels", () => {
    it("should filter out invalid split configs", () => {
      const config = loadFromOptions({
        clusters: [],
        users: [],
        contexts: [],
        currentContext: "foobar",
      });

      expect(configToModels(config, "").length).toBe(0);
    });

    it("should keep a single valid split config", () => {
      const config = loadFromOptions({
        clusters: [{
          name: "cluster-name",
          server: "1.2.3.4",
          skipTLSVerify: false,
        }],
        users: [{
          name: "user-name",
        }],
        contexts: [{
          cluster: "cluster-name",
          name: "context-name",
          user: "user-name",
        }],
        currentContext: "foobar",
      });

      const models = configToModels(config, "/bar");

      expect(models.length).toBe(1);
      expect(models[0][0].contextName).toBe("context-name");
      expect(models[0][0].kubeConfigPath).toBe("/bar");
    });
  });

  describe("computeKubeconfigDiff", () => {
    it("should leave an empty source empty if there are no entries", () => {
      const contents = "";
      const rootSource = new ObservableMap<string, [Cluster, CatalogEntity]>();
      const filePath = "/bar";

      computeKubeconfigDiff(contents, rootSource, filePath);

      expect(rootSource.size).toBe(0);
    });

    it("should add only the valid clusters to the source", () => {
      const contents = JSON.stringify({
        clusters: [{
          name: "cluster-name",
          cluster: {
            server: "1.2.3.4",
          },
          skipTLSVerify: false,
        }],
        users: [{
          name: "user-name",
        }],
        contexts: [{
          name: "context-name",
          context: {
            cluster: "cluster-name",
            user: "user-name",
          },
        }, {
          name: "context-the-second",
          context: {
            cluster: "missing-cluster",
            user: "user-name",
          },
        }],
        currentContext: "foobar",
      });
      const rootSource = new ObservableMap<string, [Cluster, CatalogEntity]>();
      const filePath = "/bar";

      computeKubeconfigDiff(contents, rootSource, filePath);

      expect(rootSource.size).toBe(1);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const c = (iter.first(rootSource.values())!)[0];

      expect(c.kubeConfigPath).toBe("/bar");
      expect(c.contextName).toBe("context-name");
    });

    it("should remove a cluster when it is removed from the contents", () => {
      const contents = JSON.stringify({
        clusters: [{
          name: "cluster-name",
          cluster: {
            server: "1.2.3.4",
          },
          skipTLSVerify: false,
        }],
        users: [{
          name: "user-name",

        }],
        contexts: [{
          name: "context-name",
          context: {
            cluster: "cluster-name",
            user: "user-name",
          },
        }, {
          name: "context-the-second",
          context: {
            cluster: "missing-cluster",
            user: "user-name",
          },
        }],
        currentContext: "foobar",
      });
      const rootSource = new ObservableMap<string, [Cluster, CatalogEntity]>();
      const filePath = "/bar";

      computeKubeconfigDiff(contents, rootSource, filePath);

      expect(rootSource.size).toBe(1);

      const c = rootSource.values().next().value[0] as Cluster;

      expect(c.kubeConfigPath).toBe("/bar");
      expect(c.contextName).toBe("context-name");

      computeKubeconfigDiff("{}", rootSource, filePath);

      expect(rootSource.size).toBe(0);
    });

    it("should remove only the cluster that it is removed from the contents", () => {
      const contents = JSON.stringify({
        clusters: [{
          name: "cluster-name",
          cluster: {
            server: "1.2.3.4",
          },
          skipTLSVerify: false,
        }],
        users: [{
          name: "user-name",
        }, {
          name: "user-name-2",
        }],
        contexts: [{
          name: "context-name",
          context: {
            cluster: "cluster-name",
            user: "user-name",
          },
        }, {
          name: "context-name-2",
          context: {
            cluster: "cluster-name",
            user: "user-name-2",
          },
        }, {
          name: "context-the-second",
          context: {
            cluster: "missing-cluster",
            user: "user-name",
          },
        }],
        currentContext: "foobar",
      });
      const rootSource = new ObservableMap<string, [Cluster, CatalogEntity]>();
      const filePath = "/bar";

      computeKubeconfigDiff(contents, rootSource, filePath);

      expect(rootSource.size).toBe(2);

      {
        const c = rootSource.values().next().value[0] as Cluster;

        expect(c.kubeConfigPath).toBe("/bar");
        expect(["context-name", "context-name-2"].includes(c.contextName)).toBe(true);
      }

      const newContents = JSON.stringify({
        clusters: [{
          name: "cluster-name",
          cluster: {
            server: "1.2.3.4",
          },
          skipTLSVerify: false,
        }],
        users: [{
          name: "user-name",
        }, {
          name: "user-name-2",
        }],
        contexts: [{
          name: "context-name",
          context: {
            cluster: "cluster-name",
            user: "user-name",
          },
        }, {
          name: "context-the-second",
          context: {
            cluster: "missing-cluster",
            user: "user-name",
          },
        }],
        currentContext: "foobar",
      });

      computeKubeconfigDiff(newContents, rootSource, filePath);

      expect(rootSource.size).toBe(1);

      {
        const c = rootSource.values().next().value[0] as Cluster;

        expect(c.kubeConfigPath).toBe("/bar");
        expect(c.contextName).toBe("context-name");
      }
    });
  });

  describe("given a config file at /foobar/config", () => {
    let manager: KubeconfigSyncManager;
    let watchInstances: Map<string, Watcher<true>>;
    let firstReadFoobarConfigSteam: ReadStream;
    let secondReadFoobarConfigSteam: ReadStream;
    let statMock: AsyncFnMock<Stat>;

    beforeEach(() => {
      statMock = asyncFn();
      di.override(statInjectable, () => statMock);

      watchInstances = new Map();
      di.override(watchInjectable, () => (path) => {
        const fakeWatchInstance = getFakeWatchInstance();

        watchInstances.set(path, fakeWatchInstance);

        return fakeWatchInstance;
      });

      di.override(createReadFileStreamInjectable, () => (filePath) => {
        if (filePath !== "/foobar/config") {
          throw new Error(`unexpected file path "${filePath}"`);
        }

        if (!firstReadFoobarConfigSteam) {
          return firstReadFoobarConfigSteam = getFakeReadStream(filePath);
        }

        if (!secondReadFoobarConfigSteam) {
          return secondReadFoobarConfigSteam = getFakeReadStream(filePath);
        }

        return getFakeReadStream(filePath);
      });

      manager = di.inject(kubeconfigSyncManagerInjectable);
    });

    afterEach(() => {
      (firstReadFoobarConfigSteam as any) = undefined;
      (secondReadFoobarConfigSteam as any) = undefined;
    });

    it("should not find any entities", () => {
      expect(manager.source.get()).toEqual([]);
    });

    describe("when sync has started", () => {
      beforeEach(() => {
        manager.startSync();
      });

      it("should not find any entities", () => {
        expect(manager.source.get()).toEqual([]);
      });

      describe("when a file sync target for /foobar/config is added", () => {
        beforeEach(() => {
          kubeconfigSyncs.set("/foobar/config", {});
        });

        describe("when stat resolves as not a directory", () => {
          beforeEach(async () => {
            await statMock.resolveSpecific(["/foobar/config"], {
              isDirectory: () => false,
            } as Stats);
          });

          describe("when the watch emits that the file is added", () => {
            beforeEach(() => {
              strictGet(watchInstances, "/foobar/config").emit("add", "/foobar/config", {
                size: foobarConfig.length,
              } as Stats);
            });

            it("starts to read the file", () => {
              expect(firstReadFoobarConfigSteam).toBeDefined();
            });

            describe("when the data is read in", () => {
              beforeEach(() => {
                firstReadFoobarConfigSteam.emit("data", Buffer.from(foobarConfig));
                firstReadFoobarConfigSteam.emit("end");
                firstReadFoobarConfigSteam.emit("close");
              });

              it("should find a single entity", () => {
                expect(manager.source.get().length).toBe(1);
              });

              describe("when a folder sync target for /foobar is added", () => {
                beforeEach(() => {
                  kubeconfigSyncs.set("/foobar", {});
                });

                describe("when stat resolves as not a directory", () => {
                  beforeEach(async () => {
                    await statMock.resolveSpecific(["/foobar"], {
                      isDirectory: () => true,
                    } as Stats);
                  });

                  describe("when the watch emits that the file is added", () => {
                    beforeEach(() => {
                      strictGet(watchInstances, "/foobar").emit("add", "/foobar/config", {
                        size: foobarConfig.length,
                      } as Stats);
                    });

                    it("starts to read the file", () => {
                      expect(secondReadFoobarConfigSteam).toBeDefined();
                    });

                    describe("when the data is read in", () => {
                      beforeEach(() => {
                        secondReadFoobarConfigSteam.emit("data", Buffer.from(foobarConfig));
                        secondReadFoobarConfigSteam.emit("end");
                        secondReadFoobarConfigSteam.emit("close");
                      });

                      it("should still only find a single entity", () => {
                        expect(manager.source.get().length).toBe(1);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

const getFakeWatchInstance = (): Watcher<true> => {
  return Object.assign(new EventEmitter(), {
    close: jest.fn().mockImplementation(async () => {}),
  });
};

const getFakeReadStream = (path: string): ReadStream => {
  return Object.assign(new EventEmitter(), {
    path,
    close: () => {},
    push: () => true,
    read: () => {},
  }) as unknown as ReadStream;
};

const foobarConfig = JSON.stringify({
  clusters: [{
    name: "cluster-name",
    cluster: {
      server: "1.2.3.4",
    },
    skipTLSVerify: false,
  }],
  users: [{
    name: "user-name",
  }],
  contexts: [{
    name: "context-name",
    context: {
      cluster: "cluster-name",
      user: "user-name",
    },
  }, {
    name: "context-the-second",
    context: {
      cluster: "missing-cluster",
      user: "user-name",
    },
  }],
  currentContext: "foobar",
});
