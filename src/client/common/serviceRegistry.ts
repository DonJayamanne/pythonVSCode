// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { IExtensionSingleActivationService } from '../activation/types';
import { IExperimentService, IFileDownloader, IHttpClient } from '../common/types';
import { LiveShareApi } from '../datascience/liveshare/liveshare';
import { INotebookExecutionLogger } from '../datascience/types';
import { IServiceManager } from '../ioc/types';
import { ImportTracker } from '../telemetry/importTracker';
import { IImportTracker } from '../telemetry/types';
import { ActiveResourceService } from './application/activeResource';
import { ApplicationEnvironment } from './application/applicationEnvironment';
import { ClipboardService } from './application/clipboard';
import { ReloadVSCodeCommandHandler } from './application/commands/reloadCommand';
import { CustomEditorService } from './application/customEditorService';
import { DebugService } from './application/debugService';
import { DocumentManager } from './application/documentManager';
import { Extensions } from './application/extensions';
import { LanguageService } from './application/languageService';
import { VSCodeNotebook } from './application/notebook';
import {
    IActiveResourceService,
    IApplicationEnvironment,
    IClipboard,
    ICustomEditorService,
    IDebugService,
    IDocumentManager,
    ILanguageService,
    ILiveShareApi,
    IVSCodeNotebook
} from './application/types';
import { AsyncDisposableRegistry } from './asyncDisposableRegistry';
import { CryptoUtils } from './crypto';
import { EditorUtils } from './editor';
import { ExperimentService } from './experiments/service';
import { FeatureDeprecationManager } from './featureDeprecationManager';
import {
    ExtensionInsidersDailyChannelRule,
    ExtensionInsidersOffChannelRule,
    ExtensionInsidersWeeklyChannelRule
} from './insidersBuild/downloadChannelRules';
import { ExtensionChannelService } from './insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt } from './insidersBuild/insidersExtensionPrompt';
import { InsidersExtensionService } from './insidersBuild/insidersExtensionService';
import {
    ExtensionChannel,
    IExtensionChannelRule,
    IExtensionChannelService,
    IInsiderExtensionPrompt
} from './insidersBuild/types';
import { ProductInstaller } from './installer/productInstaller';
import { BrowserService } from './net/browser';
import { FileDownloader } from './net/fileDownloader';
import { HttpClient } from './net/httpClient';
import { PersistentStateFactory } from './persistentState';
import { IS_WINDOWS } from './platform/constants';
import { PathUtils } from './platform/pathUtils';
import { ProcessLogger } from './process/logger';
import { IProcessLogger } from './process/types';
import {
    IAsyncDisposableRegistry,
    IBrowserService,
    ICryptoUtils,
    IEditorUtils,
    IExtensions,
    IFeatureDeprecationManager,
    IInstaller,
    IPathUtils,
    IPersistentStateFactory,
    IsWindows
} from './types';
import { IMultiStepInputFactory, MultiStepInputFactory } from './utils/multiStepInput';

// tslint:disable-next-line: max-func-body-length
export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

    serviceManager.addSingleton<IActiveResourceService>(IActiveResourceService, ActiveResourceService);
    serviceManager.addSingleton<IExtensions>(IExtensions, Extensions);
    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
    serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
    serviceManager.addSingleton<IVSCodeNotebook>(IVSCodeNotebook, VSCodeNotebook);
    serviceManager.addSingleton<IClipboard>(IClipboard, ClipboardService);
    serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);
    serviceManager.addSingleton<IProcessLogger>(IProcessLogger, ProcessLogger);
    serviceManager.addSingleton<IDocumentManager>(IDocumentManager, DocumentManager);
    serviceManager.addSingleton<IDebugService>(IDebugService, DebugService);
    serviceManager.addSingleton<IApplicationEnvironment>(IApplicationEnvironment, ApplicationEnvironment);
    serviceManager.addSingleton<ILanguageService>(ILanguageService, LanguageService);
    serviceManager.addSingleton<IBrowserService>(IBrowserService, BrowserService);
    serviceManager.addSingleton<IHttpClient>(IHttpClient, HttpClient);
    serviceManager.addSingleton<IFileDownloader>(IFileDownloader, FileDownloader);
    serviceManager.addSingleton<IEditorUtils>(IEditorUtils, EditorUtils);
    serviceManager.addSingleton<ILiveShareApi>(ILiveShareApi, LiveShareApi);
    serviceManager.addSingleton<ICryptoUtils>(ICryptoUtils, CryptoUtils);
    serviceManager.addSingleton<IExperimentService>(IExperimentService, ExperimentService);

    serviceManager.addSingleton<IFeatureDeprecationManager>(IFeatureDeprecationManager, FeatureDeprecationManager);

    serviceManager.addSingleton<IAsyncDisposableRegistry>(IAsyncDisposableRegistry, AsyncDisposableRegistry);
    serviceManager.addSingleton<IMultiStepInputFactory>(IMultiStepInputFactory, MultiStepInputFactory);
    serviceManager.addSingleton<IImportTracker>(IImportTracker, ImportTracker);
    serviceManager.addBinding(IImportTracker, IExtensionSingleActivationService);
    serviceManager.addBinding(IImportTracker, INotebookExecutionLogger);
    serviceManager.addSingleton<IInsiderExtensionPrompt>(IInsiderExtensionPrompt, InsidersExtensionPrompt);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        InsidersExtensionService
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ReloadVSCodeCommandHandler
    );
    serviceManager.addSingleton<IExtensionChannelService>(IExtensionChannelService, ExtensionChannelService);
    serviceManager.addSingleton<IExtensionChannelRule>(
        IExtensionChannelRule,
        ExtensionInsidersOffChannelRule,
        ExtensionChannel.off
    );
    serviceManager.addSingleton<IExtensionChannelRule>(
        IExtensionChannelRule,
        ExtensionInsidersDailyChannelRule,
        ExtensionChannel.daily
    );
    serviceManager.addSingleton<IExtensionChannelRule>(
        IExtensionChannelRule,
        ExtensionInsidersWeeklyChannelRule,
        ExtensionChannel.weekly
    );
    serviceManager.addSingleton<ICustomEditorService>(ICustomEditorService, CustomEditorService);
}
