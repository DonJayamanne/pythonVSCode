// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { MessageConnection, RequestType0 } from 'vscode-jsonrpc';
import { PythonDaemonExecutionService } from '../../common/process/pythonDaemon';
import { IPythonExecutionService } from '../../common/process/types';

export class KernelDaemon extends PythonDaemonExecutionService {
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
}
