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
import { fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { TopBar } from "./top-bar";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import type { ConfigurableDependencyInjectionContainer } from "@ogre-tools/injectable";
import { DiRender, renderFor } from "../../test-utils/renderFor";
import topBarItemsInjectable from "./top-bar-items/top-bar-items.injectable";
import { computed } from "mobx";

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
    app: {
      getPath: () => "tmp",
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

  beforeEach(() => {
    di = getDiForUnitTesting();

    render = renderFor(di);
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
