import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { open } from '../../common/open';
import { PathUtils } from '../../common/platform/pathUtils';
import { CurrentProcess } from '../../common/process/currentProcess';
import { EnvironmentVariablesService } from '../../common/variables/environment';
import { IServiceContainer } from '../../ioc/types';
import { PTVSD_PATH } from '../Common/constants';
import { DebugOptions, IDebugServer, IPythonProcess, LaunchRequestArguments, VALID_DEBUG_OPTIONS } from '../Common/Contracts';
import { IS_WINDOWS } from '../Common/Utils';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { LocalDebugServer } from '../DebugServers/LocalDebugServer';
import { LocalDebugServerV2 } from '../DebugServers/LocalDebugServerV2';
import { IDebugLauncherScriptProvider } from '../types';
import { DebugClient, DebugType } from './DebugClient';
import { DebugClientHelper } from './helper';

enum DebugServerStatus {
    Unknown = 1,
    Running = 2,
    NotRunning = 3
}

export class LocalDebugClient extends DebugClient<LaunchRequestArguments> {
    protected pyProc: ChildProcess | undefined;
    protected pythonProcess!: IPythonProcess;
    protected debugServer: BaseDebugServer | undefined;
    private get debugServerStatus(): DebugServerStatus {
        if (this.debugServer && this.debugServer!.IsRunning) {
            return DebugServerStatus.Running;
        }
        if (this.debugServer && !this.debugServer!.IsRunning) {
            return DebugServerStatus.NotRunning;
        }
        return DebugServerStatus.Unknown;
    }
    // tslint:disable-next-line:no-any
    constructor(args: LaunchRequestArguments, debugSession: DebugSession, private canLaunchTerminal: boolean, private launcherScriptProvider: IDebugLauncherScriptProvider) {
        super(args, debugSession);
    }

    public CreateDebugServer(pythonProcess?: IPythonProcess, serviceContainer?: IServiceContainer): BaseDebugServer {
        if (this.args.type === 'pythonExperimental') {
            this.debugServer = new LocalDebugServerV2(this.debugSession, this.args, serviceContainer!);
        } else {
            this.pythonProcess = pythonProcess!;
            this.debugServer = new LocalDebugServer(this.debugSession, this.pythonProcess!, this.args);
        }
        return this.debugServer;
    }

    public get DebugType(): DebugType {
        return DebugType.Local;
    }

