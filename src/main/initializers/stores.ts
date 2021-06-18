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

import { HotbarStore } from "../../common/hotbar-store";
import { ClusterStore } from "../../common/cluster-store";
import { UserStore } from "../../common/user-store";
import { ExtensionsStore } from "../../extensions/extensions-store";
import { FilesystemProvisionerStore } from "../extension-filesystem";
import { WeblinkStore } from "../../common/weblink-store";
import logger from "../logger";

export async function initializeStores() {
  const userStore = UserStore.createInstance();
  const clusterStore = ClusterStore.createInstance();
  const hotbarStore = HotbarStore.createInstance();
  const extensionsStore = ExtensionsStore.createInstance();
  const filesystemStore = FilesystemProvisionerStore.createInstance();
  const weblinkStore = WeblinkStore.createInstance();

  logger.info("💾 Loading stores");
  // preload
  await Promise.all([
    userStore.load(),
    clusterStore.load(),
    hotbarStore.load(),
    extensionsStore.load(),
    filesystemStore.load(),
    weblinkStore.load()
  ]);
}
