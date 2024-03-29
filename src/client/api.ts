// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { noop } from 'lodash';
import { Uri, Event } from 'vscode';
import { BaseLanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/node';
import { PYLANCE_NAME } from './activation/node/languageClientFactory';
import { ILanguageServerOutputChannel } from './activation/types';
import { IExtensionApi } from './apiTypes';
import { isTestExecution, PYTHON_LANGUAGE } from './common/constants';
import { IConfigurationService, Resource } from './common/types';
import { IEnvironmentVariablesProvider } from './common/variables/types';
import { getDebugpyLauncherArgs, getDebugpyPackagePath } from './debugger/extension/adapter/remoteLaunchers';
import { IInterpreterService } from './interpreter/contracts';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { JupyterExtensionIntegration } from './jupyter/jupyterIntegration';
import { traceError } from './logging';
import { IDiscoveryAPI } from './pythonEnvironments/base/locator';
import { buildEnvironmentApi } from './environmentApi';

export function buildApi(
    ready: Promise<any>,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer,
    discoveryApi: IDiscoveryAPI,
): IExtensionApi {
    const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    serviceManager.addSingleton<JupyterExtensionIntegration>(JupyterExtensionIntegration, JupyterExtensionIntegration);
    const jupyterIntegration = serviceContainer.get<JupyterExtensionIntegration>(JupyterExtensionIntegration);
    const envService = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
    const outputChannel = serviceContainer.get<ILanguageServerOutputChannel>(ILanguageServerOutputChannel);

    const api: IExtensionApi & {
        /**
         * @deprecated Temporarily exposed for Pylance until we expose this API generally. Will be removed in an
         * iteration or two.
         */
        pylance: {
            getPythonPathVar: (resource?: Uri) => Promise<string | undefined>;
            readonly onDidEnvironmentVariablesChange: Event<Uri | undefined>;
            createClient(...args: any[]): BaseLanguageClient;
            start(client: BaseLanguageClient): Promise<void>;
            stop(client: BaseLanguageClient): Promise<void>;
        };
    } & {
        /**
         * @deprecated Use IExtensionApi.environments API instead.
         *
         * Return internal settings within the extension which are stored in VSCode storage
         */
        settings: {
            /**
             * An event that is emitted when execution details (for a resource) change. For instance, when interpreter configuration changes.
             */
            readonly onDidChangeExecutionDetails: Event<Uri | undefined>;
            /**
             * Returns all the details the consumer needs to execute code within the selected environment,
             * corresponding to the specified resource taking into account any workspace-specific settings
             * for the workspace to which this resource belongs.
             * @param {Resource} [resource] A resource for which the setting is asked for.
             * * When no resource is provided, the setting scoped to the first workspace folder is returned.
             * * If no folder is present, it returns the global setting.
             * @returns {({ execCommand: string[] | undefined })}
             */
            getExecutionDetails(
                resource?: Resource,
            ): {
                /**
                 * E.g of execution commands returned could be,
                 * * `['<path to the interpreter set in settings>']`
                 * * `['<path to the interpreter selected by the extension when setting is not set>']`
                 * * `['conda', 'run', 'python']` which is used to run from within Conda environments.
                 * or something similar for some other Python environments.
                 *
                 * @type {(string[] | undefined)} When return value is `undefined`, it means no interpreter is set.
                 * Otherwise, join the items returned using space to construct the full execution command.
                 */
                execCommand: string[] | undefined;
            };
        };
    } = {
        // 'ready' will propagate the exception, but we must log it here first.
        ready: ready.catch((ex) => {
            traceError('Failure during activation.', ex);
            return Promise.reject(ex);
        }),
        jupyter: {
            registerHooks: () => jupyterIntegration.integrateWithJupyterExtension(),
        },
        debug: {
            async getRemoteLauncherCommand(
                host: string,
                port: number,
                waitUntilDebuggerAttaches: boolean = true,
            ): Promise<string[]> {
                return getDebugpyLauncherArgs({
                    host,
                    port,
                    waitUntilDebuggerAttaches,
                });
            },
            async getDebuggerPackagePath(): Promise<string | undefined> {
                return getDebugpyPackagePath();
            },
        },
        settings: {
            onDidChangeExecutionDetails: interpreterService.onDidChangeInterpreterConfiguration,
            getExecutionDetails(resource?: Resource) {
                const pythonPath = configurationService.getSettings(resource).pythonPath;
                // If pythonPath equals an empty string, no interpreter is set.
                return { execCommand: pythonPath === '' ? undefined : [pythonPath] };
            },
        },
        // These are for backwards compatibility. Other extensions are using these APIs and we don't want
        // to force them to move to the jupyter extension ... yet.
        datascience: {
            registerRemoteServerProvider: jupyterIntegration
                ? jupyterIntegration.registerRemoteServerProvider.bind(jupyterIntegration)
                : (noop as any),
            showDataViewer: jupyterIntegration
                ? jupyterIntegration.showDataViewer.bind(jupyterIntegration)
                : (noop as any),
        },
        pylance: {
            getPythonPathVar: async (resource?: Uri) => {
                const envs = await envService.getEnvironmentVariables(resource);
                return envs.PYTHONPATH;
            },
            onDidEnvironmentVariablesChange: envService.onDidEnvironmentVariablesChange,
            createClient: (...args: any[]): BaseLanguageClient => {
                // Make sure we share output channel so that we can share one with
                // Jedi as well.
                const clientOptions = args[1] as LanguageClientOptions;
                clientOptions.outputChannel = clientOptions.outputChannel ?? outputChannel.channel;

                return new LanguageClient(PYTHON_LANGUAGE, PYLANCE_NAME, args[0], clientOptions);
            },
            start: (client: BaseLanguageClient): Promise<void> => client.start(),
            stop: (client: BaseLanguageClient): Promise<void> => client.stop(),
        },
        environments: buildEnvironmentApi(discoveryApi, serviceContainer),
    };

    // In test environment return the DI Container.
    if (isTestExecution()) {
        (api as any).serviceContainer = serviceContainer;
        (api as any).serviceManager = serviceManager;
    }
    return api;
}