    public Stop() {
        if (this.debugServer) {
            this.debugServer!.Stop();
            this.debugServer = undefined;
        }
        if (this.pyProc) {
            this.pyProc.kill();
            this.pyProc = undefined;
        }
    }
    // tslint:disable-next-line:no-any
    private displayError(error: any) {
        const errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        if (errorMsg.length > 0) {
            this.debugSession.sendEvent(new OutputEvent(errorMsg, 'stderr'));
        }
    }
    // tslint:disable-next-line:max-func-body-length member-ordering no-any
    public async LaunchApplicationToDebug(dbgServer: IDebugServer): Promise<any> {
        const pathUtils = new PathUtils(IS_WINDOWS);
        const currentProcess = new CurrentProcess();
        const environmentVariablesService = new EnvironmentVariablesService(pathUtils);
        const helper = new DebugClientHelper(environmentVariablesService, pathUtils, currentProcess);
        const environmentVariables = await helper.getEnvironmentVariables(this.args);
        if (this.args.type === 'pythonExperimental') {
            // Import the PTVSD debugger, allowing users to use their own latest copies.
            environmentVariablesService.appendPythonPath(environmentVariables, PTVSD_PATH);
        }
        // tslint:disable-next-line:max-func-body-length cyclomatic-complexity no-any
        return new Promise<any>((resolve, reject) => {
            const fileDir = this.args && this.args.program ? path.dirname(this.args.program) : '';
            let processCwd = fileDir;
            if (typeof this.args.cwd === 'string' && this.args.cwd.length > 0 && this.args.cwd !== 'null') {
                processCwd = this.args.cwd;
            }
            let pythonPath = 'python';
            if (typeof this.args.pythonPath === 'string' && this.args.pythonPath.trim().length > 0) {
                pythonPath = this.args.pythonPath;
            }
            const ptVSToolsFilePath = this.launcherScriptProvider.getLauncherFilePath();
            const launcherArgs = this.buildLauncherArguments();

            const args = [ptVSToolsFilePath, processCwd, dbgServer.port.toString(), '34806ad9-833a-4524-8cd6-18ca4aa74f14'].concat(launcherArgs);
            switch (this.args.console) {
                case 'externalTerminal':
                case 'integratedTerminal': {
                    const isSudo = Array.isArray(this.args.debugOptions) && this.args.debugOptions.some(opt => opt === 'Sudo');
                    this.launchExternalTerminal(isSudo, processCwd, pythonPath, args, environmentVariables).then(resolve).catch(reject);
                    break;
                }
                default: {
                    this.pyProc = spawn(pythonPath, args, { cwd: processCwd, env: environmentVariables });
                    this.handleProcessOutput(this.pyProc!, reject);

                    // Here we wait for the application to connect to the socket server.
                    // Only once connected do we know that the application has successfully launched.
                    this.debugServer!.DebugClientConnected
                        .then(resolve)
                        .catch(ex => console.error('Python Extension: debugServer.DebugClientConnected', ex));
                }
            }
        });
    }
    // tslint:disable-next-line:member-ordering
    protected handleProcessOutput(proc: ChildProcess, failedToLaunch: (error: Error | string | Buffer) => void) {
        proc.on('error', error => {
            // If debug server has started, then don't display errors.
            // The debug adapter will get this info from the debugger (e.g. ptvsd lib).
            const status = this.debugServerStatus;
            if (status === DebugServerStatus.Running) {
                return;
            }
            if (status === DebugServerStatus.NotRunning && typeof (error) === 'object' && error !== null) {
                return failedToLaunch(error);
            }
            // This could happen when the debugger didn't launch at all, e.g. python doesn't exist.
            this.displayError(error);
        });
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', error => {
            if (this.args.type === 'pythonExperimental') {
                return;
            }
            // We generally don't need to display the errors as stderr output is being captured by debugger
            // and it gets sent out to the debug client.

            // Either way, we need some code in here so we read the stdout of the python process,
            // Else it just keep building up (related to issue #203 and #52).
            if (this.debugServerStatus === DebugServerStatus.NotRunning) {
                return failedToLaunch(error);
            }
        });
        proc.stdout.on('data', d => {
            // This is necessary so we read the stdout of the python process,
            // Else it just keep building up (related to issue #203 and #52).
            // tslint:disable-next-line:prefer-const no-unused-variable
            let x = 0;
        });
    }
    // tslint:disable-next-line:member-ordering
    protected buildLauncherArguments(): string[] {
        const vsDebugOptions: string[] = [DebugOptions.RedirectOutput];
        if (Array.isArray(this.args.debugOptions)) {
            this.args.debugOptions.filter(opt => VALID_DEBUG_OPTIONS.indexOf(opt) >= 0)
                .forEach(item => vsDebugOptions.push(item));
        }
        const djangoIndex = vsDebugOptions.indexOf(DebugOptions.Django);
        // PTVSD expects the string `DjangoDebugging`
        if (djangoIndex >= 0) {
            vsDebugOptions[djangoIndex] = 'DjangoDebugging';
        }
        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return [vsDebugOptions.join(','), '-m', this.args.module].concat(programArgs);
        }
        const args = [vsDebugOptions.join(',')];
        if (this.args.program && this.args.program.length > 0) {
            args.push(this.args.program);
        }
        return args.concat(programArgs);
    }
    private launchExternalTerminal(sudo: boolean, cwd: string, pythonPath: string, args: string[], env: {}) {
        return new Promise((resolve, reject) => {
            if (this.canLaunchTerminal) {
                const command = sudo ? 'sudo' : pythonPath;
                const commandArgs = sudo ? [pythonPath].concat(args) : args;
                const isExternalTerminal = this.args.console === 'externalTerminal';
                const consoleKind = isExternalTerminal ? 'external' : 'integrated';
                const termArgs: DebugProtocol.RunInTerminalRequestArguments = {
                    kind: consoleKind,
                    title: 'Python Debug Console',
                    cwd,
                    args: [command].concat(commandArgs),
                    env
                };
                this.debugSession.runInTerminalRequest(termArgs, 5000, (response) => {
                    if (response.success) {
                        resolve();
                    } else {
                        reject(response);
                    }
                });
            } else {
                open({ wait: false, app: [pythonPath].concat(args), cwd, env, sudo: sudo }).then(proc => {
                    this.pyProc = proc;
                    resolve();
                }, error => {
                    if (this.debugServerStatus === DebugServerStatus.Running) {
                        return;
                    }
                    reject(error);
                });
            }
        });
    }
}
