/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { TopBar } from "./top-bar";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import type { ConfigurableDependencyInjectionContainer } from "@ogre-tools/injectable";
import { DiRender, renderFor } from "../../test-utils/renderFor";
import topBarItemsInjectable from "./top-bar-items/top-bar-items.injectable";
import { computed } from "mobx";
import directoryForUserDataInjectable
  from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import mockFs from "mock-fs";

jest.mock("../../../../common/vars", () => {
  const SemVer = require("semver").SemVer;

  const versionStub = new SemVer("1.0.0");

  return {
    isMac: true,
    appSemVer: versionStub,
  };
});

jest.mock(
  "electron",
  () => ({
    ipcRenderer: {
      on: jest.fn(
        (channel: string, listener: (event: any, ...args: any[]) => void) => {
          if (channel === "history:can-go-back") {
            listener({}, true);
          }

          if (channel === "history:can-go-forward") {
            listener({}, true);
          }
        },
      ),
    },
  }),
);

jest.mock("../../+catalog", () => ({
  previousActiveTab: jest.fn(),
}));

const goBack = jest.fn();
const goForward = jest.fn();

jest.mock("@electron/remote", () => {
  return {
    webContents: {
      getAllWebContents: () => {
        return [{
          getType: () => "window",
          goBack,
          goForward,
        }];
      },
    },
    getCurrentWindow: () => jest.fn(),
  };
});

describe("<TopBar/>", () => {
  let di: ConfigurableDependencyInjectionContainer;
  let render: DiRender;

  beforeEach(async () => {
    di = getDiForUnitTesting({ doGeneralOverrides: true });

    mockFs();

    di.override(directoryForUserDataInjectable, () => "some-directory-for-user-data");

    await di.runSetups();

    render = renderFor(di);
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("renders w/o errors", () => {
    const { container } = render(<TopBar/>);

    expect(container).toBeInstanceOf(HTMLElement);
  });

  it("renders home button", async () => {
    const { getByTestId } = render(<TopBar/>);

    expect(await getByTestId("home-button")).toBeInTheDocument();
  });

  it("renders history arrows", async () => {
    const { getByTestId } = render(<TopBar/>);

    expect(await getByTestId("history-back")).toBeInTheDocument();
    expect(await getByTestId("history-forward")).toBeInTheDocument();
  });

  it("enables arrow by ipc event", async () => {
    const { getByTestId } = render(<TopBar/>);

    expect(await getByTestId("history-back")).not.toHaveClass("disabled");
    expect(await getByTestId("history-forward")).not.toHaveClass("disabled");
  });

  it("triggers browser history back and forward", async () => {
    const { getByTestId } = render(<TopBar/>);

    const prevButton = await getByTestId("history-back");
    const nextButton = await getByTestId("history-forward");

    fireEvent.click(prevButton);

    expect(goBack).toBeCalled();

    fireEvent.click(nextButton);

    expect(goForward).toBeCalled();
  });

  it("renders items", async () => {
    const testId = "testId";
    const text = "an item";

    di.override(topBarItemsInjectable, () => computed(() => [
      {
        components: {
          Item: () => <span data-testid={testId}>{text}</span>,
        },
      },
    ]));

    const { getByTestId } = render(<TopBar/>);

    expect(await getByTestId(testId)).toHaveTextContent(text);
  });

  it("doesn't show windows title buttons", () => {
    const { queryByTestId } = render(<TopBar/>);

    expect(queryByTestId("window-menu")).not.toBeInTheDocument();
    expect(queryByTestId("window-minimize")).not.toBeInTheDocument();
    expect(queryByTestId("window-maximize")).not.toBeInTheDocument();
    expect(queryByTestId("window-close")).not.toBeInTheDocument();
  });
});
