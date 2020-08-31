// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IExtensionSingleActivationService } from '../activation/types';
import { PythonApiService } from '../api/pythonApi';
import { IEnvironmentActivationService, IInterpreterService } from '../api/types';
import { FileSystemPathUtils } from '../common/platform/fs-paths';
import { IFileSystemPathUtils } from '../common/platform/types';
import { IServiceManager } from '../ioc/types';
import { Activation } from './activation';
import { JupyterCommandLineSelectorCommand } from './commands/commandLineSelector';
import { CommandRegistry } from './commands/commandRegistry';
import { ExportCommands } from './commands/exportCommands';
import { NotebookCommands } from './commands/notebookCommands';
import { JupyterServerSelectorCommand } from './commands/serverSelector';
import { DataScienceStartupTime, VSCodeNotebookProvider } from './constants';
import { ActiveEditorContextService } from './context/activeEditorContext';
import { DataScience } from './datascience';
import { DataScienceFileSystem } from './dataScienceFileSystem';
import { DataScienceErrorHandler } from './errorHandler/errorHandler';
import { ExportBase } from './export/exportBase';
import { ExportDependencyChecker } from './export/exportDependencyChecker';
import { ExportFileOpener } from './export/exportFileOpener';
import { ExportManager } from './export/exportManager';
import { ExportManagerFilePicker } from './export/exportManagerFilePicker';
import { ExportToHTML } from './export/exportToHTML';
import { ExportToPDF } from './export/exportToPDF';
import { ExportToPython } from './export/exportToPython';
import { ExportUtil } from './export/exportUtil';
import { ExportFormat, IExport, IExportManager, IExportManagerFilePicker } from './export/types';
import { NotebookProvider } from './interactive-common/notebookProvider';
import { NotebookServerProvider } from './interactive-common/notebookServerProvider';
import { NotebookUsageTracker } from './interactive-common/notebookUsageTracker';
import { JupyterCommandLineSelector } from './jupyter/commandLineSelector';
import { JupyterCommandFactory } from './jupyter/interpreter/jupyterCommand';
import { JupyterInterpreterDependencyService } from './jupyter/interpreter/jupyterInterpreterDependencyService';
import { JupyterInterpreterOldCacheStateStore } from './jupyter/interpreter/jupyterInterpreterOldCacheStateStore';
import { JupyterInterpreterSelectionCommand } from './jupyter/interpreter/jupyterInterpreterSelectionCommand';
import { JupyterInterpreterSelector } from './jupyter/interpreter/jupyterInterpreterSelector';
import { JupyterInterpreterService } from './jupyter/interpreter/jupyterInterpreterService';
import { JupyterInterpreterStateStore } from './jupyter/interpreter/jupyterInterpreterStateStore';
import { JupyterInterpreterSubCommandExecutionService } from './jupyter/interpreter/jupyterInterpreterSubCommandExecutionService';
import { CellOutputMimeTypeTracker } from './jupyter/jupyterCellOutputMimeTypeTracker';
import { JupyterExecutionFactory } from './jupyter/jupyterExecutionFactory';
import { JupyterExporter } from './jupyter/jupyterExporter';
import { JupyterImporter } from './jupyter/jupyterImporter';
import { JupyterNotebookProvider } from './jupyter/jupyterNotebookProvider';
import { JupyterPasswordConnect } from './jupyter/jupyterPasswordConnect';
import { JupyterServerWrapper } from './jupyter/jupyterServerWrapper';
import { JupyterSessionManagerFactory } from './jupyter/jupyterSessionManagerFactory';
import { KernelDependencyService } from './jupyter/kernels/kernelDependencyService';
import { KernelSelectionProvider } from './jupyter/kernels/kernelSelections';
import { KernelSelector } from './jupyter/kernels/kernelSelector';
import { KernelService } from './jupyter/kernels/kernelService';
import { KernelSwitcher } from './jupyter/kernels/kernelSwitcher';
import { NotebookStarter } from './jupyter/notebookStarter';
import { ServerPreload } from './jupyter/serverPreload';
import { JupyterServerSelector } from './jupyter/serverSelector';
import { JupyterUriProviderRegistration } from './jupyterUriProviderRegistration';
import { KernelDaemonPool } from './kernel-launcher/kernelDaemonPool';
import { KernelDaemonPreWarmer } from './kernel-launcher/kernelDaemonPreWarmer';
import { KernelFinder } from './kernel-launcher/kernelFinder';
import { KernelLauncher } from './kernel-launcher/kernelLauncher';
import { IKernelFinder, IKernelLauncher } from './kernel-launcher/types';
import { NotebookEditorCompatibilitySupport } from './notebook/notebookEditorCompatibilitySupport';
import { NotebookEditorProvider } from './notebook/notebookEditorProvider';
import { NotebookEditorProviderWrapper } from './notebook/notebookEditorProviderWrapper';
import { registerTypes as registerNotebookTypes } from './notebook/serviceRegistry';
import { NotebookAndInteractiveWindowUsageTracker } from './notebookAndInteractiveTracker';
import { NotebookModelFactory } from './notebookStorage/factory';
import { NativeEditorStorage } from './notebookStorage/nativeEditorStorage';
import { INotebookStorageProvider, NotebookStorageProvider } from './notebookStorage/notebookStorageProvider';
import { INotebookModelFactory } from './notebookStorage/types';
import { PreWarmActivatedJupyterEnvironmentVariables } from './preWarmVariables';
import { ProgressReporter } from './progress/progressReporter';
import { RawNotebookProviderWrapper } from './raw-kernel/rawNotebookProviderWrapper';
import { RawNotebookSupportedService } from './raw-kernel/rawNotebookSupportedService';
import { StatusProvider } from './statusProvider';
import {
    IDataScience,
    IDataScienceErrorHandler,
    IDataScienceFileSystem,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterInterpreterDependencyManager,
    IJupyterNotebookProvider,
    IJupyterPasswordConnect,
    IJupyterServerProvider,
    IJupyterSessionManagerFactory,
    IJupyterSubCommandExecutionService,
    IJupyterUriProviderRegistration,
    IKernelDependencyService,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditorProvider,
    INotebookExecutionLogger,
    INotebookExporter,
    INotebookImporter,
    INotebookProvider,
    INotebookServer,
    INotebookStorage,
    IRawNotebookProvider,
    IRawNotebookSupportedService,
    IStatusProvider
} from './types';

