import { BaseDebugServer } from "../DebugServers/BaseDebugServer";
import { NonDebugServer } from "../DebugServers/NonDebugServer";
import { IPythonProcess, IPythonThread, IDebugServer } from "../Common/Contracts";
import { DebugSession, OutputEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import * as path from "path";
import * as child_process from "child_process";
import { LaunchRequestArguments } from "../Common/Contracts";
import { DebugClient, DebugType } from "./DebugClient";
import * as fs from "fs";
import { open } from "../../common/open";
let fsExtra = require("fs-extra");
let tmp = require("tmp");
let prependFile = require("prepend-file");
let LineByLineReader = require("line-by-line");

export class NonDebugClient extends DebugClient {
    protected args: LaunchRequestArguments;
    constructor(args: any, debugSession: DebugSession) {
        super(args, debugSession);
        this.args = args;
    }

    private pyProc: child_process.ChildProcess;
    private debugServer: BaseDebugServer;
    public CreateDebugServer(pythonProcess: IPythonProcess): BaseDebugServer {
        return new NonDebugServer(this.debugSession, pythonProcess);
    }

    public get DebugType(): DebugType {
        return DebugType.RunLocal;
    }

    public Stop() {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = null;
        }

        if (this.pyProc) {
            try { this.pyProc.kill(); }
            catch (ex) { }
            this.pyProc = null;
        }
    }
    public LaunchApplicationToDebug(dbgServer: IDebugServer, processErrored: (error: any) => void): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let fileDir = path.dirname(this.args.program);
            let processCwd = fileDir;
            if (typeof this.args.cwd === "string" && this.args.cwd.length > 0) {
                processCwd = this.args.cwd;
            }
            let fileNameWithoutPath = path.basename(this.args.program);
            let pythonPath = "python";
            if (typeof this.args.pythonPath === "string" && this.args.pythonPath.trim().length > 0) {
                pythonPath = this.args.pythonPath;
            }
            let environmentVariables = this.args.env ? this.args.env : {};
            let newEnvVars = {};
            if (environmentVariables) {
                for (let setting in environmentVariables) {
                    if (!newEnvVars[setting]) {
                        newEnvVars[setting] = environmentVariables[setting];
                    }
                }
                for (let setting in process.env) {
                    if (!environmentVariables[setting]) {
                        environmentVariables[setting] = process.env[setting];
                    }
                }
            }
            if (!environmentVariables.hasOwnProperty("PYTHONIOENCODING")) {
                environmentVariables["PYTHONIOENCODING"] = "UTF-8";
                newEnvVars["PYTHONIOENCODING"] = "UTF-8";
            }
            let currentFileName = module.filename;
            let launcherArgs = this.buildLauncherArguments();

            let args = launcherArgs;
            if (this.args.console === 'externalTerminal') {
                open({ wait: false, app: [pythonPath].concat(args), cwd: processCwd, env: environmentVariables }).then(proc => {
                    this.pyProc = proc;
                    this.pyProc.on('exit', () => {
                        this.pyProc = null;
                        this.emit('exit');
                    });
                    resolve();
                }, error => {
                    if (reject) {
                        reject(error);
                        reject = null;
                    }
                });
                return;
            }

            if (this.args.console === 'integratedTerminal') {
                const isSudo = Array.isArray(this.args.debugOptions) && this.args.debugOptions.some(opt => opt === 'Sudo');
                const command = isSudo ? 'sudo' : pythonPath;
                const commandArgs = isSudo ? [pythonPath].concat(args) : args;
                const options = { cwd: processCwd, env: environmentVariables };
                const termArgs: DebugProtocol.RunInTerminalRequestArguments = {
                    kind: 'integrated',
                    title: "Python Debug Console",
                    cwd: processCwd,
                    args: [command].concat(commandArgs),
                    env: newEnvVars as { [key: string]: string }
                };
                this.debugSession.runInTerminalRequest(termArgs, 5000, (response) => {
                    if (response.success) {
                        resolve()
                    } else {
                        reject(response);
                    }
                });
                return;
            }

            this.pyProc = child_process.spawn(pythonPath, args, { cwd: processCwd, env: environmentVariables });
            this.pyProc.on("error", error => {
                this.debugSession.sendEvent(new OutputEvent(error, "stderr"));
            });
            this.pyProc.stderr.setEncoding("utf8");
            this.pyProc.stdout.setEncoding("utf8");
            this.pyProc.stderr.on("data", (error: string) => {
                this.debugSession.sendEvent(new OutputEvent(error, "stderr"));
            });
            this.pyProc.stdout.on("data", (d: string) => {
                this.debugSession.sendEvent(new OutputEvent(d, "stdout"));
            });
            this.pyProc.on('exit', () => {
                this.pyProc = null;
                this.emit('exit');
            });
            resolve();
        });
    }
    protected buildLauncherArguments(): string[] {
        let programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        return [this.args.program].concat(programArgs);
    }
}
