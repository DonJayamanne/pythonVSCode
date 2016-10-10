import {BaseDebugServer} from '../DebugServers/BaseDebugServer';
import {LocalDebugServer} from '../DebugServers/LocalDebugServer';
import {IPythonProcess, IPythonThread, IDebugServer} from '../Common/Contracts';
import {DebugSession, OutputEvent} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import * as path from 'path';
import * as child_process from 'child_process';
import {LaunchRequestArguments} from '../Common/Contracts';
import {DebugClient, DebugType} from './DebugClient';
import * as fs from 'fs';
import {open} from '../../common/open';
let fsExtra = require('fs-extra');
let tmp = require('tmp');
let prependFile = require('prepend-file');
let LineByLineReader = require('line-by-line');

const PTVS_FILES = ['visualstudio_ipython_repl.py', 'visualstudio_py_debugger.py',
    'visualstudio_py_launcher.py', 'visualstudio_py_repl.py', 'visualstudio_py_util.py'];
const VALID_DEBUG_OPTIONS = ['WaitOnAbnormalExit',
    'WaitOnNormalExit',
    'RedirectOutput',
    'DebugStdLib',
    'BreakOnSystemExitZero',
    'DjangoDebugging'];

export class LocalDebugClient extends DebugClient {
    protected args: LaunchRequestArguments;
    constructor(args: any, debugSession: DebugSession) {
        super(args, debugSession);
        this.args = args;
    }

    private pyProc: child_process.ChildProcess;
    private pythonProcess: IPythonProcess;
    private debugServer: BaseDebugServer;
    public CreateDebugServer(pythonProcess: IPythonProcess): BaseDebugServer {
        this.pythonProcess = pythonProcess;
        this.debugServer = new LocalDebugServer(this.debugSession, this.pythonProcess);
        return this.debugServer;
    }

    public get DebugType(): DebugType {
        return DebugType.Local;
    }

    public Stop() {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = null;
        }

