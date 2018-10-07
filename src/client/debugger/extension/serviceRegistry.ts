// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../../ioc/types';
import { IDebuggerBanner } from '../types';
import { DebuggerBanner } from './banner';
import { registerTypes as register } from './configProviders/serviceRegistry';
import { ChildProcessLaunchEventHandler } from './hooks/childProcessLaunchHandler';
import { ICustomDebugSessionEventHandlers } from './hooks/types';

const attachToChildProcess = 'ATTACH';

export function registerTypes(serviceManager: IServiceManager) {
    register(serviceManager);
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
    serviceManager.add<ICustomDebugSessionEventHandlers>(ICustomDebugSessionEventHandlers,
        ChildProcessLaunchEventHandler,
        attachToChildProcess);
}
