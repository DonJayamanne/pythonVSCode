// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../../ioc/types';
import { IApplicationDiagnostics } from '../types';
import { ApplicationDiagnostics } from './applicationDiagnostics';
import { DiagnosticsCommandFactory } from './commands/factory';
import { IDiagnosticsCommandFactory } from './commands/types';
import { DiagnosticFilterService } from './filter';
import {
    DiagnosticCommandPromptHandlerService,
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt
} from './promptHandler';
import { IDiagnosticFilterService, IDiagnosticHandlerService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDiagnosticFilterService>(IDiagnosticFilterService, DiagnosticFilterService);
    serviceManager.addSingleton<IDiagnosticHandlerService<MessageCommandPrompt>>(
        IDiagnosticHandlerService,
        DiagnosticCommandPromptHandlerService,
        DiagnosticCommandPromptHandlerServiceId
    );
    serviceManager.addSingleton<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory, DiagnosticsCommandFactory);
    serviceManager.addSingleton<IApplicationDiagnostics>(IApplicationDiagnostics, ApplicationDiagnostics);
}
