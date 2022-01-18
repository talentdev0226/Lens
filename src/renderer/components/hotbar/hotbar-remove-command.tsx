/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { observer } from "mobx-react";
import { Select } from "../select";
import hotbarManagerInjectable from "../../../common/hotbar-store.injectable";
import { ConfirmDialog } from "../confirm-dialog";
import { withInjectables } from "@ogre-tools/injectable-react";
import commandOverlayInjectable from "../command-palette/command-overlay.injectable";
import type { Hotbar } from "../../../common/hotbar-types";

interface Dependencies {
  closeCommandOverlay: () => void;
  hotbarManager: {
    hotbars: Hotbar[];
    getById: (id: string) => Hotbar | undefined;
    remove: (hotbar: Hotbar) => void;
    getDisplayLabel: (hotbar: Hotbar) => string;
  };
}

const NonInjectedHotbarRemoveCommand = observer(({ closeCommandOverlay, hotbarManager }: Dependencies) => {
  const options = hotbarManager.hotbars.map(hotbar => ({
    value: hotbar.id,
    label: hotbarManager.getDisplayLabel(hotbar),
  }));

  const onChange = (id: string): void => {
    const hotbar = hotbarManager.getById(id);

    if (!hotbar) {
      return;
    }

    closeCommandOverlay();
    // TODO: make confirm dialog injectable
    ConfirmDialog.open({
      okButtonProps: {
        label: "Remove Hotbar",
        primary: false,
        accent: true,
      },
      ok: () => hotbarManager.remove(hotbar),
      message: (
        <div className="confirm flex column gaps">
          <p>
            Are you sure you want remove hotbar <b>{hotbar.name}</b>?
          </p>
        </div>
      ),
    });
  };

  return (
    <Select
      menuPortalTarget={null}
      onChange={(v) => onChange(v.value)}
      components={{ DropdownIndicator: null, IndicatorSeparator: null }}
      menuIsOpen={true}
      options={options}
      autoFocus={true}
      escapeClearsValue={false}
      placeholder="Remove hotbar"
    />
  );
});

export const HotbarRemoveCommand = withInjectables<Dependencies>(NonInjectedHotbarRemoveCommand, {
  getProps: (di, props) => ({
    closeCommandOverlay: di.inject(commandOverlayInjectable).close,
    hotbarManager: di.inject(hotbarManagerInjectable),
    ...props,
  }),
});
