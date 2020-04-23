// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter } from 'vscode';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { InterpreterUri } from '../../common/installer/types';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IJupyterKernelSpec } from '../types';
import { IKernelDaemon } from './kernelDaemon';
import { findIndexOfConnectionFile } from './kernelFinder';
import { KernelLauncherDaemon } from './kernelLauncherDaemon';
import { IKernelConnection, IKernelFinder, IKernelLauncher, IKernelProcess } from './types';
import { WrappedError } from '../../common/errors/errorUtils';

// Launches and disposes a kernel process given a kernelspec and a resource or python interpreter.
// Exposes connection information and the process itself.
class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private connectionFile?: TemporaryFile;
    private readyPromise: Deferred<void>;
    private exitEvent: EventEmitter<number | null> = new EventEmitter<number | null>();

    // This promise is resolved when the launched process is ready to get JMP messages
    public get ready(): Promise<void> {
        return this.readyPromise.promise;
    }

    // This event is triggered if the process is exited
    public get exited(): Event<number | null> {
        return this.exitEvent.event;
    }

    public get kernelSpec(): Readonly<IJupyterKernelSpec> {
        return this._kernelSpec;
    }
    public get connection(): Readonly<IKernelConnection> {
        return this._connection;
    }
    private readonly kernelLauncherDaemon: KernelLauncherDaemon;
    private launchedOnce?: boolean;
    private kernelDaemon?: IKernelDaemon;
    constructor(
        private pythonExecutionFactory: IPythonExecutionFactory,
        private processExecutionFactory: IProcessServiceFactory,
        private file: IFileSystem,
        private _connection: IKernelConnection,
        private _kernelSpec: IJupyterKernelSpec
    ) {
        this.readyPromise = createDeferred<void>();
        this.kernelLauncherDaemon = new KernelLauncherDaemon(this.pythonExecutionFactory);
    }
    public async interrupt(): Promise<void> {
        if (this.kernelDaemon) {
            await this.kernelDaemon?.interrupt();
        }
    }
    public kill() {
        this.kernelDaemon?.kill().catch(traceWarning.bind('Failed to kill Kernel Daemon')); // NOSONAR
    }
    public async launch(): Promise<void> {
        if (this.launchedOnce) {
            throw new Error('Launch cannot be called more than once');
        }
        this.launchedOnce = true;

        this.connectionFile = await this.file.createTemporaryFile('.json');
        const args = [...this._kernelSpec.argv];
        await this.file.writeFile(this.connectionFile.filePath, JSON.stringify(this._connection), {
            encoding: 'utf-8',
            flag: 'w'
        });

        // Inclide the conenction file in the arguments and remove the first argument which should be python
        const indexOfConnectionFile = findIndexOfConnectionFile(this._kernelSpec);
        if (indexOfConnectionFile === -1) {
            throw new Error(`Connection file not found in kernelspec json args, ${args.join(' ')}`);
        }
        args[indexOfConnectionFile] = this.connectionFile.filePath;
        // args[indexOfConnectionFile] = '/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/wow.json';
        // First part of argument is always the executable.
        const executable = this._kernelSpec.metadata?.interpreter?.path || args[0];
        args.shift();

        let exeObs: ObservableExecutionResult<string>;
        const resource: Resource = undefined;
        if (executable && this._kernelSpec.language.toLowerCase() === PYTHON_LANGUAGE.toLowerCase()) {
            const { observableResult, daemon } = await this.kernelLauncherDaemon.launch(
                resource,
                args,
                this._kernelSpec
            );
            this.kernelDaemon = daemon;
            exeObs = observableResult;
        } else {
            const executionService = await this.processExecutionFactory.create(resource);
            // tslint:disable-next-line: no-any
            const env = this._kernelSpec.env as any;
            exeObs = executionService.execObservable(executable, args, { env });
        }

        if (exeObs.proc) {
            exeObs.proc!.on('exit', (exitCode) => {
                traceInfo('KernelProcess Exit', `Exit - ${exitCode}`);
                if (!this.readyPromise.completed) {
                    this.readyPromise.reject(new Error(localize.DataScience.rawKernelProcessExitBeforeConnect()));
                }
                this.exitEvent.fire(exitCode);
            });
        } else {
            traceInfo('KernelProcess failed to launch');
            this.readyPromise.reject(new Error(localize.DataScience.rawKernelProcessNotStarted()));
        }
        let stdout = '';
        let stderr = '';
        exeObs.out.subscribe(
            (output) => {
                if (output.source === 'stderr') {
                    stderr += output.out;
                    traceWarning(`StdErr from Kernel Process ${output.out}`);
                } else {
                    stdout += output.out;
                    // Search for --existing this is the message that will indicate that our kernel is actually
                    // up and started from stdout
                    //    To connect another client to this kernel, use:
                    //    --existing /var/folders/q7/cn8fg6s94fgdcl0h7rbxldf00000gn/T/tmp-16231TOL2dgBoWET1.json
                    if (!this.readyPromise.completed && stdout.includes('--existing')) {
                        this.readyPromise.resolve();
                    }
                    traceInfo(output.out);
                }
            },
            (error) => {
                if (this.readyPromise.completed) {
                    traceInfo('KernelProcess Error', error, stderr);
                } else {
                    traceError('Kernel died before it could start', error, stderr);
                    const errorMessage = `${localize.DataScience.rawKernelProcessExitBeforeConnect()}. Error = ${error}, stderr = ${stderr}`;
                    const errorToWrap = error instanceof Error ? error : new Error(error);
                    this.readyPromise.reject(new WrappedError(errorMessage, errorToWrap));
                }
            }
        );
        this._process = exeObs.proc;
    }

    public async dispose(): Promise<void> {
        try {
            if (this.kernelDaemon) {
                await this.kernelDaemon?.kill().catch(noop);
                this.kernelDaemon.dispose();
            }
            this._process?.kill();
            this.connectionFile?.dispose();
        } catch {
            noop();
        }
    }
}

