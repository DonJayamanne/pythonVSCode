// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { Subject } from 'rxjs/Subject';
import { MessageConnection, RequestType0 } from 'vscode-jsonrpc';
import { BasePythonDaemon } from '../../common/process/baseDaemon';
import {
    IPythonExecutionService,
    ObservableExecutionResult,
    Output,
    SpawnOptions,
    StdErrError
} from '../../common/process/types';
import { IDisposable } from '../../common/types';

export interface IKernelDaemon extends IDisposable {
    interrupt(): Promise<void>;
    kill(): Promise<void>;
    start(moduleName: string, args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>>;
}

export class KernelDaemon extends BasePythonDaemon implements IKernelDaemon {
    constructor(
        pythonExecutionService: IPythonExecutionService,
        pythonPath: string,
        proc: ChildProcess,
        connection: MessageConnection
    ) {
        super(pythonExecutionService, pythonPath, proc, connection);
    }
    public async interrupt() {
        const request = new RequestType0<void, void, void>('interrupt_kernel');
        await this.sendRequestWithoutArgs(request);
    }
    public async kill() {
        const request = new RequestType0<void, void, void>('kill_kernel');
        await this.sendRequestWithoutArgs(request);
    }
    public async start(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ObservableExecutionResult<string>> {
        const subject = new Subject<Output<string>>();

        this.outputObservale.subscribe((out) => {
            if (out.source === 'stderr' && options.throwOnStdErr) {
                subject.error(new StdErrError(out.out));
            } else if (out.source === 'stderr' && options.mergeStdOutErr) {
                subject.next({ source: 'stdout', out: out.out });
            } else {
                subject.next(out);
            }
        });

        // No need of the output here, we'll tap into the output coming from daemon `this.outputObservale`.
        // This is required because execModule will never end.
        // We cannot use `execModuleObservable` as that only works where the daemon is busy seeerving on request and we wait for it to finish.
        // In this case we're never going to wait for the module to run to end. Cuz when we run `pytohn -m ipykernel`, it never ends.
        // It only ends when the kernel dies, meaning the kernel process is dead.
        // What we need is to be able to run the module and keep getting a stream of stdout/stderr.
        // & also be able to execute other python code. I.e. we need a daemon.
        // For this we run the `ipykernel` code in a separate thread.
        // This is why when we run `execModule` in the Kernel daemon, it finishes (comes back) quickly.
        // However in reality it is running in the background.
        // See `m_exec_module_observable` in `kernel_launcher_daemon.py`.
        await this.execModule(moduleName, args, options);

        return {
            proc: this.proc,
            dispose: () => this.dispose(),
            out: subject
        };
    }
}
