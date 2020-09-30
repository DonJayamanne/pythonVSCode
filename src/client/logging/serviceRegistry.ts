import { ApplicationShell } from '../common/application/applicationShell';
import { CommandManager } from '../common/application/commandManager';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { WorkspaceService } from '../common/application/workspace';
import { ConfigurationService } from '../common/configuration/service';
import { IConfigurationService } from '../common/types';
import { FileSystem } from '../datascience/fileSystem';
import { IDebugLoggingManager, IFileSystem } from '../datascience/types';
import { IServiceManager } from '../ioc/types';
import { DebugLoggingManager } from './debugLoggingManager';

export function registerLoggerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    serviceManager.addSingleton<ICommandManager>(ICommandManager, CommandManager);
    serviceManager.addSingleton<IWorkspaceService>(IWorkspaceService, WorkspaceService);
    serviceManager.addSingleton<IApplicationShell>(IApplicationShell, ApplicationShell);
    serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
    serviceManager.addSingleton<IDebugLoggingManager>(IDebugLoggingManager, DebugLoggingManager);
}
