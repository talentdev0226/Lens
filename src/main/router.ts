import Call from "@hapi/call"
import Subtext from "@hapi/subtext"
import http from "http"
import path from "path"
import { readFile } from "fs"
import { Cluster } from "./cluster"
import { configRoute } from "./routes/config"
import { helmApi } from "./helm-api"
import { resourceApplierApi } from "./resource-applier-api"
import { kubeconfigRoute } from "./routes/kubeconfig"
import { metricsRoute } from "./routes/metrics"
import { watchRoute } from "./routes/watch"
import { portForwardRoute } from "./routes/port-forward"
import { outDir, reactAppName } from "../common/vars";

const mimeTypes: {[key: string]: string} = {
  "html": "text/html",
  "txt": "text/plain",
  "css": "text/css",
  "gif": "image/gif",
  "jpg": "image/jpeg",
  "png": "image/png",
  "svg": "image/svg+xml",
  "js": "application/javascript",
  "woff2": "font/woff2",
  "ttf": "font/ttf"
};

interface RouteParams {
  [key: string]: string | undefined;
}

export type LensApiRequest = {
  cluster: Cluster;
  payload: any;
  raw: {
    req: http.IncomingMessage;
  };
  params: RouteParams;
  response: http.ServerResponse;
  query: URLSearchParams;
  path: string;
}

export class Router {
  protected router: any

  public constructor() {
    this.router = new Call.Router();
    this.addRoutes()
  }

  public async route(cluster: Cluster, req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url, "http://localhost")
    const path = url.pathname
    const method = req.method.toLowerCase()
    const matchingRoute = this.router.route(method, path)

    if (matchingRoute.isBoom !== true) { // route() returns error if route not found -> object.isBoom === true
      const request = await this.getRequest({ req, res, cluster, url, params: matchingRoute.params })
      await matchingRoute.route(request)
      return true
    } else {
      return false
    }
  }

  protected async getRequest(opts: { req: http.IncomingMessage; res: http.ServerResponse; cluster: Cluster; url: URL; params: RouteParams }) {
    const { req, res, url, cluster, params } = opts
    const { payload } = await Subtext.parse(req, null, { parse: true, output: 'data' });
    const request: LensApiRequest = {
      cluster: cluster,
      path: url.pathname,
      raw: {
        req: req,
      },
      response: res,
      query: url.searchParams,
      payload: payload,
      params: params
    }
    return request
  }

  protected handleStaticFile(filePath: string, response: http.ServerResponse) {
    const asset = path.resolve(outDir, filePath);
    readFile(asset, (err, data) => {
      if (err) {
        // default to index.html so that react routes work when page is refreshed
        this.handleStaticFile(`${reactAppName}.html`, response)
      } else {
        const type = mimeTypes[path.extname(asset).slice(1)] || "text/plain";
        response.setHeader("Content-Type", type);
        response.write(data)
        response.end()
      }
    })
  }

  protected addRoutes() {
    // Static assets
    this.router.add({ method: 'get', path: '/{path*}' }, (request: LensApiRequest) => {
      const { response, params } = request
      const file = params.path || "/index.html"
      this.handleStaticFile(file, response)
    })

    this.router.add({ method: 'get', path: '/api/config' }, configRoute.routeConfig.bind(configRoute))
    this.router.add({ method: 'get', path: '/api/kubeconfig/service-account/{namespace}/{account}' }, kubeconfigRoute.routeServiceAccountRoute.bind(kubeconfigRoute))

    // Watch API
    this.router.add({ method: 'get', path: '/api/watch' }, watchRoute.routeWatch.bind(watchRoute))

    // Metrics API
    this.router.add({ method: 'post', path: '/api/metrics' }, metricsRoute.routeMetrics.bind(metricsRoute))

    // Port-forward API
    this.router.add({ method: 'post', path: '/api/services/{namespace}/{service}/port-forward/{port}' }, portForwardRoute.routeServicePortForward.bind(portForwardRoute))

    // Helm API
    this.router.add({ method: 'get', path: '/api-helm/v2/charts' }, helmApi.listCharts.bind(helmApi))
    this.router.add({ method: 'get', path: '/api-helm/v2/charts/{repo}/{chart}' }, helmApi.getChart.bind(helmApi))
    this.router.add({ method: 'get', path: '/api-helm/v2/charts/{repo}/{chart}/values' }, helmApi.getChartValues.bind(helmApi))

    this.router.add({ method: 'post', path: '/api-helm/v2/releases' }, helmApi.installChart.bind(helmApi))
    this.router.add({ method: 'put', path: '/api-helm/v2/releases/{namespace}/{release}' }, helmApi.updateRelease.bind(helmApi))
    this.router.add({ method: 'put', path: '/api-helm/v2/releases/{namespace}/{release}/rollback' }, helmApi.rollbackRelease.bind(helmApi))
    this.router.add({ method: 'get', path: '/api-helm/v2/releases/{namespace?}' }, helmApi.listReleases.bind(helmApi))
    this.router.add({ method: 'get', path: '/api-helm/v2/releases/{namespace}/{release}' }, helmApi.getRelease.bind(helmApi))
    this.router.add({ method: 'get', path: '/api-helm/v2/releases/{namespace}/{release}/values' }, helmApi.getReleaseValues.bind(helmApi))
    this.router.add({ method: 'get', path: '/api-helm/v2/releases/{namespace}/{release}/history' }, helmApi.getReleaseHistory.bind(helmApi))
    this.router.add({ method: 'delete', path: '/api-helm/v2/releases/{namespace}/{release}' }, helmApi.deleteRelease.bind(helmApi))

    // Resource Applier API
    this.router.add({ method: 'post', path: '/api-resource/stack' }, resourceApplierApi.applyResource.bind(resourceApplierApi))
  }
}
