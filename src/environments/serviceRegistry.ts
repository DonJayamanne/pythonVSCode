// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, ExtensionContext, window } from 'vscode';
import { IServiceManager } from '../client/ioc/types';
import { activate } from './terminal';
import { PackagesViewProvider } from './view/packages';
import { PythonEnvironmentTreeDataProvider } from './view/treeDataProvider';

export function registerTypes(serviceManager: IServiceManager, context: ExtensionContext): void {
    serviceManager.addSingleton<PythonEnvironmentTreeDataProvider>(
        PythonEnvironmentTreeDataProvider,
        PythonEnvironmentTreeDataProvider,
    );

    const treeDataProvider = serviceManager.get<PythonEnvironmentTreeDataProvider>(PythonEnvironmentTreeDataProvider);
    // treeDataProvider.
    context.subscriptions.push(commands.registerCommand('python.envManager.refresh', () => treeDataProvider.refresh()));
    window.createTreeView('pythonEnvironments', { treeDataProvider });
    PackagesViewProvider.register(context);
    activate(context, serviceManager);
}
