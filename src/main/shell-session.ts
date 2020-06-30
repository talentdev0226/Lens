import * as pty from "node-pty"
import * as WebSocket from "ws"
import { EventEmitter } from "events";
import path from "path"
import shellEnv from "shell-env"
import { app } from "electron"
import { Kubectl } from "./kubectl"
import { tracker } from "./tracker"
import { Cluster, ClusterPreferences } from "./cluster"
import { helmCli } from "./helm-cli"
import { isWindows } from "../common/vars";

export class ShellSession extends EventEmitter {
  static shellEnvs: Map<string, any> = new Map()

  protected websocket: WebSocket
  protected shellProcess: pty.IPty
  protected kubeconfigPath: string
  protected nodeShellPod: string;
  protected kubectl: Kubectl;
  protected kubectlBinDir: string;
  protected helmBinDir: string;
  protected preferences: ClusterPreferences;
  protected running = false;
  protected clusterId: string;

  constructor(socket: WebSocket, pathToKubeconfig: string, cluster: Cluster) {
    super()
    this.websocket = socket
    this.kubeconfigPath =  pathToKubeconfig
    this.kubectl = new Kubectl(cluster.version)
    this.preferences = cluster.preferences || {}
    this.clusterId = cluster.id
  }

  public async open() {
    this.kubectlBinDir = await this.kubectl.binDir()
    this.helmBinDir = helmCli.getBinaryDir()
    const env = await this.getCachedShellEnv()
    const shell = env.PTYSHELL
    const args = await this.getShellArgs(shell)
    this.shellProcess = pty.spawn(shell, args, {
      cols: 80,
      cwd: this.cwd() || env.HOME,
      env: env,
      name: "xterm-256color",
      rows: 30,
    });
    this.running = true;

    this.pipeStdout()
    this.pipeStdin()
    this.closeWebsocketOnProcessExit()
    this.exitProcessOnWebsocketClose()

    tracker.event("shell", "open")
  }

  protected cwd(): string {
    if(!this.preferences || !this.preferences.terminalCWD || this.preferences.terminalCWD === "") {
      return null
    }
    return this.preferences.terminalCWD
  }

  protected async getShellArgs(shell: string): Promise<Array<string>> {
    switch(path.basename(shell)) {
    case "powershell.exe":
      return ["-NoExit", "-command", `& {Set-Location $Env:USERPROFILE; $Env:PATH="${this.kubectlBinDir};${this.helmBinDir};$Env:PATH"}`]
    case "bash":
      return ["--init-file", path.join(this.kubectlBinDir, '.bash_set_path')]
    case "fish":
      return ["--login", "--init-command", `export PATH="${this.kubectlBinDir}:${this.helmBinDir}:$PATH"; export KUBECONFIG="${this.kubeconfigPath}"`]
    case "zsh":
      return ["--login"]
    default:
      return []
    }
  }

  protected async getCachedShellEnv() {
    let env = ShellSession.shellEnvs.get(this.clusterId)
    if (!env) {
      env = await this.getShellEnv()
      ShellSession.shellEnvs.set(this.clusterId, env)
    } else {
      // refresh env in the background
      this.getShellEnv().then((shellEnv: any) => {
        ShellSession.shellEnvs.set(this.clusterId, shellEnv)
      })
    }

    return env
  }

  protected async getShellEnv() {
    const env = JSON.parse(JSON.stringify(await shellEnv()))
    const pathStr = [this.kubectlBinDir, this.helmBinDir, process.env.PATH].join(path.delimiter)

    if(isWindows) {
      env["SystemRoot"] = process.env.SystemRoot
      env["PTYSHELL"] = "powershell.exe"
      env["PATH"] = pathStr
    } else if(typeof(process.env.SHELL) != "undefined") {
      env["PTYSHELL"] = process.env.SHELL
      env["PATH"] = pathStr
    } else {
      env["PTYSHELL"] = "" // blank runs the system default shell
    }

    if(path.basename(env["PTYSHELL"]) === "zsh") {
      env["OLD_ZDOTDIR"] = env.ZDOTDIR || env.HOME
      env["ZDOTDIR"] = this.kubectlBinDir
    }

    env["PTYPID"] = process.pid.toString()
    env["KUBECONFIG"] = this.kubeconfigPath
    env["TERM_PROGRAM"] = app.getName()
    env["TERM_PROGRAM_VERSION"] = app.getVersion()
    if (this.preferences.httpsProxy) {
      env["HTTPS_PROXY"] = this.preferences.httpsProxy
    }
    if (env.DEBUG) { // do not pass debug option to bash
      delete env["DEBUG"]
    }

    return(env)
  }

  protected pipeStdout() {
    // send shell output to websocket
    this.shellProcess.onData(((data: string) => {
      this.sendResponse(data)
    }));
  }

  protected pipeStdin() {
    // write websocket messages to shellProcess
    this.websocket.on("message", (data: string) => {
      if (!this.running) { return }

      const message = Buffer.from(data.slice(1, data.length), "base64").toString()
      switch (data[0]) {
      case "0":
        this.shellProcess.write(message)
        break;
      case "4":
        const resizeMsgObj = JSON.parse(message)
        this.shellProcess.resize(resizeMsgObj["Width"], resizeMsgObj["Height"])
        break;
      case "9":
        this.emit('newToken', message)
        break;
      }
    })
  }

  protected exit(code = 1000) {
    if (this.websocket.readyState == this.websocket.OPEN) this.websocket.close(code)
    this.emit('exit')
  }

  protected closeWebsocketOnProcessExit() {
    this.shellProcess.onExit(({ exitCode }) => {
      this.running = false
      let timeout = 0
      if (exitCode > 0) {
        this.sendResponse("Terminal will auto-close in 15 seconds ...")
        timeout = 15*1000
      }
      setTimeout(() => {
        this.exit()
      }, timeout)
    });
  }

  protected exitProcessOnWebsocketClose() {
    this.websocket.on("close", () => {
      this.killShellProcess()
    })
  }

  protected killShellProcess(){
    if(this.running) {
      // On Windows we need to kill the shell process by pid, since Lens won't respond after a while if using `this.shellProcess.kill()`
      if (isWindows) {
        try {
          process.kill(this.shellProcess.pid)
        } catch(e) {
          return
        }
      } else {
        this.shellProcess.kill()
      }
    }
  }

  protected sendResponse(msg: string) {
    this.websocket.send("1" + Buffer.from(msg).toString("base64"))
  }
}
