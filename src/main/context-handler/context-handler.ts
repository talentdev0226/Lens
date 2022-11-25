/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { PrometheusProvider, PrometheusService } from "../prometheus/provider";
import type { ClusterPrometheusPreferences } from "../../common/cluster-types";
import type { Cluster } from "../../common/cluster/cluster";
import type httpProxy from "http-proxy";
import type { UrlWithStringQuery } from "url";
import url from "url";
import { CoreV1Api } from "@kubernetes/client-node";
import type { KubeAuthProxy } from "../kube-auth-proxy/kube-auth-proxy";
import type { CreateKubeAuthProxy } from "../kube-auth-proxy/create-kube-auth-proxy.injectable";
import type { GetPrometheusProviderByKind } from "../prometheus/get-by-kind.injectable";
import type { IComputedValue } from "mobx";
import type { Logger } from "../../common/logger";

export interface PrometheusDetails {
  prometheusPath: string;
  provider: PrometheusProvider;
}

interface PrometheusServicePreferences {
  namespace: string;
  service: string;
  port: number;
  prefix: string;
}

export interface ContextHandlerDependencies {
  createKubeAuthProxy: CreateKubeAuthProxy;
  getPrometheusProviderByKind: GetPrometheusProviderByKind;
  readonly authProxyCa: string;
  readonly prometheusProviders: IComputedValue<PrometheusProvider[]>;
  readonly logger: Logger;
}

export interface ClusterContextHandler {
  readonly clusterUrl: UrlWithStringQuery;
  setupPrometheus(preferences?: ClusterPrometheusPreferences): void;
  getPrometheusDetails(): Promise<PrometheusDetails>;
  resolveAuthProxyUrl(): Promise<string>;
  resolveAuthProxyCa(): string;
  getApiTarget(isLongRunningRequest?: boolean): Promise<httpProxy.ServerOptions>;
  restartServer(): Promise<void>;
  ensureServer(): Promise<void>;
  stopServer(): void;
}

export class ContextHandler implements ClusterContextHandler {
  public readonly clusterUrl: UrlWithStringQuery;
  protected kubeAuthProxy?: KubeAuthProxy;
  protected apiTarget?: httpProxy.ServerOptions;
  protected prometheusProvider?: string;
  protected prometheus?: PrometheusServicePreferences;

  constructor(private readonly dependencies: ContextHandlerDependencies, protected readonly cluster: Cluster) {
    this.clusterUrl = url.parse(cluster.apiUrl);
    this.setupPrometheus(cluster.preferences);
  }

  public setupPrometheus(preferences: ClusterPrometheusPreferences = {}) {
    this.prometheusProvider = preferences.prometheusProvider?.type;
    this.prometheus = preferences.prometheus;
  }

  public async getPrometheusDetails(): Promise<PrometheusDetails> {
    const service = await this.getPrometheusService();
    const prometheusPath = this.ensurePrometheusPath(service);
    const provider = this.ensurePrometheusProvider(service);

    return { prometheusPath, provider };
  }

  protected ensurePrometheusPath({ service, namespace, port }: PrometheusService): string {
    return `${namespace}/services/${service}:${port}`;
  }

  protected ensurePrometheusProvider(service: PrometheusService): PrometheusProvider {
    if (!this.prometheusProvider) {
      this.dependencies.logger.info(`[CONTEXT-HANDLER]: using ${service.kind} as prometheus provider for clusterId=${this.cluster.id}`);
      this.prometheusProvider = service.kind;
    }

    return this.dependencies.getPrometheusProviderByKind(this.prometheusProvider);
  }

  protected listPotentialProviders(): PrometheusProvider[] {
    const provider = this.prometheusProvider && this.dependencies.getPrometheusProviderByKind(this.prometheusProvider);

    if (provider) {
      return [provider];
    }

    return this.dependencies.prometheusProviders.get();
  }

  protected async getPrometheusService(): Promise<PrometheusService> {
    this.setupPrometheus(this.cluster.preferences);

    if (this.prometheus && this.prometheusProvider) {
      return {
        kind: this.prometheusProvider,
        namespace: this.prometheus.namespace,
        service: this.prometheus.service,
        port: this.prometheus.port,
      };
    }

    const providers = this.listPotentialProviders();
    const proxyConfig = await this.cluster.getProxyKubeconfig();
    const apiClient = proxyConfig.makeApiClient(CoreV1Api);
    const potentialServices = await Promise.allSettled(
      providers.map(provider => provider.getPrometheusService(apiClient)),
    );
    const errors = [];

    for (const res of potentialServices) {
      switch (res.status) {
        case "rejected":
          errors.push(res.reason);
          break;

        case "fulfilled":
          if (res.value) {
            return res.value;
          }
      }
    }

    throw new Error("No Prometheus service found", { cause: errors });
  }

  async resolveAuthProxyUrl(): Promise<string> {
    const kubeAuthProxy = await this.ensureServerHelper();

    return `https://127.0.0.1:${kubeAuthProxy.port}${kubeAuthProxy.apiPrefix}`;
  }

  resolveAuthProxyCa() {
    return this.dependencies.authProxyCa;
  }

  async getApiTarget(isLongRunningRequest = false): Promise<httpProxy.ServerOptions> {
    const timeout = isLongRunningRequest ? 4 * 60 * 60_000 : 30_000; // 4 hours for long running request, 30 seconds for the rest

    if (isLongRunningRequest) {
      return this.newApiTarget(timeout);
    }

    return this.apiTarget ??= await this.newApiTarget(timeout);
  }

  protected async newApiTarget(timeout: number): Promise<httpProxy.ServerOptions> {
    const kubeAuthProxy = await this.ensureServerHelper();
    const headers: Record<string, string> = {};

    if (this.clusterUrl.hostname) {
      headers.Host = this.clusterUrl.hostname;

      // fix current IPv6 inconsistency in url.Parse() and httpProxy.
      // with url.Parse the IPv6 Hostname has no Square brackets but httpProxy needs the Square brackets to work.
      if (headers.Host.includes(":")) {
        headers.Host = `[${headers.Host}]`;
      }
    }

    return {
      target: {
        protocol: "https:",
        host: "127.0.0.1",
        port: kubeAuthProxy.port,
        path: kubeAuthProxy.apiPrefix,
        ca: this.resolveAuthProxyCa(),
      },
      changeOrigin: true,
      timeout,
      secure: true,
      headers,
    };
  }

  protected async ensureServerHelper(): Promise<KubeAuthProxy> {
    if (!this.kubeAuthProxy) {
      const proxyEnv = Object.assign({}, process.env);

      if (this.cluster.preferences.httpsProxy) {
        proxyEnv.HTTPS_PROXY = this.cluster.preferences.httpsProxy;
      }
      this.kubeAuthProxy = this.dependencies.createKubeAuthProxy(this.cluster, proxyEnv);
      await this.kubeAuthProxy.run();

      return this.kubeAuthProxy;
    }

    await this.kubeAuthProxy.whenReady;

    return this.kubeAuthProxy;
  }

  async ensureServer(): Promise<void> {
    await this.ensureServerHelper();
  }

  async restartServer(): Promise<void> {
    this.stopServer();

    await this.ensureServerHelper();
  }

  stopServer() {
    this.prometheus = undefined;
    this.prometheusProvider = undefined;
    this.kubeAuthProxy?.exit();
    this.kubeAuthProxy = undefined;
    this.apiTarget = undefined;
  }
}
