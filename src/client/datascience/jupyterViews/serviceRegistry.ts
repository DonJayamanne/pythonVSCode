// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../../ioc/types';
import { KernelsView } from './kernelView';
import { NotebookMetadataView } from './notebookMetadataView';
import { SessionsView } from './sessionsView';
import { VariablesView } from './variablesView';
export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<NotebookMetadataView>(NotebookMetadataView, NotebookMetadataView);
    serviceManager.addSingleton<KernelsView>(KernelsView, KernelsView);
    serviceManager.addSingleton<VariablesView>(VariablesView, VariablesView);
    serviceManager.addSingleton<SessionsView>(SessionsView, SessionsView);
}
