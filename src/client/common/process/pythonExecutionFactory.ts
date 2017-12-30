// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { PythonSettings } from '../configSettings';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { IProcessServiceFactory } from './processServiceFactory';
import { PythonExecutionService } from './pythonProcess';
import { IPythonExecutionFactory, IPythonExecutionService } from './types';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    constructor( @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(IEnvironmentVariablesProvider) private envVarsService: IEnvironmentVariablesProvider) { }
    public async create(resource?: Uri): Promise<IPythonExecutionService> {
        const settings = PythonSettings.getInstance(resource);
        return this.envVarsService.getEnvironmentVariables(resource)
            .then(customEnvVars => {
                const processService = this.processServiceFactory.create(resource);
                return new PythonExecutionService(processService, settings.pythonPath, customEnvVars);
            });
    }
}
