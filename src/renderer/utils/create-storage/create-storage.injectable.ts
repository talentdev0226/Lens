/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import directoryForLensLocalStorageInjectable from "../../../common/directory-for-lens-local-storage/directory-for-lens-local-storage.injectable";
import { createStorage } from "./create-storage";
import readJsonFileInjectable from "../../../common/fs/read-json-file.injectable";
import writeJsonFileInjectable from "../../../common/fs/write-json-file.injectable";
import { observable } from "mobx";
import loggerInjectable from "../../../common/logger.injectable";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import storageSaveDelayInjectable from "./storage-save-delay.injectable";
import joinPathsInjectable from "../../../common/path/join-paths.injectable";

const createStorageInjectable = getInjectable({
  id: "create-storage",

  instantiate: (di) => createStorage({
    storage: observable({
      initialized: false,
      loaded: false,
      data: {},
    }),
    readJsonFile: di.inject(readJsonFileInjectable),
    writeJsonFile: di.inject(writeJsonFileInjectable),
    logger: di.inject(loggerInjectable),
    directoryForLensLocalStorage: di.inject(directoryForLensLocalStorageInjectable),
    joinPaths: di.inject(joinPathsInjectable),
    hostedClusterId: di.inject(hostedClusterIdInjectable),
    saveDelay: di.inject(storageSaveDelayInjectable),
  }),
});

export default createStorageInjectable;
