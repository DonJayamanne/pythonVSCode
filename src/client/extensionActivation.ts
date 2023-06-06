// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { debug, DebugConfigurationProvider, DebugConfigurationProviderTriggerKind, languages, window } from 'vscode';

import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { IExtensionActivationManager } from './activation/types';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { IApplicationDiagnostics } from './application/types';
import { IApplicationEnvironment, ICommandManager, IWorkspaceService } from './common/application/types';
import { Commands, PYTHON, PYTHON_LANGUAGE, UseProposedApi } from './common/constants';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { IFileSystem } from './common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExtensions,
    IInterpreterPathService,
    ILogOutputChannel,
    IPathUtils,
} from './common/types';
import { noop } from './common/utils/misc';
import { DebuggerTypeName } from './debugger/constants';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/extension/serviceRegistry';
import { IDebugConfigurationService, IDynamicDebugConfigurationService } from './debugger/extension/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { IInterpreterService } from './interpreter/contracts';
import { getLanguageConfiguration } from './language/languageConfiguration';
import { LinterCommands } from './linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { ReplProvider } from './providers/replProvider';
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry';
import { TerminalProvider } from './providers/terminalProvider';
import { setExtensionInstallTelemetryProperties } from './telemetry/extensionInstallTelemetry';
import { registerTypes as tensorBoardRegisterTypes } from './tensorBoard/serviceRegistry';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager, ITerminalAutoActivation } from './terminals/types';
import { registerTypes as unitTestsRegisterTypes } from './testing/serviceRegistry';

// components
import * as pythonEnvironments from './pythonEnvironments';

import { ActivationResult, ExtensionState } from './components';
import { Components } from './extensionInit';
import { setDefaultLanguageServer } from './activation/common/defaultlanguageServer';
import { DebugService } from './common/application/debugService';
import { DebugSessionEventDispatcher } from './debugger/extension/hooks/eventHandlerDispatcher';
import { IDebugSessionEventHandlers } from './debugger/extension/hooks/types';
import { WorkspaceService } from './common/application/workspace';
import { DynamicPythonDebugConfigurationService } from './debugger/extension/configuration/dynamicdebugConfigurationService';
import { IInterpreterQuickPick } from './interpreter/configuration/types';
import { registerInstallFormatterPrompt } from './providers/prompts/installFormatterPrompt';
import { registerAllCreateEnvironmentFeatures } from './pythonEnvironments/creation/registrations';

export async function activateComponents(
    // `ext` is passed to any extra activation funcs.
    ext: ExtensionState,
    components: Components,
): Promise<ActivationResult[]> {
    // Note that each activation returns a promise that resolves
    // when that activation completes.  However, it might have started
    // some non-critical background operations that do not block
    // extension activation but do block use of the extension "API".
    // Each component activation can't just resolve an "inner" promise
    // for those non-critical operations because `await` (and
    // `Promise.all()`, etc.) will flatten nested promises.  Thus
    // activation resolves `ActivationResult`, which can safely wrap
    // the "inner" promise.

    // TODO: As of now activateLegacy() registers various classes which might
    // be required while activating components. Once registration from
    // activateLegacy() are moved before we activate other components, we can
    // activate them in parallel with the other components.
    // https://github.com/microsoft/vscode-python/issues/15380
    // These will go away eventually once everything is refactored into components.
    const legacyActivationResult = await activateLegacy(ext);
    const workspaceService = new WorkspaceService();
    if (!workspaceService.isTrusted) {
        return [legacyActivationResult];
    }
    const promises: Promise<ActivationResult>[] = [
        // More component activations will go here
        pythonEnvironments.activate(components.pythonEnvs, ext),
    ];
    return Promise.all([legacyActivationResult, ...promises]);
}

export function activateFeatures(ext: ExtensionState, _components: Components): void {
    const interpreterQuickPick: IInterpreterQuickPick = ext.legacyIOC.serviceContainer.get<IInterpreterQuickPick>(
        IInterpreterQuickPick,
    );
    const interpreterPathService: IInterpreterPathService = ext.legacyIOC.serviceContainer.get<IInterpreterPathService>(
        IInterpreterPathService,
    );
    const pathUtils = ext.legacyIOC.serviceContainer.get<IPathUtils>(IPathUtils);
    registerAllCreateEnvironmentFeatures(ext.disposables, interpreterQuickPick, interpreterPathService, pathUtils);
}

