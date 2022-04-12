/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import type { RenderResult } from "@testing-library/react";
import type { ApplicationBuilder } from "../../renderer/components/test-utils/get-application-builder";
import { getApplicationBuilder } from "../../renderer/components/test-utils/get-application-builder";
import userStoreInjectable from "../../common/user-store/user-store.injectable";
import type { UserStore } from "../../common/user-store";
import themeStoreInjectable from "../../renderer/theme-store.injectable";
import type { ThemeStore } from "../../renderer/theme.store";
import { observable } from "mobx";
import defaultShellInjectable from "../../renderer/components/+preferences/default-shell.injectable";

describe("preferences - navigation to terminal preferences", () => {
  let applicationBuilder: ApplicationBuilder;

  beforeEach(() => {
    applicationBuilder = getApplicationBuilder();

    applicationBuilder.beforeSetups(({ rendererDi }) => {
      const userStoreStub = {
        extensionRegistryUrl: { customUrl: "some-custom-url" },
        syncKubeconfigEntries: observable.map(),
        terminalConfig: { fontSize: 42 },
      } as unknown as UserStore;

      rendererDi.override(userStoreInjectable, () => userStoreStub);

      rendererDi.override(defaultShellInjectable, () => "some-default-shell");

      const themeStoreStub = ({ themeOptions: [] }) as unknown as ThemeStore;

      rendererDi.override(themeStoreInjectable, () => themeStoreStub);
    });
  });

  describe("given in preferences, when rendered", () => {
    let rendered: RenderResult;

    beforeEach(async () => {
      applicationBuilder.beforeRender(() => {
        applicationBuilder.preferences.navigate();
      });

      rendered = await applicationBuilder.render();
    });

    it("renders", () => {
      expect(rendered.container).toMatchSnapshot();
    });

    it("does not show terminal preferences yet", () => {
      const page = rendered.queryByTestId("terminal-preferences-page");

      expect(page).toBeNull();
    });

    describe("when navigating to terminal preferences using navigation", () => {
      beforeEach(() => {
        applicationBuilder.preferences.navigation.click("terminal");
      });

      it("renders", () => {
        expect(rendered.container).toMatchSnapshot();
      });

      it("shows terminal preferences", () => {
        const page = rendered.getByTestId("terminal-preferences-page");

        expect(page).not.toBeNull();
      });
    });
  });
});
