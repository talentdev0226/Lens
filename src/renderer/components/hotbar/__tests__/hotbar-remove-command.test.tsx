/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/extend-expect";
import { HotbarRemoveCommand } from "../hotbar-remove-command";
import { fireEvent } from "@testing-library/react";
import React from "react";
import type { DiContainer } from "@ogre-tools/injectable";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import type { DiRender } from "../../test-utils/renderFor";
import { renderFor } from "../../test-utils/renderFor";
import hotbarStoreInjectable from "../../../../common/hotbars/store.injectable";
import { ConfirmDialog } from "../../confirm-dialog";
import mockFs from "mock-fs";
import directoryForUserDataInjectable from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import getConfigurationFileModelInjectable from "../../../../common/get-configuration-file-model/get-configuration-file-model.injectable";
import type { HotbarStore } from "../../../../common/hotbars/store";
import storesAndApisCanBeCreatedInjectable from "../../../stores-apis-can-be-created.injectable";

const mockHotbars: Partial<Record<string, any>> = {
  "1": {
    id: "1",
    name: "Default",
    items: [],
  },
};

jest.mock("electron", () => ({
  ipcRenderer: {
    on: jest.fn(),
    invoke: jest.fn(),
  },
}));

describe("<HotbarRemoveCommand />", () => {
  let di: DiContainer;
  let render: DiRender;

  beforeEach(() => {
    di = getDiForUnitTesting({ doGeneralOverrides: true });

    mockFs();

    di.override(storesAndApisCanBeCreatedInjectable, () => true);
    di.override(directoryForUserDataInjectable, () => "some-directory-for-user-data");

    di.permitSideEffects(hotbarStoreInjectable);
    di.permitSideEffects(getConfigurationFileModelInjectable);

    render = renderFor(di);
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("renders w/o errors", () => {
    di.override(hotbarStoreInjectable, () => ({
      hotbars: [mockHotbars["1"]],
      getById: (id: string) => mockHotbars[id],
      remove: () => {
      },
      hotbarIndex: () => 0,
      getDisplayLabel: () => "1: Default",
    }) as unknown as HotbarStore);

    const { container } = render(<HotbarRemoveCommand />);

    expect(container).toBeInstanceOf(HTMLElement);
  });

  it("calls remove if you click on the entry", () => {
    const removeMock = jest.fn();

    di.override(hotbarStoreInjectable, () => ({
      hotbars: [mockHotbars["1"]],
      getById: (id: string) => mockHotbars[id],
      remove: removeMock,
      hotbarIndex: () => 0,
      getDisplayLabel: () => "1: Default",
    }) as unknown as HotbarStore);

    const { getByText } = render(
      <>
        <HotbarRemoveCommand />
        <ConfirmDialog />
      </>,
    );

    fireEvent.click(getByText("1: Default"));
    fireEvent.click(getByText("Remove Hotbar"));

    expect(removeMock).toHaveBeenCalled();
  });
});
