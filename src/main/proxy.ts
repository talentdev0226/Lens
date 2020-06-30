import http from "http";
import httpProxy from "http-proxy";
import { Socket } from "net";
import * as url from "url";
import * as WebSocket from "ws"
import { ContextHandler } from "./context-handler";
import logger from "./logger"
import * as shell from "./node-shell-session"
import { ClusterManager } from "./cluster-manager"
import { Router } from "./router"
import { apiPrefix } from "../common/vars";

export class LensProxy {
  public static readonly localShellSessions = true

  public port: number;
  protected clusterUrl: url.UrlWithStringQuery
  protected clusterManager: ClusterManager
  protected retryCounters: Map<string, number> = new Map()
  protected router: Router
  protected proxyServer: http.Server
  protected closed = false

  constructor(port: number, clusterManager: ClusterManager) {
    this.port = port
    this.clusterManager = clusterManager
    this.router = new Router()
  }

  public run() {
    const proxyServer = this.buildProxyServer();
    proxyServer.listen(this.port, "127.0.0.1")
    this.proxyServer = proxyServer
  }

  public close() {
    logger.info("Closing proxy server")
    this.proxyServer.close()
    this.closed = true
  }

  protected buildProxyServer() {
    const proxy = this.createProxy();
    const proxyServer = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      this.handleRequest(proxy, req, res);
    });
    proxyServer.on("upgrade", (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
      this.handleWsUpgrade(req, socket, head)
    });
    proxyServer.on("error", (err) => {
      logger.error(err)
    });
    return proxyServer;
  }

  protected createProxy() {
    const proxy = httpProxy.createProxyServer();

    proxy.on("proxyRes", (proxyRes, req, res) => {
      if (proxyRes.statusCode === 502) {
        const cluster = this.clusterManager.getClusterForRequest(req)
        if (cluster && cluster.contextHandler.proxyServerError()) {
          res.writeHead(proxyRes.statusCode, {
            "Content-Type": "text/plain"
          })
          res.end(cluster.contextHandler.proxyServerError())
          return
        }
      }
      if (req.method !== "GET") {
        return
      }
      const key = `${req.headers.host}${req.url}`
      if (this.retryCounters.has(key)) {
        logger.debug("Resetting proxy retry cache for url: " + key)
        this.retryCounters.delete(key)
      }
    })
    proxy.on("error", (error, req, res, target) => {
      if(this.closed) {
        return
      }
      if (target) {
        logger.debug("Failed proxy to target: " + JSON.stringify(target))
        if (req.method === "GET" && (!res.statusCode || res.statusCode >= 500)) {
          const retryCounterKey = `${req.headers.host}${req.url}`
          const retryCount = this.retryCounters.get(retryCounterKey) || 0
          if (retryCount < 20) {
            logger.debug("Retrying proxy request to url: " + retryCounterKey)
            setTimeout(() => {
              this.retryCounters.set(retryCounterKey, retryCount + 1)
              this.handleRequest(proxy, req, res)
            }, (250 * retryCount))
          }
        }
      }
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      })
      res.end('Oops, something went wrong.')
    })

    return proxy;
  }

  protected createWsListener() {
    const ws = new WebSocket.Server({ noServer: true })
    ws.on("connection", ((con: WebSocket, req: http.IncomingMessage) => {
      const cluster = this.clusterManager.getClusterForRequest(req)
      const contextHandler = cluster.contextHandler
      const nodeParam = url.parse(req.url, true).query["node"]?.toString();

      contextHandler.withTemporaryKubeconfig((kubeconfigPath) => {
        return new Promise<boolean>(async (resolve, reject) => {
          const shellSession = await shell.open(con, kubeconfigPath, cluster, nodeParam)
          shellSession.on("exit", () => {
            resolve(true)
          })
        })
      })
    }))
    return ws
  }

  protected async getProxyTarget(req: http.IncomingMessage, contextHandler: ContextHandler): Promise<httpProxy.ServerOptions> {
    const prefix = apiPrefix.KUBE_BASE;
    if (req.url.startsWith(prefix)) {
      delete req.headers.authorization
      req.url = req.url.replace(prefix, "")
      const isWatchRequest = req.url.includes("watch=")
      return await contextHandler.getApiTarget(isWatchRequest)
    }
  }

  protected async handleRequest(proxy: httpProxy, req: http.IncomingMessage, res: http.ServerResponse) {
    const cluster = this.clusterManager.getClusterForRequest(req)
    if (!cluster) {
      logger.error("Got request to unknown cluster")
      logger.debug(req.headers.host + req.url)
      res.statusCode = 503
      res.end()
      return
    }
    const contextHandler = cluster.contextHandler
    try {
      contextHandler.applyHeaders(req)
    } catch (error) {
      res.statusCode = 503
      res.end()
      return
    }
    contextHandler.ensureServer().then(async () => {
      const proxyTarget = await this.getProxyTarget(req, contextHandler)
      if (proxyTarget) {
        proxy.web(req, res, proxyTarget)
      } else {
        this.router.route(cluster, req, res)
      }
    })
  }

  protected async handleWsUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer) {
    const wsServer = this.createWsListener();
    const cluster = this.clusterManager.getClusterForRequest(req)
    const contextHandler = cluster.contextHandler
    contextHandler.applyHeaders(req);
    wsServer.handleUpgrade(req, socket, head, (con) => {
      wsServer.emit("connection", con, req);
    });
  }
}

export function listen(port: number, clusterManager: ClusterManager) {
  const proxyServer = new LensProxy(port, clusterManager)
  proxyServer.run();
  return proxyServer;
}
