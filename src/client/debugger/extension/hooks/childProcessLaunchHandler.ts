// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, DebugSessionCustomEvent } from 'vscode';
import { swallowExceptions } from '../../../../utils/decorators';
import { noop } from '../../../../utils/misc';
import { IApplicationShell, IDebugManager, IWorkspaceService } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { AttachRequestArguments, LaunchRequestArguments } from '../../Common/Contracts';
import { ICustomDebugSessionEventHandlers } from './types';

const eventName = 'ptvsd_subprocess';

type ChildProcessLaunchData = {
    initialProcessId: number;
    initialRequest: LaunchRequestArguments | AttachRequestArguments;
    parentProcessId: number;
    processId: number;
    port: number;
};

@injectable()
export class ChildProcessLaunchEventHandler implements ICustomDebugSessionEventHandlers {
    constructor(@inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IDebugManager) private readonly debugManager: IDebugManager,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) { }

    @traceError('Handle child process launch')
    @swallowExceptions('Handle child process launch')
    public async handleEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event || event.event !== eventName) {
            return;
        }
        const data = event.body! as ChildProcessLaunchData;
        const folder = this.getRelatedWorkspaceFolder(data);
        const debugConfig = this.getAttachConfiguration(data);
        const launched = await this.debugManager.startDebugging(folder, debugConfig);
        if (!launched) {
            this.appShell.showErrorMessage(`Failed to launch debugger for child process ${data.processId}`).then(noop, noop);
        }
    }
    protected getRelatedWorkspaceFolder(_data: ChildProcessLaunchData) {
        return this.workspaceService.workspaceFolders[0];
    }
    protected getAttachConfiguration(data: ChildProcessLaunchData): AttachRequestArguments & DebugConfiguration {
        // tslint:disable-next-line:no-any
        const config = JSON.parse(JSON.stringify(data.initialRequest)) as any as (AttachRequestArguments & DebugConfiguration);

        if (data.initialRequest.request === 'attach') {
            config.host = data.initialRequest.host!;
        }
        config.port = data.port;
        config.name = `Child Process ${data.processId}`;
        config.request = 'attach';
        return config;
    }
}
