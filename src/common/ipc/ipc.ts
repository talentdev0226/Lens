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

// Inter-process communications (main <-> renderer)
// https://www.electronjs.org/docs/api/ipc-main
// https://www.electronjs.org/docs/api/ipc-renderer

import { ipcMain, ipcRenderer, webContents, remote } from "electron";
import { toJS } from "mobx";
import logger from "../../main/logger";
import { ClusterFrameInfo, clusterFrameMap } from "../cluster-frames";

const subFramesChannel = "ipc:get-sub-frames";

export function handleRequest(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.handle(channel, listener);
}

export async function requestMain(channel: string, ...args: any[]) {
  return ipcRenderer.invoke(channel, ...args);
}

function getSubFrames(): ClusterFrameInfo[] {
  return toJS(Array.from(clusterFrameMap.values()), { recurseEverything: true });
}

export async function broadcastMessage(channel: string, ...args: any[]) {
  const views = (webContents || remote?.webContents)?.getAllWebContents();

  if (!views) return;

  if (ipcRenderer) {
    ipcRenderer.send(channel, ...args);
  } else if (ipcMain) {
    ipcMain.emit(channel, ...args);
  }

  for (const view of views) {
    const type = view.getType();

    logger.silly(`[IPC]: broadcasting "${channel}" to ${type}=${view.id}`, { args });
    view.send(channel, ...args);

    try {
      const subFrames: ClusterFrameInfo[] = ipcRenderer
        ? await requestMain(subFramesChannel)
        : getSubFrames();

      for (const frameInfo of subFrames) {
        view.sendToFrame([frameInfo.processId, frameInfo.frameId], channel, ...args);
      }
    } catch (error) {
      logger.error("[IPC]: failed to send IPC message", { error: String(error) });
    }
  }
}

export function subscribeToBroadcast(channel: string, listener: (...args: any[]) => any) {
  if (ipcRenderer) {
    ipcRenderer.on(channel, listener);
  } else if (ipcMain) {
    ipcMain.on(channel, listener);
  }

  return listener;
}

export function unsubscribeFromBroadcast(channel: string, listener: (...args: any[]) => any) {
  if (ipcRenderer) {
    ipcRenderer.off(channel, listener);
  } else if (ipcMain) {
    ipcMain.off(channel, listener);
  }
}

export function unsubscribeAllFromBroadcast(channel: string) {
  if (ipcRenderer) {
    ipcRenderer.removeAllListeners(channel);
  } else if (ipcMain) {
    ipcMain.removeAllListeners(channel);
  }
}

export function bindBroadcastHandlers() {
  handleRequest(subFramesChannel, () => {
    return getSubFrames();
  });
}
