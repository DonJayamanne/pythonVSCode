// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { ApplicationShell } from './application/applicationShell';
import { CommandManager } from './application/commandManager';
import { DebugService } from './application/debugService';
import { DocumentManager } from './application/documentManager';
import { TerminalManager } from './application/terminalManager';
import { IApplicationShell, ICommandManager, IDebugService, IDocumentManager, ITerminalManager, IWorkspaceService } from './application/types';
import { WorkspaceService } from './application/workspace';
import { ConfigurationService } from './configuration/service';
import { ProductInstaller } from './installer/productInstaller';
import { Logger } from './logger';
import { PersistentStateFactory } from './persistentState';
import { IS_64_BIT, IS_WINDOWS } from './platform/constants';
import { PathUtils } from './platform/pathUtils';
import { CurrentProcess } from './process/currentProcess';
import { Bash } from './terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from './terminal/environmentActivationProviders/commandPrompt';
import { TerminalServiceFactory } from './terminal/factory';
import { TerminalHelper } from './terminal/helper';
import { ITerminalActivationCommandProvider, ITerminalHelper, ITerminalServiceFactory } from './terminal/types';
import { IConfigurationService, ICurrentProcess, IInstaller, ILogger, IPathUtils, IPersistentStateFactory, Is64Bit, IsWindows } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
    serviceManager.addSingletonInstance<boolean>(Is64Bit, IS_64_BIT);

    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
    serviceManager.addSingleton<ILogger>(ILogger, Logger);
    serviceManager.addSingleton<ITerminalServiceFactory>(ITerminalServiceFactory, TerminalServiceFactory);
    serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
    serviceManager.addSingleton<IApplicationShell>(IApplicationShell, ApplicationShell);
    serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
    serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);
    serviceManager.addSingleton<ICommandManager>(ICommandManager, CommandManager);
    serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
    serviceManager.addSingleton<IWorkspaceService>(IWorkspaceService, WorkspaceService);
    serviceManager.addSingleton<IDocumentManager>(IDocumentManager, DocumentManager);
    serviceManager.addSingleton<ITerminalManager>(ITerminalManager, TerminalManager);
    serviceManager.addSingleton<IDebugService>(IDebugService, DebugService);

    serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
    serviceManager.addSingleton<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider, Bash, 'bashCShellFish');
    serviceManager.addSingleton<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider, CommandPromptAndPowerShell, 'commandPromptAndPowerShell');
}
