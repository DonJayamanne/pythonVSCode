// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { DebugAdapterActivator } from './adapter/activator';
import { DebugAdapterDescriptorFactory } from './adapter/factory';
import { DebugSessionLoggingFactory } from './adapter/logging';
import { OutdatedDebuggerPromptFactory } from './adapter/outdatedDebuggerPrompt';

import { IDebugAdapterDescriptorFactory, IDebugSessionLoggingFactory, IOutdatedDebuggerPromptFactory } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        DebugAdapterActivator
    );
    serviceManager.addSingleton<IDebugAdapterDescriptorFactory>(
        IDebugAdapterDescriptorFactory,
        DebugAdapterDescriptorFactory
    );
    serviceManager.addSingleton<IDebugSessionLoggingFactory>(IDebugSessionLoggingFactory, DebugSessionLoggingFactory);
    serviceManager.addSingleton<IOutdatedDebuggerPromptFactory>(
        IOutdatedDebuggerPromptFactory,
        OutdatedDebuggerPromptFactory
    );
}
