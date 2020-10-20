// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length
import { OutputChannel, window } from 'vscode';

import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { IExtensionActivationManager } from './activation/types';
import { registerTypes as registerApiTypes } from './api/serviceRegistry';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { IApplicationEnvironment, IApplicationShell, ICommandManager } from './common/application/types';
import { STANDARD_OUTPUT_CHANNEL, UseProposedApi } from './common/constants';
import { Experiments } from './common/experiments/groups';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { IFileSystem } from './common/platform/types';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import {
    IConfigurationService,
    IExperimentService,
    IExtensionContext,
    IFeatureDeprecationManager,
    IOutputChannel
} from './common/types';
import * as localize from './common/utils/localize';
import { noop } from './common/utils/misc';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { JUPYTER_OUTPUT_CHANNEL } from './datascience/constants';
import { registerTypes as dataScienceRegisterTypes } from './datascience/serviceRegistry';
import { IDataScience, IDebugLoggingManager } from './datascience/types';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { addOutputChannelLogging, setLoggingLevel } from './logging';
import { registerLoggerTypes } from './logging/serviceRegistry';
import { setExtensionInstallTelemetryProperties } from './telemetry/extensionInstallTelemetry';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';

export async function activateComponents(
    context: IExtensionContext,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
) {
    // We will be pulling code over from activateLegacy().

    return activateLegacy(context, serviceManager, serviceContainer);
}

/////////////////////////////
// old activation code

// tslint:disable-next-line:no-suspicious-comment
// TODO: Gradually move simple initialization
// and DI registration currently in this function over
// to initializeComponents().  Likewise with complex
// init and activation: move them to activateComponents().
// See https://github.com/microsoft/vscode-python/issues/10454.

async function activateLegacy(
    context: IExtensionContext,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
) {
    // register "services"
    const jupyterOutputChannel = window.createOutputChannel(localize.OutputChannelNames.jupyter());
    const standardOutputChannel = jupyterOutputChannel;
    addOutputChannelLogging(standardOutputChannel);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, jupyterOutputChannel, JUPYTER_OUTPUT_CHANNEL);

    // Initialize logging to file if necessary as early as possible
    registerLoggerTypes(serviceManager);
    const debugLoggingManager = serviceManager.get<IDebugLoggingManager>(IDebugLoggingManager);
    await debugLoggingManager.initialize();

    // Core registrations (non-feature specific).
    registerApiTypes(serviceManager);
    commonRegisterTypes(serviceManager);
    platformRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);

    // We need to setup this property before any telemetry is sent
    const fs = serviceManager.get<IFileSystem>(IFileSystem);
    await setExtensionInstallTelemetryProperties(fs);

    const applicationEnv = serviceManager.get<IApplicationEnvironment>(IApplicationEnvironment);
    const enableProposedApi = applicationEnv.packageJson.enableProposedApi;
    serviceManager.addSingletonInstance<boolean>(UseProposedApi, enableProposedApi);
    // Feature specific registrations.
    variableRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    // We should start logging using the log level as soon as possible, so set it as soon as we can access the level.
    // `IConfigurationService` may depend any of the registered types, so doing it after all registrations are finished.
    // XXX Move this *after* abExperiments is activated?
    setLoggingLevel(configuration.getSettings().logging.level);

    // Load the two data science experiments that we need to register types
    // Await here to keep the register method sync
    const experimentService = serviceContainer.get<IExperimentService>(IExperimentService);
    let useVSCodeNotebookAPI = await experimentService.inExperiment(Experiments.NativeNotebook);
    let inCustomEditorApiExperiment = await experimentService.inExperiment(Experiments.CustomEditor);

    // These should be mutually exclusive, but if someone opts into both, notify them and disable both
    if (useVSCodeNotebookAPI && inCustomEditorApiExperiment) {
        const appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        appShell.showErrorMessage(localize.DataScience.illegalEditorConfig()).then(noop, noop);
        useVSCodeNotebookAPI = false;
        inCustomEditorApiExperiment = false;
    }

    // Register datascience types after experiments have loaded.
    // To ensure we can register types based on experiments.
    dataScienceRegisterTypes(serviceManager, useVSCodeNotebookAPI, inCustomEditorApiExperiment);

    // Language feature registrations.
    appRegisterTypes(serviceManager);
    activationRegisterTypes(serviceManager);

    // "initialize" "services"
    const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager);
    cmdManager.executeCommand('setContext', 'jupyter.vscode.channel', applicationEnv.channel).then(noop, noop);

    // "activate" everything else

    const manager = serviceContainer.get<IExtensionActivationManager>(IExtensionActivationManager);
    context.subscriptions.push(manager);
    const activationPromise = manager.activate();

    // Activate data science features
    const dataScience = serviceManager.get<IDataScience>(IDataScience);
    dataScience.activate().ignoreErrors();

    const deprecationMgr = serviceContainer.get<IFeatureDeprecationManager>(IFeatureDeprecationManager);
    deprecationMgr.initialize();
    context.subscriptions.push(deprecationMgr);

    return { activationPromise };
}