// README: Did you make sure "dataScienceIocContainer.ts" has also been updated appropriately?

// tslint:disable-next-line: max-func-body-length
export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<PythonApiService>(PythonApiService, PythonApiService);
    serviceManager.addBinding(PythonApiService, IEnvironmentActivationService);
    serviceManager.addBinding(PythonApiService, IInterpreterService);

    serviceManager.addSingletonInstance<number>(DataScienceStartupTime, Date.now());

    // This condition is temporary.
    serviceManager.addSingleton<INotebookEditorProvider>(VSCodeNotebookProvider, NotebookEditorProvider);
    serviceManager.addSingleton<INotebookEditorProvider>(INotebookEditorProvider, NotebookEditorProviderWrapper);
    serviceManager.add<IExtensionSingleActivationService>(IExtensionSingleActivationService, NotebookEditorCompatibilitySupport);
    serviceManager.add<NotebookEditorCompatibilitySupport>(NotebookEditorCompatibilitySupport, NotebookEditorCompatibilitySupport);

    serviceManager.addSingleton<INotebookModelFactory>(INotebookModelFactory, NotebookModelFactory);
    serviceManager.addSingleton<IDataScienceErrorHandler>(IDataScienceErrorHandler, DataScienceErrorHandler);
    serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
    serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
    serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
    serviceManager.add<INotebookServer>(INotebookServer, JupyterServerWrapper);
    serviceManager.addSingleton<INotebookStorage>(INotebookStorage, NativeEditorStorage);
    serviceManager.addSingleton<INotebookStorageProvider>(INotebookStorageProvider, NotebookStorageProvider);
    serviceManager.addSingleton<IRawNotebookProvider>(IRawNotebookProvider, RawNotebookProviderWrapper);
    serviceManager.addSingleton<IRawNotebookSupportedService>(IRawNotebookSupportedService, RawNotebookSupportedService);
    serviceManager.addSingleton<IJupyterNotebookProvider>(IJupyterNotebookProvider, JupyterNotebookProvider);
    serviceManager.addSingleton<IKernelLauncher>(IKernelLauncher, KernelLauncher);
    serviceManager.addSingleton<IKernelFinder>(IKernelFinder, KernelFinder);
    serviceManager.addSingleton<ActiveEditorContextService>(ActiveEditorContextService, ActiveEditorContextService);
    serviceManager.addSingleton<CellOutputMimeTypeTracker>(CellOutputMimeTypeTracker, CellOutputMimeTypeTracker, undefined, [IExtensionSingleActivationService, INotebookExecutionLogger]);
    serviceManager.addSingleton<CommandRegistry>(CommandRegistry, CommandRegistry);
    serviceManager.addSingleton<IDataScience>(IDataScience, DataScience);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, Activation);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, JupyterInterpreterSelectionCommand);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, PreWarmActivatedJupyterEnvironmentVariables);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, ServerPreload);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, NotebookUsageTracker);
    serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
    serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, JupyterPasswordConnect);
    serviceManager.addSingleton<IJupyterSessionManagerFactory>(IJupyterSessionManagerFactory, JupyterSessionManagerFactory);
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
    serviceManager.addSingleton<JupyterCommandLineSelector>(JupyterCommandLineSelector, JupyterCommandLineSelector);
    serviceManager.addSingleton<JupyterCommandLineSelectorCommand>(JupyterCommandLineSelectorCommand, JupyterCommandLineSelectorCommand);
    serviceManager.addSingleton<JupyterInterpreterDependencyService>(JupyterInterpreterDependencyService, JupyterInterpreterDependencyService);
    serviceManager.addSingleton<JupyterInterpreterOldCacheStateStore>(JupyterInterpreterOldCacheStateStore, JupyterInterpreterOldCacheStateStore);
    serviceManager.addSingleton<JupyterInterpreterSelector>(JupyterInterpreterSelector, JupyterInterpreterSelector);
    serviceManager.addSingleton<JupyterInterpreterService>(JupyterInterpreterService, JupyterInterpreterService);
    serviceManager.addSingleton<JupyterInterpreterStateStore>(JupyterInterpreterStateStore, JupyterInterpreterStateStore);
    serviceManager.addSingleton<JupyterServerSelector>(JupyterServerSelector, JupyterServerSelector);
    serviceManager.addSingleton<JupyterServerSelectorCommand>(JupyterServerSelectorCommand, JupyterServerSelectorCommand);
    serviceManager.addSingleton<KernelSelectionProvider>(KernelSelectionProvider, KernelSelectionProvider);
    serviceManager.addSingleton<KernelSelector>(KernelSelector, KernelSelector);
    serviceManager.addSingleton<KernelService>(KernelService, KernelService);
    serviceManager.addSingleton<KernelSwitcher>(KernelSwitcher, KernelSwitcher);
    serviceManager.addSingleton<NotebookCommands>(NotebookCommands, NotebookCommands);
    serviceManager.addSingleton<NotebookStarter>(NotebookStarter, NotebookStarter);
    serviceManager.addSingleton<ProgressReporter>(ProgressReporter, ProgressReporter);
    serviceManager.addSingleton<INotebookProvider>(INotebookProvider, NotebookProvider);
    serviceManager.addSingleton<IJupyterServerProvider>(IJupyterServerProvider, NotebookServerProvider);
    serviceManager.addSingleton<IJupyterInterpreterDependencyManager>(IJupyterInterpreterDependencyManager, JupyterInterpreterSubCommandExecutionService);
    serviceManager.addSingleton<IJupyterSubCommandExecutionService>(IJupyterSubCommandExecutionService, JupyterInterpreterSubCommandExecutionService);
    serviceManager.addSingleton<KernelDaemonPool>(KernelDaemonPool, KernelDaemonPool);
    serviceManager.addSingleton<IKernelDependencyService>(IKernelDependencyService, KernelDependencyService);
    serviceManager.addSingleton<INotebookAndInteractiveWindowUsageTracker>(INotebookAndInteractiveWindowUsageTracker, NotebookAndInteractiveWindowUsageTracker);
    serviceManager.addSingleton<KernelDaemonPreWarmer>(KernelDaemonPreWarmer, KernelDaemonPreWarmer);
    serviceManager.addSingleton<IExportManager>(IExportManager, ExportManager);
    serviceManager.addSingleton<ExportDependencyChecker>(ExportDependencyChecker, ExportDependencyChecker);
    serviceManager.addSingleton<ExportFileOpener>(ExportFileOpener, ExportFileOpener);
    serviceManager.addSingleton<IExport>(IExport, ExportToPDF, ExportFormat.pdf);
    serviceManager.addSingleton<IExport>(IExport, ExportToHTML, ExportFormat.html);
    serviceManager.addSingleton<IExport>(IExport, ExportToPython, ExportFormat.python);
    serviceManager.addSingleton<IExport>(IExport, ExportBase, 'Export Base');
    serviceManager.addSingleton<ExportUtil>(ExportUtil, ExportUtil);
    serviceManager.addSingleton<ExportCommands>(ExportCommands, ExportCommands);
    serviceManager.addSingleton<IExportManagerFilePicker>(IExportManagerFilePicker, ExportManagerFilePicker);
    serviceManager.addSingleton<IJupyterUriProviderRegistration>(IJupyterUriProviderRegistration, JupyterUriProviderRegistration);
    serviceManager.addSingleton<IDataScienceFileSystem>(IDataScienceFileSystem, DataScienceFileSystem);
    serviceManager.addSingleton<IFileSystemPathUtils>(IFileSystemPathUtils, FileSystemPathUtils);

    registerNotebookTypes(serviceManager);
}
