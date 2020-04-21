// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { DebugConfiguration } from 'vscode';
import * as vsls from 'vsls/vscode';
import { concatMultilineStringOutput } from '../../../datascience-ui/common';
import { IApplicationShell, ICommandManager, IDebugService, IWorkspaceService } from '../../common/application/types';
import { DebugAdapterNewPtvsd } from '../../common/experimentGroups';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService, IExperimentsManager, Version } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { getCellResource } from '../cellFactory';
import { Identifiers, Telemetry } from '../constants';
import {
    CellState,
    ICell,
    ICellHashListener,
    IFileHashes,
    IJupyterConnection,
    IJupyterDebugger,
    INotebook,
    ISourceMapRequest
} from '../types';
import { JupyterDebuggerNotInstalledError } from './jupyterDebuggerNotInstalledError';
import { JupyterDebuggerRemoteNotSupported } from './jupyterDebuggerRemoteNotSupported';
import { ILiveShareHasRole } from './liveshare/types';

const pythonShellCommand = `_sysexec = sys.executable\r\n_quoted_sysexec = '"' + _sysexec + '"'\r\n!{_quoted_sysexec}`;

@injectable()
export class JupyterDebugger implements IJupyterDebugger, ICellHashListener {
    private requiredPtvsdVersion: Version = { major: 4, minor: 3, patch: 0, build: [], prerelease: [], raw: '' };
    private requiredDebugpyVersion: Version = { major: 1, minor: 0, patch: 0, build: [], prerelease: [], raw: '' };
    private configs: Map<string, DebugConfiguration> = new Map<string, DebugConfiguration>();
    private readonly debuggerPackage: string;
    private readonly enableDebuggerCode: string;
    private readonly waitForDebugClientCode: string;
    private readonly tracingEnableCode: string;
    private readonly tracingDisableCode: string;
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager
    ) {
        if (this.experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)) {
            this.debuggerPackage = 'debugpy';
            this.enableDebuggerCode = `import debugpy;debugpy.listen(('localhost', 0))`;
            this.waitForDebugClientCode = `import debugpy;debugpy.wait_for_client()`;
            this.tracingEnableCode = `from debugpy import trace_this_thread;trace_this_thread(True)`;
            this.tracingDisableCode = `from debugpy import trace_this_thread;trace_this_thread(False)`;
        } else {
            this.debuggerPackage = 'ptvsd';
            this.enableDebuggerCode = `import ptvsd;ptvsd.enable_attach(('localhost', 0))`;
            this.waitForDebugClientCode = `import ptvsd;ptvsd.wait_for_attach()`;
            this.tracingEnableCode = `from ptvsd import tracing;tracing(True)`;
            this.tracingDisableCode = `from ptvsd import tracing;tracing(False)`;
        }
    }

    public async startDebugging(notebook: INotebook): Promise<void> {
        traceInfo('start debugging');

        // Try to connect to this notebook
        const config = await this.connect(notebook);
        if (config) {
            traceInfo('connected to notebook during debugging');

            // First check if this is a live share session. Skip debugging attach on the guest
            // tslint:disable-next-line: no-any
            const hasRole = (notebook as any) as ILiveShareHasRole;
            if (hasRole && hasRole.role && hasRole.role === vsls.Role.Guest) {
                traceInfo('guest mode attach skipped');
            } else {
                await this.debugService.startDebugging(undefined, config);

                // Force the debugger to update its list of breakpoints. This is used
                // to make sure the breakpoint list is up to date when we do code file hashes
                this.debugService.removeBreakpoints([]);
            }

            // Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
            const importResults = await this.executeSilently(notebook, this.waitForDebugClientCode);
            if (importResults.length === 0 || importResults[0].state === CellState.error) {
                traceWarning(`${this.debuggerPackage} not found in path.`);
            } else {
                this.traceCellResults('import startup', importResults);
            }

            // Then enable tracing
            await this.executeSilently(notebook, this.tracingEnableCode);
        }
    }

    public async stopDebugging(notebook: INotebook): Promise<void> {
        const config = this.configs.get(notebook.identity.toString());
        if (config) {
            traceInfo('stop debugging');

            // Stop our debugging UI session, no await as we just want it stopped
            this.commandManager.executeCommand('workbench.action.debug.stop');

            // Disable tracing after we disconnect because we don't want to step through this
            // code if the user was in step mode.
            await this.executeSilently(notebook, this.tracingDisableCode);
        }
    }

    public onRestart(notebook: INotebook): void {
        this.configs.delete(notebook.identity.toString());
    }

    public async hashesUpdated(hashes: IFileHashes[]): Promise<void> {
        // Make sure that we have an active debugging session at this point
        if (this.debugService.activeDebugSession) {
            await Promise.all(
                hashes.map((fileHash) => {
                    return this.debugService.activeDebugSession!.customRequest(
                        'setPydevdSourceMap',
                        this.buildSourceMap(fileHash)
                    );
                })
            );
        }
    }

    private traceCellResults(prefix: string, results: ICell[]) {
        if (results.length > 0 && results[0].data.cell_type === 'code') {
            const cell = results[0].data as nbformat.ICodeCell;
            const error = cell.outputs && cell.outputs[0] ? cell.outputs[0].evalue : undefined;
            if (error) {
                traceError(`${prefix} Error : ${error}`);
            } else if (cell.outputs && cell.outputs[0]) {
                const data = cell.outputs[0].data;
                const text = cell.outputs[0].text;
                traceInfo(`${prefix} Output: ${text || JSON.stringify(data)}`);
            }
        } else {
            traceInfo(`${prefix} no output.`);
        }
    }

    private async connect(notebook: INotebook): Promise<DebugConfiguration | undefined> {
        // If we already have configuration, we're already attached, don't do it again.
        let result = this.configs.get(notebook.identity.toString());
        if (result) {
            const settings = this.configService.getSettings(notebook.resource);
            result.justMyCode = settings.datascience.debugJustMyCode;
            return result;
        }
        traceInfo('enable debugger attach');

        // Append any specific debugger paths that we have
        await this.appendDebuggerPaths(notebook);

        // Check the version of debugger that we have already installed
        const debuggerVersion = await this.debuggerCheck(notebook);
        const requiredVersion =
            this.debuggerPackage === 'ptvsd' ? this.requiredPtvsdVersion : this.requiredDebugpyVersion;

        // If we don't have debugger installed or the version is too old then we need to install it
        if (!debuggerVersion || !this.debuggerMeetsRequirement(debuggerVersion, requiredVersion)) {
            await this.promptToInstallDebugger(notebook, debuggerVersion);
        }

        // Connect local or remote based on what type of notebook we're talking to
        const connectionInfo = notebook.connection;
        if (connectionInfo && !connectionInfo.localLaunch) {
            result = await this.connectToRemote(notebook, connectionInfo);
        } else {
            result = await this.connectToLocal(notebook);
        }

        if (result) {
            this.configs.set(notebook.identity.toString(), result);
        }

        return result;
    }

    /**
     * Gets the path to debugger.
     * Temporary hack to check if python >= 3.7 and if experiments is enabled, then use new debugger, else old.
     * (temporary to hard-code and use these in here).
     * The old debugger will soon go away into oblivion...
     * @private
     * @param {INotebook} notebook
     * @returns {Promise<string>}
     * @memberof JupyterDebugger
     */
    private async getDebuggerPath(notebook: INotebook): Promise<string> {
        if (this.debuggerPackage === 'ptvsd') {
            return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'old_ptvsd');
        }
        const pythonVersion = await this.getKernelPythonVersion(notebook);
        // The new debug adapter with wheels is only supported in 3.7
        // Code can be found here (src/client/debugger/extension/adapter/factory.ts).
        if (pythonVersion && pythonVersion.major === 3 && pythonVersion.minor === 7) {
            // Return debugger with wheels
            return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy', 'wheels');
        }

        // We are here so this is NOT python 3.7, return debugger without wheels
        return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy', 'no_wheels');
    }
    private async calculateDebuggerPathList(notebook: INotebook): Promise<string | undefined> {
        const extraPaths: string[] = [];

        // Add the settings path first as it takes precedence over the ptvsd extension path
        // tslint:disable-next-line:no-multiline-string
        let settingsPath = this.configService.getSettings(notebook.resource).datascience.ptvsdDistPath;
        // Escape windows path chars so they end up in the source escaped
        if (settingsPath) {
            if (this.platform.isWindows) {
                settingsPath = settingsPath.replace(/\\/g, '\\\\');
            }

            extraPaths.push(settingsPath);
        }

        // For a local connection we also need will append on the path to the debugger
        // installed locally by the extension
        // Actually until this is resolved: https://github.com/microsoft/vscode-python/issues/7615, skip adding
        // this path.
        const connectionInfo = notebook.connection;
        if (connectionInfo && connectionInfo.localLaunch) {
            let localPath = await this.getDebuggerPath(notebook);
            if (this.platform.isWindows) {
                localPath = localPath.replace(/\\/g, '\\\\');
            }
            extraPaths.push(localPath);
        }

        if (extraPaths && extraPaths.length > 0) {
            return extraPaths.reduce((totalPath, currentPath) => {
                if (totalPath.length === 0) {
                    totalPath = `'${currentPath}'`;
                } else {
                    totalPath = `${totalPath}, '${currentPath}'`;
                }

                return totalPath;
            }, '');
        }

        return undefined;
    }

    // Append our local debugger path and debugger settings path to sys.path
    private async appendDebuggerPaths(notebook: INotebook): Promise<void> {
        const debuggerPathList = await this.calculateDebuggerPathList(notebook);

        if (debuggerPathList && debuggerPathList.length > 0) {
            const result = await this.executeSilently(
                notebook,
                `import sys\r\nsys.path.extend([${debuggerPathList}])\r\nsys.path`
            );
            this.traceCellResults('Appending paths', result);
        }
    }

    private buildSourceMap(fileHash: IFileHashes): ISourceMapRequest {
        const sourceMapRequest: ISourceMapRequest = { source: { path: fileHash.file }, pydevdSourceMaps: [] };

        sourceMapRequest.pydevdSourceMaps = fileHash.hashes.map((cellHash) => {
            return {
                line: cellHash.line,
                endLine: cellHash.endLine,
                runtimeSource: { path: `<ipython-input-${cellHash.executionCount}-${cellHash.hash}>` },
                runtimeLine: cellHash.runtimeLine
            };
        });

        return sourceMapRequest;
    }

    private executeSilently(notebook: INotebook, code: string): Promise<ICell[]> {
        return notebook.execute(code, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
    }

    private async getKernelPythonVersion(notebook: INotebook): Promise<Version | undefined> {
        const execResults = await this.executeSilently(notebook, 'import sys;print(sys.version)');
        return this.parseVersionInfo(execResults, 'pythonVersionInfo');
    }

    private async debuggerCheck(notebook: INotebook): Promise<Version | undefined> {
        // We don't want to actually import the debugger to check version so run
        // python instead. If we import an old version it's hard to get rid of on
        // an 'upgrade needed' scenario
        // tslint:disable-next-line:no-multiline-string
        const debuggerPathList = await this.calculateDebuggerPathList(notebook);

        let code;
        if (debuggerPathList) {
            code = `import sys\r\n${pythonShellCommand} -c "import sys;sys.path.extend([${debuggerPathList}]);sys.path;import ${this.debuggerPackage};print(${this.debuggerPackage}.__version__)"`;
        } else {
            code = `import sys\r\n${pythonShellCommand} -c "import ${this.debuggerPackage};print(${this.debuggerPackage}.__version__)"`;
        }

        const debuggerVersionResults = await this.executeSilently(notebook, code);
        const purpose = this.debuggerPackage === 'ptvsd' ? 'parsePtvsdVersionInfo' : 'parseDebugpyVersionInfo';
        return this.parseVersionInfo(debuggerVersionResults, purpose);
    }

    private parseVersionInfo(
        cells: ICell[],
        purpose: 'parsePtvsdVersionInfo' | 'parseDebugpyVersionInfo' | 'pythonVersionInfo'
    ): Version | undefined {
        if (cells.length < 1 || cells[0].state !== CellState.finished) {
            this.traceCellResults(purpose, cells);
            return undefined;
        }

        const targetCell = cells[0];

        const outputString = this.extractOutput(targetCell);

        if (outputString) {
            // Pull out the version number, note that we can't use SemVer here as python packages don't follow it
            const packageVersionRegex = /([0-9]+).([0-9]+).([0-9a-zA-Z]+)/;
            const packageVersionMatch = packageVersionRegex.exec(outputString);

            if (packageVersionMatch) {
                const major = parseInt(packageVersionMatch[1], 10);
                const minor = parseInt(packageVersionMatch[2], 10);
                const patch = parseInt(packageVersionMatch[3], 10);
                return {
                    major,
                    minor,
                    patch,
                    build: [],
                    prerelease: [],
                    raw: `${major}.${minor}.${patch}`
                };
            }
        }

        this.traceCellResults(purpose, cells);

        return undefined;
    }

    // Check to see if the we have the required version of debugger to support debugging
    private debuggerMeetsRequirement(version: Version, required: Version): boolean {
        return version.major > required.major || (version.major === required.major && version.minor >= required.minor);
    }

    @captureTelemetry(Telemetry.PtvsdPromptToInstall)
    private async promptToInstallDebugger(notebook: INotebook, oldVersion: Version | undefined): Promise<void> {
        const promptMessage = oldVersion
            ? localize.DataScience.jupyterDebuggerInstallUpdate().format(this.debuggerPackage)
            : localize.DataScience.jupyterDebuggerInstallNew().format(this.debuggerPackage);
        const result = await this.appShell.showInformationMessage(
            promptMessage,
            localize.DataScience.jupyterDebuggerInstallYes(),
            localize.DataScience.jupyterDebuggerInstallNo()
        );

        if (result === localize.DataScience.jupyterDebuggerInstallYes()) {
            await this.installDebugger(notebook);
        } else {
            // If they don't want to install, throw so we exit out of debugging
            sendTelemetryEvent(Telemetry.PtvsdInstallCancelled);
            throw new JupyterDebuggerNotInstalledError(this.debuggerPackage);
        }
    }

    private async installDebugger(notebook: INotebook): Promise<void> {
        // tslint:disable-next-line:no-multiline-string
        const debuggerInstallResults = await this.executeSilently(
            notebook,
            `import sys\r\n${pythonShellCommand} -m pip install -U ${this.debuggerPackage}`
        );
        traceInfo(`Installing ${this.debuggerPackage}`);

        if (debuggerInstallResults.length > 0) {
            const installResultsString = this.extractOutput(debuggerInstallResults[0]);

            if (installResultsString && installResultsString.includes('Successfully installed')) {
                sendTelemetryEvent(Telemetry.PtvsdSuccessfullyInstalled);
                traceInfo(`${this.debuggerPackage} successfully installed`);
                return;
            }
        }
        this.traceCellResults(`Installing ${this.debuggerPackage}`, debuggerInstallResults);
        sendTelemetryEvent(Telemetry.PtvsdInstallFailed);
        traceError(`Failed to install ${this.debuggerPackage}`);
        // Failed to install debugger, throw to exit debugging
        throw new JupyterDebuggerNotInstalledError(this.debuggerPackage);
    }

    // Pull our connection info out from the cells returned by enable_attach
    private parseConnectInfo(cells: ICell[], local: boolean): DebugConfiguration | undefined {
        if (cells.length > 0) {
            let enableAttachString = this.extractOutput(cells[0]);
            if (enableAttachString) {
                enableAttachString = enableAttachString.trimQuotes();

                // Important: This regex matches the format of the string returned from enable_attach. When
                // doing enable_attach remotely, make sure to print out a string in the format ('host', port)
                const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;

                const debugInfoMatch = debugInfoRegEx.exec(enableAttachString);
                const settings = this.configService.getSettings(getCellResource(cells[0]));
                if (debugInfoMatch) {
                    const localConfig: DebugConfiguration = {
                        name: 'IPython',
                        request: 'attach',
                        type: 'python',
                        port: parseInt(debugInfoMatch[2], 10),
                        host: debugInfoMatch[1],
                        justMyCode: settings.datascience.debugJustMyCode
                    };
                    if (local) {
                        return localConfig;
                    } else {
                        return {
                            ...localConfig,
                            pathMappings: [
                                {
                                    localRoot: this.workspace.rootPath,
                                    remoteRoot: '.'
                                }
                            ]
                        };
                    }
                }
            } else {
                // if we cannot parse the connect information, throw so we exit out of debugging
                if (cells[0].data) {
                    const outputs = cells[0].data.outputs as nbformat.IOutput[];
                    if (outputs[0]) {
                        const error = outputs[0] as nbformat.IError;
                        throw new JupyterDebuggerNotInstalledError(this.debuggerPackage, error.ename);
                    }
                }
                throw new JupyterDebuggerNotInstalledError(
                    localize.DataScience.jupyterDebuggerOutputParseError().format(this.debuggerPackage)
                );
            }
        }
        return undefined;
    }

    private extractOutput(cell: ICell): string | undefined {
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs.length > 0) {
                const data = outputs[0].data;
                if (data && data.hasOwnProperty('text/plain')) {
                    // tslint:disable-next-line:no-any
                    return (data as any)['text/plain'];
                }
                if (outputs[0].output_type === 'stream') {
                    const stream = outputs[0] as nbformat.IStream;
                    return concatMultilineStringOutput(stream.text);
                }
            }
        }
        return undefined;
    }

    private async connectToLocal(notebook: INotebook): Promise<DebugConfiguration | undefined> {
        const enableDebuggerResults = await this.executeSilently(notebook, this.enableDebuggerCode);

        // Save our connection info to this notebook
        return this.parseConnectInfo(enableDebuggerResults, true);
    }

    private async connectToRemote(
        _notebook: INotebook,
        _connectionInfo: IJupyterConnection
    ): Promise<DebugConfiguration | undefined> {
        // We actually need a token. This isn't supported at the moment
        throw new JupyterDebuggerRemoteNotSupported();

        //         let portNumber = this.configService.getSettings().datascience.remoteDebuggerPort;
        //         if (!portNumber) {
        //             portNumber = -1;
        //         }

        //         // Loop through a bunch of ports until we find one we can use. Note how we
        //         // are connecting to '0.0.0.0' here. That's the location as far as ptvsd is concerned.
        //         const attachCode = portNumber !== -1 ?
        //             `import ptvsd
        // ptvsd.enable_attach(('0.0.0.0', ${portNumber}))
        // print("('${connectionInfo.hostName}', ${portNumber})")` :
        //             // tslint:disable-next-line: no-multiline-string
        //             `import ptvsd
        // port = ${Settings.RemoteDebuggerPortBegin}
        // attached = False
        // while not attached and port <= ${Settings.RemoteDebuggerPortEnd}:
        //     try:
        //         ptvsd.enable_attach(('0.0.0.0', port))
        //         print("('${connectionInfo.hostName}', " + str(port) + ")")
        //         attached = True
        //     except Exception as e:
        //         print("Exception: " + str(e))
        //         port +=1`;
        //         const enableDebuggerResults = await this.executeSilently(server, attachCode);

        //         // Save our connection info to this server
        //         const result = this.parseConnectInfo(enableDebuggerResults, false);

        //         // If that didn't work, throw an error so somebody can open the port
        //         if (!result) {
        //             throw new JupyterDebuggerPortNotAvailableError(portNumber, Settings.RemoteDebuggerPortBegin, Settings.RemoteDebuggerPortEnd);
        //         }

        //         // Double check, open a socket? This won't work if we're remote ourselves. Actually the debug adapter runs
        //         // from the remote machine.
        //         try {
        //             const deferred = createDeferred();
        //             const socket = net.createConnection(result.port, result.host, () => {
        //                 deferred.resolve();
        //             });
        //             socket.on('error', (err) => deferred.reject(err));
        //             socket.setTimeout(2000, () => deferred.reject(new Error('Timeout trying to ping remote debugger')));
        //             await deferred.promise;
        //             socket.end();
        //         } catch (exc) {
        //             traceWarning(`Cannot connect to remote debugger at ${result.host}:${result.port} => ${exc}`);
        //             // We can't connect. Must be a firewall issue
        //             throw new JupyterDebuggerPortBlockedError(portNumber, Settings.RemoteDebuggerPortBegin, Settings.RemoteDebuggerPortEnd);
        //         }

        //         return result;
    }
}
