// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event } from 'vscode';
import { NotebookCell } from 'vscode-proposed';
import { PythonApiProvider } from './api/pythonApi';
import { PythonApi } from './api/types';
import { isTestExecution } from './common/constants';
import { traceError } from './common/logger';
import { IDataViewerDataProvider, IDataViewerFactory } from './datascience/data-viewing/types';
import { IJupyterUriProvider, IJupyterUriProviderRegistration, INotebookExtensibility } from './datascience/types';
import { IServiceContainer, IServiceManager } from './ioc/types';

/*
 * Do not introduce any breaking changes to this API.
 * This is the public API for other extensions to interact with this extension.
 */

export interface IExtensionApi {
    /**
     * Promise indicating whether all parts of the extension have completed loading or not.
     * @type {Promise<void>}
     * @memberof IExtensionApi
     */
    ready: Promise<void>;
    readonly onKernelPostExecute: Event<NotebookCell>;
    readonly onKernelRestart: Event<void>;
    /**
     * Launches Data Viewer component.
     * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
     * @param {string} title Data Viewer title
     */
    showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
    /**
     * Registers a remote server provider component that's used to pick remote jupyter server URIs
     * @param serverProvider object called back when picking jupyter server URI
     */
    registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void;
    registerPythonApi(pythonApi: PythonApi): void;
}

export function buildApi(
    // tslint:disable-next-line:no-any
    ready: Promise<any>,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
): IExtensionApi {
    const notebookExtensibility = serviceContainer.get<INotebookExtensibility>(INotebookExtensibility);
    let registered = false;
    const api: IExtensionApi = {
        // 'ready' will propagate the exception, but we must log it here first.
        ready: ready.catch((ex) => {
            traceError('Failure during activation.', ex);
            return Promise.reject(ex);
        }),
        registerPythonApi: (pythonApi: PythonApi) => {
            if (registered) {
                return;
            }
            registered = true;
            const apiProvider = serviceContainer.get<PythonApiProvider>(PythonApiProvider);
            apiProvider.setApi(pythonApi);
        },
        async showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void> {
            const dataViewerProviderService = serviceContainer.get<IDataViewerFactory>(IDataViewerFactory);
            await dataViewerProviderService.create(dataProvider, title);
        },
        registerRemoteServerProvider(picker: IJupyterUriProvider): void {
            const container = serviceContainer.get<IJupyterUriProviderRegistration>(IJupyterUriProviderRegistration);
            container.registerProvider(picker);
        },
        onKernelPostExecute: notebookExtensibility.onKernelPostExecute,
        onKernelRestart: notebookExtensibility.onKernelRestart
    };

    // In test environment return the DI Container.
    if (isTestExecution()) {
        // tslint:disable:no-any
        (api as any).serviceContainer = serviceContainer;
        (api as any).serviceManager = serviceManager;
        // tslint:enable:no-any
    }
    return api;
}
