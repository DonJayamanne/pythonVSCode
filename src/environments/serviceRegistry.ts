// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { window } from 'vscode';
import { IServiceManager } from '../client/ioc/types';
import { PythonEnvironmentTreeDataProvider } from './view/treeDataProvider';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<PythonEnvironmentTreeDataProvider>(
        PythonEnvironmentTreeDataProvider,
        PythonEnvironmentTreeDataProvider,
    );

    const treeDataProvider = serviceManager.get<PythonEnvironmentTreeDataProvider>(PythonEnvironmentTreeDataProvider);
    window.createTreeView('pythonEnvironments', { treeDataProvider });
}
