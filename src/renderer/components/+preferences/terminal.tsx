/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import type { UserStore } from "../../../common/user-store";
import { SubTitle } from "../layout/sub-title";
import { Input } from "../input";
import { Switch } from "../switch";
import { Select, type SelectOption } from "../select";
import type { ThemeStore } from "../../themes/store";
import { Preferences } from "./preferences";
import { withInjectables } from "@ogre-tools/injectable-react";
import userStoreInjectable from "../../../common/user-store/user-store.injectable";
import themeStoreInjectable from "../../themes/store.injectable";
import defaultShellInjectable from "./default-shell.injectable";
import logger from "../../../common/logger";

interface Dependencies {
  userStore: UserStore;
  themeStore: ThemeStore;
  defaultShell: string;
}

const NonInjectedTerminal = observer((
  {
    userStore,
    themeStore,
    defaultShell,
  }: Dependencies) => {
  const themeOptions = [
    {
      value: "", // TODO: replace with a sentinal value that isn't string (and serialize it differently)
      label: "Match Lens Theme",
    },
    ...Array.from(themeStore.themes, ([themeId, { name }]) => ({
      value: themeId,
      label: name,
    })),
  ];

  // fonts must be declared in `fonts.scss` and at `template.html` (if early-preloading required)
  const supportedCustomFonts: SelectOption<string>[] = [
    "RobotoMono", "Anonymous Pro", "IBM Plex Mono", "JetBrains Mono", "Red Hat Mono",
    "Source Code Pro", "Space Mono", "Ubuntu Mono",
  ].map(customFont => {
    const { fontFamily, fontSize } = userStore.terminalConfig;

    return {
      label: <span style={{ fontFamily: customFont, fontSize }}>{customFont}</span>,
      value: customFont,
      isSelected: fontFamily === customFont,
    };
  });

  const onFontFamilyChange = action(({ value: fontFamily }: SelectOption<string>) => {
    logger.info(`setting terminal font to ${fontFamily}`);

    userStore.terminalConfig.fontFamily = fontFamily; // save to external storage
  });

  return (
    <Preferences data-testid="terminal-preferences-page">
      <section>
        <h2>Terminal</h2>

        <section id="shell">
          <SubTitle title="Terminal Shell Path" />
          <Input
            theme="round-black"
            placeholder={defaultShell}
            value={userStore.shell ?? ""}
            onChange={(value) => userStore.shell = value}
          />
        </section>

        <section id="terminalSelection">
          <SubTitle title="Terminal copy & paste" />
          <Switch
            checked={userStore.terminalCopyOnSelect}
            onChange={() => userStore.terminalCopyOnSelect = !userStore.terminalCopyOnSelect}
          >
            Copy on select and paste on right-click
          </Switch>
        </section>

        <section id="terminalTheme">
          <SubTitle title="Terminal theme" />
          <Select
            id="terminal-theme-input"
            themeName="lens"
            options={themeOptions}
            value={userStore.terminalTheme}
            onChange={option => userStore.terminalTheme = option?.value ?? ""}
          />
        </section>

        <section>
          <SubTitle title="Font size" />
          <Input
            theme="round-black"
            type="number"
            min={10}
            max={50}
            defaultValue={userStore.terminalConfig.fontSize.toString()}
            onChange={(value) => userStore.terminalConfig.fontSize = Number(value)}
          />
        </section>
        <section>
          <SubTitle title="Font family" />
          <Select
            themeName="lens"
            controlShouldRenderValue
            value={userStore.terminalConfig.fontFamily}
            options={supportedCustomFonts}
            onChange={onFontFamilyChange as any}
          />
        </section>
      </section>
    </Preferences>
  );
});

export const Terminal = withInjectables<Dependencies>(
  NonInjectedTerminal,

  {
    getProps: (di) => ({
      userStore: di.inject(userStoreInjectable),
      themeStore: di.inject(themeStoreInjectable),
      defaultShell: di.inject(defaultShellInjectable),
    }),
  },
);

