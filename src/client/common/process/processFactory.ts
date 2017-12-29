// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { Container } from '../configSettings';
import { IConfigurationService } from '../types';
import { IProcessService } from './types';

export const IProcessFactory = Symbol('IProcessFactory');

export interface IProcessFactory {
    create(resource?: Uri): IProcessService;
}

@injectable()
export class ProcessFactory implements IProcessFactory {
    constructor( @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IProcessService) @named('standard') private procService: IProcessService,
        @inject(IProcessService) @named('wsl') private wslProcService: IProcessService) { }
    public create(resource?: Uri): IProcessService {
        const settings = this.configService.getConfiguration(resource);
        switch (settings.container) {
            case Container.Wsl: {
                return this.wslProcService;
            }
            default: {
                return this.procService;
            }
        }
    }
}
