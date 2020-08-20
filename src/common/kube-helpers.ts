import { app, remote } from "electron";
import { KubeConfig, V1Node, V1Pod } from "@kubernetes/client-node"
import fse, { ensureDirSync, readFile, writeFileSync } from "fs-extra";
import path from "path"
import os from "os"
import yaml from "js-yaml"
import logger from "../main/logger";

function resolveTilde(filePath: string) {
  if (filePath[0] === "~" && (filePath[1] === "/" || filePath.length === 1)) {
    return filePath.replace("~", os.homedir());
  }
  return filePath;
}

export function loadConfig(pathOrContent?: string): KubeConfig {
  const kc = new KubeConfig();

  if (fse.pathExistsSync(pathOrContent)) {
    kc.loadFromFile(path.resolve(resolveTilde(pathOrContent)));
  } else {
    kc.loadFromString(pathOrContent);
  }

  return kc
}

/**
 * KubeConfig is valid when there's at least one of each defined:
 * - User
 * - Cluster
 * - Context
 * @param config KubeConfig to check
 */
export function validateConfig(config: KubeConfig | string): KubeConfig {
  if (typeof config == "string") {
    config = loadConfig(config);
  }
  logger.debug(`validating kube config: ${JSON.stringify(config)}`)
  if (!config.users || config.users.length == 0) {
    throw new Error("No users provided in config")
  }
  if (!config.clusters || config.clusters.length == 0) {
    throw new Error("No clusters provided in config")
  }
  if (!config.contexts || config.contexts.length == 0) {
    throw new Error("No contexts provided in config")
  }

  return config
}

/**
 * Breaks kube config into several configs. Each context as it own KubeConfig object
 */
export function splitConfig(kubeConfig: KubeConfig): KubeConfig[] {
  const configs: KubeConfig[] = []
  if (!kubeConfig.contexts) {
    return configs;
  }
  kubeConfig.contexts.forEach(ctx => {
    const kc = new KubeConfig();
    kc.clusters = [kubeConfig.getCluster(ctx.cluster)].filter(n => n);
    kc.users = [kubeConfig.getUser(ctx.user)].filter(n => n)
    kc.contexts = [kubeConfig.getContextObject(ctx.name)].filter(n => n)
    kc.setCurrentContext(ctx.name);

    configs.push(kc);
  });
  return configs;
}

export function dumpConfigYaml(kubeConfig: Partial<KubeConfig>): string {
  const config = {
    apiVersion: "v1",
    kind: "Config",
    preferences: {},
    'current-context': kubeConfig.currentContext,
    clusters: kubeConfig.clusters.map(cluster => {
      return {
        name: cluster.name,
        cluster: {
          'certificate-authority-data': cluster.caData,
          'certificate-authority': cluster.caFile,
          server: cluster.server,
          'insecure-skip-tls-verify': cluster.skipTLSVerify
        }
      }
    }),
    contexts: kubeConfig.contexts.map(context => {
      return {
        name: context.name,
        context: {
          cluster: context.cluster,
          user: context.user,
          namespace: context.namespace
        }
      }
    }),
    users: kubeConfig.users.map(user => {
      return {
        name: user.name,
        user: {
          'client-certificate-data': user.certData,
          'client-certificate': user.certFile,
          'client-key-data': user.keyData,
          'client-key': user.keyFile,
          'auth-provider': user.authProvider,
          exec: user.exec,
          token: user.token,
          username: user.username,
          password: user.password
        }
      }
    })
  }

  logger.debug("Dumping KubeConfig:", config);

  // skipInvalid: true makes dump ignore undefined values
  return yaml.safeDump(config, { skipInvalid: true });
}

export function podHasIssues(pod: V1Pod) {
  // Logic adapted from dashboard
  const notReady = !!pod.status.conditions.find(condition => {
    return condition.type == "Ready" && condition.status !== "True"
  });

  return (
    notReady ||
    pod.status.phase !== "Running" ||
    pod.spec.priority > 500000 // We're interested in high prio pods events regardless of their running status
  )
}

export function getNodeWarningConditions(node: V1Node) {
  return node.status.conditions.filter(c =>
    c.status.toLowerCase() === "true" && c.type !== "Ready" && c.type !== "HostUpgrades"
  )
}

// Write kubeconfigs to "embedded" store, i.e. "/Users/ixrock/Library/Application Support/Lens/kubeconfigs"
export function saveConfigToAppFiles(clusterId: string, kubeConfig: KubeConfig | string): string {
  const userData = (app || remote.app).getPath("userData");
  const kubeConfigFile = path.join(userData, `kubeconfigs/${clusterId}`)
  const kubeConfigContents = typeof kubeConfig == "string" ? kubeConfig : dumpConfigYaml(kubeConfig);

  ensureDirSync(path.dirname(kubeConfigFile));
  writeFileSync(kubeConfigFile, kubeConfigContents);
  return kubeConfigFile;
}

export async function getKubeConfigLocal(): Promise<string> {
  try {
    const configFile = path.join(os.homedir(), '.kube', 'config');
    const file = await readFile(configFile, "utf8");
    const obj = yaml.safeLoad(file);
    if (obj.contexts) {
      obj.contexts = obj.contexts.filter((ctx: any) => ctx?.context?.cluster && ctx?.name)
    }
    return yaml.safeDump(obj);
  } catch (err) {
    logger.debug(`Cannot read local kube-config: ${err}`)
    return "";
  }
}