// Launches and returns a kernel process given a resource or python interpreter.
// If the given interpreter is undefined, it will try to use the selected interpreter.
// If the selected interpreter doesn't have a kernel, it will find a kernel on disk and use that.
@injectable()
export class KernelLauncher implements IKernelLauncher {
    constructor(
        @inject(IKernelFinder) private kernelFinder: IKernelFinder,
        @inject(IPythonExecutionFactory) private pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IProcessServiceFactory) private processExecutionFactory: IProcessServiceFactory,
        @inject(IFileSystem) private file: IFileSystem
    ) {}

    public async launch(
        interpreterUri: InterpreterUri,
        kernelName?: string | IJupyterKernelSpec
    ): Promise<IKernelProcess> {
        let kernelSpec: IJupyterKernelSpec;
        if (!kernelName || typeof kernelName === 'string') {
            // string or undefined
            kernelSpec = await this.kernelFinder.findKernelSpec(interpreterUri, kernelName);
        } else {
            // IJupyterKernelSpec
            kernelSpec = kernelName;
        }

        const connection = await this.getKernelConnection();
        const kernelProcess = new KernelProcess(
            this.pythonExecutionFactory,
            this.processExecutionFactory,
            this.file,
            connection,
            kernelSpec
        );
        await kernelProcess.launch();
        return kernelProcess;
    }

    private async getKernelConnection(): Promise<IKernelConnection> {
        const getPorts = promisify(portfinder.getPorts);
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9100 });

        return {
            version: 1,
            key: uuid(),
            signature_scheme: 'hmac-sha256',
            transport: 'tcp',
            ip: '127.0.0.1',
            hb_port: ports[0],
            control_port: ports[1],
            shell_port: ports[2],
            stdin_port: ports[3],
            iopub_port: ports[4]
        };
    }
}
