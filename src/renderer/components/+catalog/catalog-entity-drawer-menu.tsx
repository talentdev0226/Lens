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

import React from "react";
import { cssNames } from "../../utils";
import { MenuActions, MenuActionsProps } from "../menu/menu-actions";
import type { CatalogEntity, CatalogEntityContextMenu, CatalogEntityContextMenuContext } from "../../api/catalog-entity";
import { observer } from "mobx-react";
import { makeObservable, observable } from "mobx";
import { navigate } from "../../navigation";
import { MenuItem } from "../menu";
import { ConfirmDialog } from "../confirm-dialog";
import { HotbarStore } from "../../../common/hotbar-store";
import { Icon } from "../icon";

export interface CatalogEntityDrawerMenuProps<T extends CatalogEntity> extends MenuActionsProps {
  entity: T | null | undefined;
}

@observer
export class CatalogEntityDrawerMenu<T extends CatalogEntity> extends React.Component<CatalogEntityDrawerMenuProps<T>> {
  @observable private contextMenu: CatalogEntityContextMenuContext;

  constructor(props: CatalogEntityDrawerMenuProps<T>) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    this.contextMenu = {
      menuItems: [],
      navigate: (url: string) => navigate(url)
    };
    this.props.entity?.onContextMenuOpen(this.contextMenu);
  }

  onMenuItemClick(menuItem: CatalogEntityContextMenu) {
    if (menuItem.confirm) {
      ConfirmDialog.open({
        okButtonProps: {
          primary: false,
          accent: true,
        },
        ok: () => {
          menuItem.onClick();
        },
        message: menuItem.confirm.message
      });
    } else {
      menuItem.onClick();
    }
  }

  addToHotbar(entity: CatalogEntity): void {
    HotbarStore.getInstance().addToHotbar(entity);
  }

  getMenuItems(entity: T): React.ReactChild[] {
    if (!entity) {
      return [];
    }

    const items: React.ReactChild[] = [];

    for (const menuItem of this.contextMenu.menuItems) {
      if (!menuItem.icon) {
        continue;
      }

      const key = menuItem.icon.includes("<svg") ? "svg" : "material";

      items.push(
        <MenuItem key={menuItem.title} onClick={() => this.onMenuItemClick(menuItem)}>
          <Icon
            title={menuItem.title}
            {...{ [key]: menuItem.icon }}
          />
        </MenuItem>
      );
    }

    items.push(
      <MenuItem key="add-to-hotbar" onClick={() => this.addToHotbar(entity) }>
        <Icon material="playlist_add" small title="Add to Hotbar" />
      </MenuItem>
    );

    return items;
  }

  render() {
    if (!this.contextMenu) {
      return null;
    }

    const { className, entity, ...menuProps } = this.props;

    return (
      <MenuActions
        className={cssNames("CatalogEntityDrawerMenu", className)}
        toolbar
        {...menuProps}
      >
        {this.getMenuItems(entity)}
      </MenuActions>
    );
  }
}
