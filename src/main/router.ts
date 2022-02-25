/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import Call from "@hapi/call";
import Subtext from "@hapi/subtext";
import type http from "http";
import path from "path";
import { readFile } from "fs-extra";
import type { Cluster } from "../common/cluster/cluster";
import { apiPrefix, appName, publicPath } from "../common/vars";
import { HelmApiRoute, KubeconfigRoute, MetricsRoute, PortForwardRoute, ResourceApplierApiRoute, VersionRoute } from "./routes";
import logger from "./logger";

export interface RouterRequestOpts {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  cluster: Cluster;
  params: RouteParams;
  url: URL;
}

export interface RouteParams extends Record<string, string> {
  path?: string; // *-route
  namespace?: string;
  service?: string;
  account?: string;
  release?: string;
  repo?: string;
  chart?: string;
}

export interface LensApiRequest<P = any> {
  path: string;
  payload: P;
  params: RouteParams;
  cluster: Cluster;
  response: http.ServerResponse;
  query: URLSearchParams;
  raw: {
    req: http.IncomingMessage;
  };
}

function getMimeType(filename: string) {
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    txt: "text/plain",
    css: "text/css",
    gif: "image/gif",
    jpg: "image/jpeg",
    png: "image/png",
    svg: "image/svg+xml",
    js: "application/javascript",
    woff2: "font/woff2",
    ttf: "font/ttf",
  };

  return mimeTypes[path.extname(filename).slice(1)] || "text/plain";
}

interface Dependencies {
  routePortForward: (request: LensApiRequest) => Promise<void>;
}

export class Router {
  protected router = new Call.Router();
  protected static rootPath = path.resolve(__static);

  public constructor(private dependencies: Dependencies) {
    this.addRoutes();
  }

  public async route(cluster: Cluster, req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const method = req.method.toLowerCase();
    const matchingRoute = this.router.route(method, path);
    const routeFound = !matchingRoute.isBoom;

    if (routeFound) {
      const request = await this.getRequest({ req, res, cluster, url, params: matchingRoute.params });

      await matchingRoute.route(request);

      return true;
    }

    return false;
  }

  protected async getRequest(opts: RouterRequestOpts): Promise<LensApiRequest> {
    const { req, res, url, cluster, params } = opts;
    const { payload } = await Subtext.parse(req, null, {
      parse: true,
      output: "data",
    });

    return {
      cluster,
      path: url.pathname,
      raw: {
        req,
      },
      response: res,
      query: url.searchParams,
      payload,
      params,
    };
  }

  protected static async handleStaticFile({ params, response }: LensApiRequest): Promise<void> {
    let filePath = params.path;

    for (let retryCount = 0; retryCount < 5; retryCount += 1) {
      const asset = path.join(Router.rootPath, filePath);
      const normalizedFilePath = path.resolve(asset);

      if (!normalizedFilePath.startsWith(Router.rootPath)) {
        response.statusCode = 404;

        return response.end();
      }

      try {
        const data = await readFile(asset);

        response.setHeader("Content-Type", getMimeType(asset));
        response.write(data);
        response.end();
      } catch (err) {
        if (retryCount > 5) {
          logger.error("handleStaticFile:", err.toString());
          response.statusCode = 404;

          return response.end();
        }

        filePath = `${publicPath}/${appName}.html`;
      }
    }

  }

  protected addRoutes() {
    // Static assets
    this.router.add({ method: "get", path: "/{path*}" }, Router.handleStaticFile);

    this.router.add({ method: "get", path: "/version" }, VersionRoute.getVersion);
    this.router.add({ method: "get", path: `${apiPrefix}/kubeconfig/service-account/{namespace}/{account}` }, KubeconfigRoute.routeServiceAccountRoute);

    // Metrics API
    this.router.add({ method: "post", path: `${apiPrefix}/metrics` }, MetricsRoute.routeMetrics);
    this.router.add({ method: "get", path: `${apiPrefix}/metrics/providers` }, MetricsRoute.routeMetricsProviders);

    // Port-forward API (the container port and local forwarding port are obtained from the query parameters)
    this.router.add({ method: "post", path: `${apiPrefix}/pods/port-forward/{namespace}/{resourceType}/{resourceName}` }, this.dependencies.routePortForward);
    this.router.add({ method: "get", path: `${apiPrefix}/pods/port-forward/{namespace}/{resourceType}/{resourceName}` }, PortForwardRoute.routeCurrentPortForward);
    this.router.add({ method: "delete", path: `${apiPrefix}/pods/port-forward/{namespace}/{resourceType}/{resourceName}` }, PortForwardRoute.routeCurrentPortForwardStop);

    // Helm API
    this.router.add({ method: "get", path: `${apiPrefix}/v2/charts` }, HelmApiRoute.listCharts);
    this.router.add({ method: "get", path: `${apiPrefix}/v2/charts/{repo}/{chart}` }, HelmApiRoute.getChart);
    this.router.add({ method: "get", path: `${apiPrefix}/v2/charts/{repo}/{chart}/values` }, HelmApiRoute.getChartValues);

    this.router.add({ method: "post", path: `${apiPrefix}/v2/releases` }, HelmApiRoute.installChart);
    this.router.add({ method: `put`, path: `${apiPrefix}/v2/releases/{namespace}/{release}` }, HelmApiRoute.updateRelease);
    this.router.add({ method: `put`, path: `${apiPrefix}/v2/releases/{namespace}/{release}/rollback` }, HelmApiRoute.rollbackRelease);
    this.router.add({ method: "get", path: `${apiPrefix}/v2/releases/{namespace?}` }, HelmApiRoute.listReleases);
    this.router.add({ method: "get", path: `${apiPrefix}/v2/releases/{namespace}/{release}` }, HelmApiRoute.getRelease);
    this.router.add({ method: "get", path: `${apiPrefix}/v2/releases/{namespace}/{release}/values` }, HelmApiRoute.getReleaseValues);
    this.router.add({ method: "get", path: `${apiPrefix}/v2/releases/{namespace}/{release}/history` }, HelmApiRoute.getReleaseHistory);
    this.router.add({ method: "delete", path: `${apiPrefix}/v2/releases/{namespace}/{release}` }, HelmApiRoute.deleteRelease);

    // Resource Applier API
    this.router.add({ method: "post", path: `${apiPrefix}/stack` }, ResourceApplierApiRoute.applyResource);
    this.router.add({ method: "patch", path: `${apiPrefix}/stack` }, ResourceApplierApiRoute.patchResource);
  }
}
