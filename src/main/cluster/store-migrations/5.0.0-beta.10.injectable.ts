/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { clusterStoreMigrationInjectionToken } from "../../../common/cluster-store/migration-token";
import type { ClusterModel } from "../../../common/cluster-types";
import readJsonSyncInjectable from "../../../common/fs/read-json-sync.injectable";
import joinPathsInjectable from "../../../common/path/join-paths.injectable";
import { isErrnoException } from "../../../common/utils";

interface Pre500WorkspaceStoreModel {
  workspaces: {
    id: string;
    name: string;
  }[];
}

const v500Beta10ClusterStoreMigrationInjectable = getInjectable({
  id: "v5.0.0-beta.10-cluster-store-migration",
  instantiate: (di) => {
    const userDataPath = di.inject(directoryForUserDataInjectable);
    const joinPaths = di.inject(joinPathsInjectable);
    const readJsonSync = di.inject(readJsonSyncInjectable);

    return {
      version: "5.0.0-beta.10",
      run(store) {
        try {
          const workspaceData: Pre500WorkspaceStoreModel = readJsonSync(joinPaths(userDataPath, "lens-workspace-store.json"));
          const workspaces = new Map<string, string>(); // mapping from WorkspaceId to name

          for (const { id, name } of workspaceData.workspaces) {
            workspaces.set(id, name);
          }

          const clusters = (store.get("clusters") ?? []) as ClusterModel[];

          for (const cluster of clusters) {
            if (cluster.workspace) {
              const workspace = workspaces.get(cluster.workspace);

              if (workspace) {
                (cluster.labels ??= {}).workspace = workspace;
              }
            }
          }

          store.set("clusters", clusters);
        } catch (error) {
          if (isErrnoException(error) && !(error.code === "ENOENT" && error.path?.endsWith("lens-workspace-store.json"))) {
            // ignore lens-workspace-store.json being missing
            throw error;
          }
        }
      },
    };
  },
  injectionToken: clusterStoreMigrationInjectionToken,
});

export default v500Beta10ClusterStoreMigrationInjectable;
