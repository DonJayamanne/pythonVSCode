// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { IFileSystem } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../common/process/types';
import { Resource } from '../../common/types';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { IJupyterKernelSpec } from '../types';
import { KernelProcess } from './kernelProcess';
import { IKernelConnection, IKernelFinder, IKernelLauncher, IKernelProcess } from './types';

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

    @captureTelemetry(Telemetry.KernelLauncherPerf)
    public async launch(resource: Resource, kernelName?: string | IJupyterKernelSpec): Promise<IKernelProcess> {
        let kernelSpec: IJupyterKernelSpec;
        if (!kernelName || typeof kernelName === 'string') {
            // string or undefined
            kernelSpec = await this.kernelFinder.findKernelSpec(resource, kernelName);
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
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9000 });

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