        if (this.pyProc) {
            try { this.pyProc.send('EXIT'); }
            catch (ex) { }
            try { this.pyProc.stdin.write('EXIT'); }
            catch (ex) { }
            try { this.pyProc.disconnect(); }
            catch (ex) { }
            this.pyProc = null;
        }
    }
    private getPTVSToolsFilePath(): string {
        let currentFileName = module.filename;
        let ptVSToolsPath = path.join(path.dirname(currentFileName), '..', '..', '..', '..', 'pythonFiles', 'PythonTools');
        return path.join(ptVSToolsPath, 'visualstudio_py_launcher.py');
    }
    private displayError(error: any) {
        let errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        if (errorMsg.length > 0) {
            this.debugSession.sendEvent(new OutputEvent(errorMsg, 'stderr'));
        }
    }
    public LaunchApplicationToDebug(dbgServer: IDebugServer, processErrored: (error: any) => void): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let fileDir = path.dirname(this.args.program);
            let processCwd = fileDir;
            if (typeof this.args.cwd === 'string' && this.args.cwd.length > 0) {
                processCwd = this.args.cwd;
            }
            let fileNameWithoutPath = path.basename(this.args.program);
            let pythonPath = 'python';
            if (typeof this.args.pythonPath === 'string' && this.args.pythonPath.trim().length > 0) {
                pythonPath = this.args.pythonPath;
            }
            let environmentVariables = this.args.env ? this.args.env : {};
            let newEnvVars = {};
            if (environmentVariables) {
                for (let setting in environmentVariables) {
                    if (!newEnvVars[setting]) {
                        newEnvVars[setting] = environmentVariables[setting];
                        process.env[setting] = environmentVariables[setting];
                    }
                }
                for (let setting in process.env) {
                    if (!environmentVariables[setting]) {
                        environmentVariables[setting] = process.env[setting];
                    }
                }
            }
            if (!environmentVariables.hasOwnProperty('PYTHONIOENCODING')) {
                environmentVariables['PYTHONIOENCODING'] = 'UTF-8';
                newEnvVars['PYTHONIOENCODING'] = 'UTF-8';
                process.env['PYTHONIOENCODING'] = 'UTF-8';
            }
            let currentFileName = module.filename;
            let ptVSToolsFilePath = this.getPTVSToolsFilePath();
            let launcherArgs = this.buildLauncherArguments();

            let args = [ptVSToolsFilePath, processCwd, dbgServer.port.toString(), '34806ad9-833a-4524-8cd6-18ca4aa74f14'].concat(launcherArgs);
            if (this.args.console === 'externalTerminal') {
                const isSudo = Array.isArray(this.args.debugOptions) && this.args.debugOptions.some(opt => opt === 'Sudo');
                open({ wait: false, app: [pythonPath].concat(args), cwd: processCwd, env: environmentVariables, sudo: isSudo }).then(proc => {
                    this.pyProc = proc;
                    resolve();
                }, error => {
                    // TODO: This condition makes no sense (refactor)
                    if (!this.debugServer && this.debugServer.IsRunning) {
                        return;
                    }
                    reject(error);
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
                    title: 'Python Debug Console',
                    cwd: processCwd,
                    args: [command].concat(commandArgs),
                    env: newEnvVars as { [key: string]: string }
                };
                this.debugSession.runInTerminalRequest(termArgs, 5000, (response) => {
                    if (response.success) {
                        resolve();
                    } else {
                        reject(response);
                    }
                });
                return;
            }

            this.pyProc = child_process.spawn(pythonPath, args, { cwd: processCwd, env: environmentVariables });
            this.pyProc.on('error', error => {
                // TODO: This condition makes no sense (refactor)
                if (!this.debugServer && this.debugServer.IsRunning) {
                    return;
                }
                if (!this.debugServer.IsRunning && typeof (error) === 'object' && error !== null) {
                    // return processErrored(error);
                    return reject(error);
                }
                this.displayError(error);
            });
            this.pyProc.stderr.setEncoding('utf8');
            this.pyProc.stderr.on('data', error => {
                // We generally don't need to display the errors as stderr output is being captured by debugger
                // and it gets sent out to the debug client

                // Either way, we need some code in here so we read the stdout of the python process
                // Else it just keep building up (related to issue #203 and #52)
                if (this.debugServer && !this.debugServer.IsRunning) {
                    return reject(error);
                }
            });
            this.pyProc.stdout.on('data', d => {
                // This is necessary so we read the stdout of the python process
                // Else it just keep building up (related to issue #203 and #52)
                let x = 0;
            });

            // Here we wait for the application to connect to the socket server
            // Only once connected do we know that the application has successfully launched
            // resolve();
            this.debugServer.DebugClientConnected.then(resolve);
        });
    }
    protected buildLauncherArguments(): string[] {
        let vsDebugOptions = 'WaitOnAbnormalExit,WaitOnNormalExit,RedirectOutput';
        if (Array.isArray(this.args.debugOptions)) {
            vsDebugOptions = this.args.debugOptions.filter(opt => VALID_DEBUG_OPTIONS.indexOf(opt) >= 0).join(',');
        }
        // If internal or external console, then don't re-direct the output
        if (this.args.externalConsole === true || this.args.console === 'integratedTerminal' || this.args.console === 'externalTerminal') {
            vsDebugOptions = vsDebugOptions.split(',').filter(opt => opt !== 'RedirectOutput').join(',');
        }

        let programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        return [vsDebugOptions, this.args.program].concat(programArgs);
        // Use this ability to debug unit tests or modules
        // Adding breakpoints programatically to the first executable line of the test program
        // return [vsDebugOptions, '-c', "import pytest;pytest.main(['/Users/donjayamanne/Desktop/Development/Python/Temp/MyEnvs/tests/test_another.py::Test_CheckMyApp::test_complex_check'])"].concat(programArgs);
    }
}
