// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import { IPythonExecutionFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { KernelLauncherDaemonModule } from '../constants';
import { IJupyterKernelSpec } from '../types';
import { IKernelDaemon, KernelDaemon } from './kernelDaemon';

/**
 * Responsible for execution of jupyter sub commands using a single/global interpreter set aside for launching jupyter server.
 *
 * @export
 * @class JupyterCommandFinderInterpreterExecutionService
 * @implements {IJupyterSubCommandExecutionService}
 */
@injectable()
export class KernelLauncherDaemon implements IDisposable {
    private readonly processesToDispose: ChildProcess[] = [];
    constructor(@inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory) {}
    public async launch(
        resource: Resource,
        args: string[],
        kernelSpec: IJupyterKernelSpec
    ): Promise<{ observableResult: ObservableExecutionResult<string>; daemon: IKernelDaemon }> {
        const pythonPath = kernelSpec.argv[0];
        const daemon = await this.pythonExecutionFactory.createDaemon<IKernelDaemon>({
            daemonModule: KernelLauncherDaemonModule,
            pythonPath: pythonPath,
            daemonClass: KernelDaemon,
            dedicated: true,
            resource
        });
        // const args = kernelSpec.argv.slice();
        // args.shift(); // Remove executable.
        args.shift(); // Remove `-m`.
        const moduleName = args.shift();
        if (!moduleName) {
            const providedArgs = kernelSpec.argv.join(' ');
            throw new Error(
                `Unsupported KernelSpec file. args must be [<pythonPath>, '-m', <moduleName>, arg1, arg2, ..]. Provied ${providedArgs}`
            );
        }
        const observableResult = await daemon.start(moduleName, args, { env: kernelSpec.env });
        if (observableResult.proc) {
            this.processesToDispose.push(observableResult.proc);
        }
        return { observableResult, daemon };
    }
    public dispose() {
        while (this.processesToDispose.length) {
            try {
                this.processesToDispose.shift()!.kill();
            } catch {
                noop();
            }
        }
    }
}
