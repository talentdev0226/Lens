/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import tempy from "tempy";
import fse from "fs-extra";
import * as yaml from "js-yaml";
import { toCamelCase } from "../../common/utils/camelCase";
import { execHelm } from "./exec";
import type { JsonValue } from "type-fest";
import { isObject, json } from "../../common/utils";

export async function listReleases(pathToKubeconfig: string, namespace?: string): Promise<Record<string, any>[]> {
  const args = [
    "ls",
    "--all",
    "--output", "json",
  ];

  if (namespace) {
    args.push("-n", namespace);
  } else {
    args.push("--all-namespaces");
  }

  args.push("--kubeconfig", pathToKubeconfig);

  const output = json.parse(await execHelm(args));

  if (!Array.isArray(output) || output.length == 0) {
    return [];
  }

  return output.filter(isObject).map(toCamelCase);
}


export async function installChart(chart: string, values: JsonValue, name: string | undefined = "", namespace: string, version: string, kubeconfigPath: string) {
  const valuesFilePath = tempy.file({ name: "values.yaml" });

  await fse.writeFile(valuesFilePath, yaml.dump(values));

  const args = ["install"];

  if (name) {
    args.push(name);
  }

  args.push(
    chart,
    "--version", version,
    "--values", valuesFilePath,
    "--namespace", namespace,
    "--kubeconfig", kubeconfigPath,
  );

  if (!name) {
    args.push("--generate-name");
  }

  try {
    const output = await execHelm(args);
    const releaseName = output.split("\n")[0].split(" ")[1].trim();

    return {
      log: output,
      release: {
        name: releaseName,
        namespace,
      },
    };
  } finally {
    await fse.unlink(valuesFilePath);
  }
}

export async function deleteRelease(name: string, namespace: string, kubeconfigPath: string) {
  return execHelm([
    "delete",
    name,
    "--namespace", namespace,
    "--kubeconfig", kubeconfigPath,
  ]);
}

interface GetValuesOptions {
  namespace: string;
  all?: boolean;
  kubeconfigPath: string;
}

export async function getValues(name: string, { namespace, all = false, kubeconfigPath }: GetValuesOptions) {
  const args = [
    "get",
    "values",
    name,
  ];

  if (all) {
    args.push("--all");
  }

  args.push(
    "--output", "yaml",
    "--namespace", namespace,
    "--kubeconfig", kubeconfigPath,
  );

  return execHelm(args);
}

export async function getHistory(name: string, namespace: string, kubeconfigPath: string) {
  return json.parse(await execHelm([
    "history",
    name,
    "--output", "json",
    "--namespace", namespace,
    "--kubeconfig", kubeconfigPath,
  ]));
}

export async function rollback(name: string, namespace: string, revision: number, kubeconfigPath: string) {
  await execHelm([
    "rollback",
    name,
    `${revision}`,
    "--namespace", namespace,
    "--kubeconfig", kubeconfigPath,
  ]);
}
