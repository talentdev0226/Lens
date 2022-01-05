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

import { computed, makeObservable, observable, reaction } from "mobx";
import type { CatalogEntityRegistry } from "../../../api/catalog-entity-registry";
import type { CatalogEntity } from "../../../api/catalog-entity";
import { ItemStore } from "../../../../common/item.store";
import { CatalogCategory, catalogCategoryRegistry } from "../../../../common/catalog";
import { autoBind, disposer } from "../../../../common/utils";

interface Dependencies {
  registry: CatalogEntityRegistry
}

export class CatalogEntityStore extends ItemStore<CatalogEntity> {
  constructor(private dependencies: Dependencies) {
    super();
    makeObservable(this);
    autoBind(this);
  }

  @observable activeCategory?: CatalogCategory;
  @observable selectedItemId?: string;

  @computed get entities() {
    if (!this.activeCategory) {
      return this.dependencies.registry.filteredItems;
    }

    return this.dependencies.registry.getItemsForCategory(this.activeCategory, { filtered: true });
  }

  @computed get selectedItem() {
    return this.entities.find(e => e.getId() === this.selectedItemId);
  }

  watch() {
    return disposer(
      reaction(() => this.entities, () => this.loadAll()),
      reaction(() => this.activeCategory, () => this.loadAll(), { delay: 100 }),
    );
  }

  loadAll() {
    if (this.activeCategory) {
      this.activeCategory.emit("load");
    } else {
      for (const category of catalogCategoryRegistry.items) {
        category.emit("load");
      }
    }

    // concurrency is true to fix bug if catalog filter is removed and added at the same time
    return this.loadItems(() => this.entities, undefined, true);
  }

  onRun(entity: CatalogEntity): void {
    this.dependencies.registry.onRun(entity);
  }
}
