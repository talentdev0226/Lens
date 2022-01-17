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

import { autoBind, noop, StorageHelper } from "../../../utils";
import { DockTabStorageState, DockTabStore } from "../dock-tab-store/dock-tab.store";
import { autorun, IReactionDisposer } from "mobx";
import type { DockStore, DockTab, TabId } from "../dock-store/dock.store";
import type { KubeObject } from "../../../../common/k8s-api/kube-object";
import { apiManager } from "../../../../common/k8s-api/api-manager";
import type { KubeObjectStore } from "../../../../common/k8s-api/kube-object.store";

export interface EditingResource {
  resource: string; // resource path, e.g. /api/v1/namespaces/default
  draft?: string; // edited draft in yaml
  firstDraft?: string;
}

interface Dependencies {
  dockStore: DockStore
  createStorage:<T> (storageKey: string, options: DockTabStorageState<T>) => StorageHelper<DockTabStorageState<T>>
}

export class EditResourceStore extends DockTabStore<EditingResource> {
  private watchers = new Map<TabId, IReactionDisposer>();

  constructor(protected dependencies: Dependencies) {
    super(dependencies, {
      storageKey: "edit_resource_store",
    });

    autoBind(this);
  }

  protected async init() {
    super.init();
    await this.storage.whenReady;

    autorun(() => {
      Array.from(this.data).forEach(([tabId, { resource }]) => {
        if (this.watchers.get(tabId)) {
          return;
        }
        this.watchers.set(tabId, autorun(() => {
          const store = apiManager.getStore(resource);

          if (store) {
            const isActiveTab = this.dependencies.dockStore.isOpen && this.dependencies.dockStore.selectedTabId === tabId;
            const obj = store.getByPath(resource);

            // preload resource for editing
            if (!obj && !store.isLoaded && !store.isLoading && isActiveTab) {
              store.loadFromPath(resource).catch(noop);
            }
            // auto-close tab when resource removed from store
            else if (!obj && store.isLoaded) {
              this.dependencies.dockStore.closeTab(tabId);
            }
          }
        }, {
          delay: 100, // make sure all kube-object stores are initialized
        }));
      });
    });
  }

  protected finalizeDataForSave({ draft, ...data }: EditingResource): EditingResource {
    return data; // skip saving draft to local-storage
  }

  isReady(tabId: TabId) {
    const tabDataReady = super.isReady(tabId);

    return Boolean(tabDataReady && this.getResource(tabId)); // ready to edit resource
  }

  getStore(tabId: TabId): KubeObjectStore<KubeObject> | undefined {
    return apiManager.getStore(this.getResourcePath(tabId));
  }

  getResource(tabId: TabId): KubeObject | undefined {
    return this.getStore(tabId)?.getByPath(this.getResourcePath(tabId));
  }

  getResourcePath(tabId: TabId): string | undefined {
    return this.getData(tabId)?.resource;
  }

  getTabByResource(object: KubeObject): DockTab {
    const [tabId] = Array.from(this.data).find(([, { resource }]) => {
      return object.selfLink === resource;
    }) || [];

    return this.dependencies.dockStore.getTabById(tabId);
  }

  clearInitialDraft(tabId: TabId): void {
    delete this.getData(tabId)?.firstDraft;
  }

  reset() {
    super.reset();
    Array.from(this.watchers).forEach(([tabId, dispose]) => {
      this.watchers.delete(tabId);
      dispose();
    });
  }
}
