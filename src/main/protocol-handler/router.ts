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

import logger from "../logger";
import * as proto from "../../common/protocol-handler";
import Url from "url-parse";
import type { LensExtension } from "../../extensions/lens-extension";
import { broadcastMessage } from "../../common/ipc";
import { observable, when, makeObservable } from "mobx";
import { ProtocolHandlerInvalid, RouteAttempt } from "../../common/protocol-handler";
import { disposer } from "../../common/utils";

export interface FallbackHandler {
  (name: string): Promise<boolean>;
}

export class LensProtocolRouterMain extends proto.LensProtocolRouter {
  private missingExtensionHandlers: FallbackHandler[] = [];

  @observable rendererLoaded = false;
  @observable extensionsLoaded = false;

  protected disposers = disposer();

  constructor() {
    super();

    makeObservable(this);
  }

  public cleanup() {
    this.disposers();
  }

  /**
   * Find the most specific registered handler, if it exists, and invoke it.
   *
   * This will send an IPC message to the renderer router to do the same
   * in the renderer.
   */
  public route(rawUrl: string) {
    try {
      const url = new Url(rawUrl, true);

      if (url.protocol.toLowerCase() !== "lens:") {
        throw new proto.RoutingError(proto.RoutingErrorType.INVALID_PROTOCOL, url);
      }

      logger.info(`${proto.LensProtocolRouter.LoggingPrefix}: routing ${url.toString()}`);

      switch (url.host) {
        case "app":
          this._routeToInternal(url);
          break;
        case "extension":
          this.disposers.push(when(() => this.extensionsLoaded, () => this._routeToExtension(url)));
          break;
        default:
          throw new proto.RoutingError(proto.RoutingErrorType.INVALID_HOST, url);
      }

    } catch (error) {
      broadcastMessage(ProtocolHandlerInvalid, error.toString(), rawUrl);

      if (error instanceof proto.RoutingError) {
        logger.error(`${proto.LensProtocolRouter.LoggingPrefix}: ${error}`, { url: error.url });
      } else {
        logger.error(`${proto.LensProtocolRouter.LoggingPrefix}: ${error}`, { rawUrl });
      }
    }
  }

  protected async _executeMissingExtensionHandlers(extensionName: string): Promise<boolean> {
    for (const handler of this.missingExtensionHandlers) {
      if (await handler(extensionName)) {
        return true;
      }
    }

    return false;
  }

  protected async _findMatchingExtensionByName(url: Url): Promise<LensExtension | string> {
    const firstAttempt = await super._findMatchingExtensionByName(url);

    if (typeof firstAttempt !== "string") {
      return firstAttempt;
    }

    if (await this._executeMissingExtensionHandlers(firstAttempt)) {
      return super._findMatchingExtensionByName(url);
    }

    return "";
  }

  protected _routeToInternal(url: Url): RouteAttempt {
    const rawUrl = url.toString(); // for sending to renderer
    const attempt = super._routeToInternal(url);

    this.disposers.push(when(() => this.rendererLoaded, () => broadcastMessage(proto.ProtocolHandlerInternal, rawUrl, attempt)));

    return attempt;
  }

  protected async _routeToExtension(url: Url): Promise<RouteAttempt> {
    const rawUrl = url.toString(); // for sending to renderer

    /**
     * This needs to be done first, so that the missing extension handlers can
     * be called before notifying the renderer.
     *
     * Note: this needs to clone the url because _routeToExtension modifies its
     * argument.
     */
    const attempt = await super._routeToExtension(new Url(url.toString(), true));

    this.disposers.push(when(() => this.rendererLoaded, () => broadcastMessage(proto.ProtocolHandlerExtension, rawUrl, attempt)));

    return attempt;
  }

  /**
   * Add a function to the list which will be sequentially called if an extension
   * is not found while routing to the extensions
   * @param handler A function that tries to find an extension
   */
  public addMissingExtensionHandler(handler: FallbackHandler): void {
    this.missingExtensionHandlers.push(handler);
  }
}
