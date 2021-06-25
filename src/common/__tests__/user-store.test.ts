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

import { Console } from "console";

console = new Console(process.stdout, process.stderr);

import mockFs from "mock-fs";

jest.mock("electron", () => {
  return {
    app: {
      getVersion: () => "99.99.99",
      getPath: () => "tmp",
      getLocale: () => "en",
      setLoginItemSettings: (): void => void 0,
    }
  };
});

import { UserStore } from "../user-store";
import { SemVer } from "semver";
import electron from "electron";
import { stdout, stderr } from "process";
import { beforeEachWrapped } from "../../../integration/helpers/utils";

console = new Console(stdout, stderr);

describe("user store tests", () => {
  describe("for an empty config", () => {
    beforeEachWrapped(() => {
      UserStore.resetInstance();
      mockFs({ tmp: { "config.json": "{}", "kube_config": "{}" } });

      (UserStore.createInstance() as any).refreshNewContexts = jest.fn(() => Promise.resolve());

      UserStore.getInstance();
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("allows setting and retrieving lastSeenAppVersion", () => {
      const us = UserStore.getInstance();

      us.lastSeenAppVersion = "1.2.3";
      expect(us.lastSeenAppVersion).toBe("1.2.3");
    });

    it("allows setting and getting preferences", () => {
      const us = UserStore.getInstance();

      us.httpsProxy = "abcd://defg";

      expect(us.httpsProxy).toBe("abcd://defg");
      expect(us.colorTheme).toBe(UserStore.defaultTheme);

      us.colorTheme = "light";
      expect(us.colorTheme).toBe("light");
    });

    it("correctly resets theme to default value", async () => {
      const us = UserStore.getInstance();

      us.colorTheme = "some other theme";
      us.resetTheme();
      expect(us.colorTheme).toBe(UserStore.defaultTheme);
    });

    it("correctly calculates if the last seen version is an old release", () => {
      const us = UserStore.getInstance();

      expect(us.isNewVersion).toBe(true);

      us.lastSeenAppVersion = (new SemVer(electron.app.getVersion())).inc("major").format();
      expect(us.isNewVersion).toBe(false);
    });
  });

  describe("migrations", () => {
    beforeEachWrapped(() => {
      UserStore.resetInstance();
      mockFs({
        "tmp": {
          "config.json": JSON.stringify({
            user: { username: "foobar" },
            preferences: { colorTheme: "light" },
            lastSeenAppVersion: "1.2.3"
          })
        }
      });

      UserStore.createInstance();
    });

    afterEach(() => {
      mockFs.restore();
    });

    it("sets last seen app version to 0.0.0", () => {
      const us = UserStore.getInstance();

      expect(us.lastSeenAppVersion).toBe("0.0.0");
    });
  });
});