/// //////////////////////////
// old activation code

// TODO: Gradually move simple initialization
// and DI registration currently in this function over
// to initializeComponents().  Likewise with complex
// init and activation: move them to activateComponents().
// See https://github.com/microsoft/vscode-python/issues/10454.

async function activateLegacy(ext: ExtensionState): Promise<ActivationResult> {
    const { context, legacyIOC } = ext;
    const { serviceManager, serviceContainer } = legacyIOC;

    // register "services"

    // We need to setup this property before any telemetry is sent
    const fs = serviceManager.get<IFileSystem>(IFileSystem);
    await setExtensionInstallTelemetryProperties(fs);

    const applicationEnv = serviceManager.get<IApplicationEnvironment>(IApplicationEnvironment);
    const { enableProposedApi } = applicationEnv.packageJson;
    serviceManager.addSingletonInstance<boolean>(UseProposedApi, enableProposedApi);
    // Feature specific registrations.
    unitTestsRegisterTypes(serviceManager);
    lintersRegisterTypes(serviceManager);
    formattersRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);
    debugConfigurationRegisterTypes(serviceManager);
    tensorBoardRegisterTypes(serviceManager);

    const extensions = serviceContainer.get<IExtensions>(IExtensions);
    await setDefaultLanguageServer(extensions, serviceManager);

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    // Settings are dependent on Experiment service, so we need to initialize it after experiments are activated.
    serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings().register();

    // Language feature registrations.
    appRegisterTypes(serviceManager);
    providersRegisterTypes(serviceManager);
    activationRegisterTypes(serviceManager);

    // "initialize" "services"

    const disposables = serviceManager.get<IDisposableRegistry>(IDisposableRegistry);
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager);

    languages.setLanguageConfiguration(PYTHON_LANGUAGE, getLanguageConfiguration());
    if (workspaceService.isTrusted) {
        const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
        interpreterManager.initialize();
        if (!workspaceService.isVirtualWorkspace) {
            const handlers = serviceManager.getAll<IDebugSessionEventHandlers>(IDebugSessionEventHandlers);
            const dispatcher = new DebugSessionEventDispatcher(handlers, DebugService.instance, disposables);
            dispatcher.registerEventHandlers();

            const outputChannel = serviceManager.get<ILogOutputChannel>(ILogOutputChannel);
            disposables.push(cmdManager.registerCommand(Commands.ViewOutput, () => outputChannel.show()));
            cmdManager.executeCommand('setContext', 'python.vscode.channel', applicationEnv.channel).then(noop, noop);

            serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics).register();

            serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register();
            const pythonSettings = configuration.getSettings();

            serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();

            disposables.push(new LinterCommands(serviceManager));

            if (
                pythonSettings &&
                pythonSettings.formatting &&
                pythonSettings.formatting.provider !== 'internalConsole'
            ) {
                const formatProvider = new PythonFormattingEditProvider(context, serviceContainer);
                disposables.push(languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
                disposables.push(languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
            }

            disposables.push(new ReplProvider(serviceContainer));

            const terminalProvider = new TerminalProvider(serviceContainer);
            terminalProvider.initialize(window.activeTerminal).ignoreErrors();
            disposables.push(terminalProvider);

            serviceContainer
                .getAll<DebugConfigurationProvider>(IDebugConfigurationService)
                .forEach((debugConfigProvider) => {
                    disposables.push(debug.registerDebugConfigurationProvider(DebuggerTypeName, debugConfigProvider));
                });

            // register a dynamic configuration provider for 'python' debug type
            disposables.push(
                debug.registerDebugConfigurationProvider(
                    DebuggerTypeName,
                    serviceContainer.get<DynamicPythonDebugConfigurationService>(IDynamicDebugConfigurationService),
                    DebugConfigurationProviderTriggerKind.Dynamic,
                ),
            );

            registerInstallFormatterPrompt(serviceContainer);
        }
    }

    // "activate" everything else

    const manager = serviceContainer.get<IExtensionActivationManager>(IExtensionActivationManager);
    disposables.push(manager);

    const activationPromise = manager.activate();

    return { fullyReady: activationPromise };
}
