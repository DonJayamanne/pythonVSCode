// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { IPythonExecutionFactory } from '../process/types';
import { ExecutionInfo } from '../types';
import { ModuleInstaller } from './moduleInstaller';
import { IModuleInstaller } from './types';

@injectable()
export class PipInstaller extends ModuleInstaller implements IModuleInstaller {
    public get displayName() {
        return 'Pip';
    }
    public get priority(): number {
        return 0;
    }
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isSupported(resource?: Uri): Promise<boolean> {
        return this.isPipAvailable(resource);
    }
    protected async getExecutionInfo(moduleName: string, resource?: Uri): Promise<ExecutionInfo> {
        const proxyArgs: string[] = [];
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const proxy = workspaceService.getConfiguration('http').get('proxy', '');
        if (proxy.length > 0) {
            proxyArgs.push('--proxy');
            proxyArgs.push(proxy);
        }
        return {
            args: [...proxyArgs, 'install', '-U', moduleName],
            moduleName: 'pip'
        };
    }
    private isPipAvailable(resource?: Uri): Promise<boolean> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        return pythonExecutionFactory.create({ resource })
            .then(proc => proc.isModuleInstalled('pip'))
            .catch(() => false);
    }
}
