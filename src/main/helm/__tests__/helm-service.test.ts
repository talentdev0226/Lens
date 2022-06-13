/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import listHelmChartsInjectable from "../helm-service/list-helm-charts.injectable";
import getActiveHelmRepositoriesInjectable from "../repositories/get-active-helm-repositories/get-active-helm-repositories.injectable";
import type { AsyncResult } from "../../../common/utils/async-result";
import type { HelmRepo } from "../../../common/helm/helm-repo";

jest.mock("../helm-chart-manager");

describe("Helm Service tests", () => {
  let listHelmCharts: () => Promise<any>;
  let getActiveHelmRepositoriesMock: jest.Mock<Promise<AsyncResult<HelmRepo[]>>>;

  beforeEach(() => {
    const di = getDiForUnitTesting({ doGeneralOverrides: true });

    getActiveHelmRepositoriesMock = jest.fn();

    di.override(getActiveHelmRepositoriesInjectable, () => getActiveHelmRepositoriesMock);

    di.unoverride(listHelmChartsInjectable);
    di.permitSideEffects(listHelmChartsInjectable);

    listHelmCharts = di.inject(listHelmChartsInjectable);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("list charts with deprecated entries", async () => {
    getActiveHelmRepositoriesMock.mockReturnValue(
      Promise.resolve({
        callWasSuccessful: true,

        response: [
          { name: "stable", url: "stableurl" },
          { name: "experiment", url: "experimenturl" },
        ],
      }),
    );

    const charts = await listHelmCharts();

    expect(charts).toEqual({
      stable: {
        "apm-server": [
          {
            apiVersion: "3.0.0",
            name: "apm-server",
            version: "2.1.7",
            repo: "stable",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "apm-server",
            version: "2.1.6",
            repo: "stable",
            digest: "test",
            created: "now",
          },
        ],
        "invalid-semver": [
          {
            apiVersion: "3.0.0",
            name: "weird-versioning",
            version: "v4.4.0",
            repo: "stable",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "weird-versioning",
            version: "v4.3.0",
            repo: "stable",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "weird-versioning",
            version: "I am not semver",
            repo: "stable",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "weird-versioning",
            version: "I am not semver but more",
            repo: "stable",
            digest: "test",
            created: "now",
          },
        ],
        "redis": [
          {
            apiVersion: "3.0.0",
            name: "apm-server",
            version: "1.0.0",
            repo: "stable",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "apm-server",
            version: "0.0.9",
            repo: "stable",
            digest: "test",
            created: "now",
          },
        ],
      },
      experiment: {
        "fairwind": [
          {
            apiVersion: "3.0.0",
            name: "fairwind",
            version: "0.0.2",
            repo: "experiment",
            digest: "test",
            deprecated: true,
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "fairwind",
            version: "0.0.1",
            repo: "experiment",
            digest: "test",
            created: "now",
          },
        ],
      },
    });
  });

  it("list charts sorted by version in descending order", async () => {
    getActiveHelmRepositoriesMock.mockReturnValue(
      Promise.resolve({
        callWasSuccessful: true,
        response: [{ name: "bitnami", url: "bitnamiurl" }],
      }),
    );

    const charts = await listHelmCharts();

    expect(charts).toEqual({
      bitnami: {
        "hotdog": [
          {
            apiVersion: "3.0.0",
            name: "hotdog",
            version: "1.0.2",
            repo: "bitnami",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "hotdog",
            version: "1.0.1",
            repo: "bitnami",
            digest: "test",
            created: "now",
          },
        ],
        "pretzel": [
          {
            apiVersion: "3.0.0",
            name: "pretzel",
            version: "1.0.1",
            repo: "bitnami",
            digest: "test",
            created: "now",
          },
          {
            apiVersion: "3.0.0",
            name: "pretzel",
            version: "1.0",
            repo: "bitnami",
            digest: "test",
            created: "now",
          },
        ],
      },
    });
  });
});
