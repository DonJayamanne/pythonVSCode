// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IWorkspaceService } from './common/application/types';
import { isTestExecution } from './common/constants';
import { traceError } from './common/logger';
import { IServiceContainer } from './ioc/types';
import { sendTelemetryEvent } from './telemetry';
import { EventName } from './telemetry/constants';
import { EditorLoadTelemetry } from './telemetry/types';

interface IStopWatch {
    elapsedTime: number;
}

export async function sendStartupTelemetry(
    // tslint:disable-next-line:no-any
    activatedPromise: Promise<any>,
    durations: Record<string, number>,
    stopWatch: IStopWatch,
    serviceContainer: IServiceContainer
) {
    if (isTestExecution()) {
        return;
    }

    try {
        await activatedPromise;
        durations.totalActivateTime = stopWatch.elapsedTime;
        const props = await getActivationTelemetryProps(serviceContainer);
        sendTelemetryEvent(EventName.EXTENSION_LOAD, durations, props);
    } catch (ex) {
        traceError('sendStartupTelemetry() failed.', ex);
    }
}

export async function sendErrorTelemetry(
    ex: Error,
    durations: Record<string, number>,
    serviceContainer?: IServiceContainer
) {
    try {
        // tslint:disable-next-line:no-any
        let props: any = {};
        if (serviceContainer) {
            try {
                props = await getActivationTelemetryProps(serviceContainer);
            } catch (ex) {
                traceError('getActivationTelemetryProps() failed.', ex);
            }
        }
        sendTelemetryEvent(EventName.EXTENSION_LOAD, durations, props, ex);
    } catch (exc2) {
        traceError('sendErrorTelemetry() failed.', exc2);
    }
}

async function getActivationTelemetryProps(serviceContainer: IServiceContainer): Promise<EditorLoadTelemetry> {
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Not all of this data is showing up in the database...
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: If any one of these parts fails we send no info.  We should
    // be able to partially populate as much as possible instead
    // (through granular try-catch statements).
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const workspaceFolderCount = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders!.length : 0;
    return {
        workspaceFolderCount
    };
}
