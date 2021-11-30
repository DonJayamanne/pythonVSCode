// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IConfigurationService, IInstaller, Product } from '../types';
import { IProductPathService } from './types';

@injectable()
export abstract class BaseProductPathsService implements IProductPathService {
    protected readonly configService: IConfigurationService;
    protected readonly productInstaller: IInstaller;
    constructor(@inject(IServiceContainer) protected serviceContainer: IServiceContainer) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.productInstaller = serviceContainer.get<IInstaller>(IInstaller);
    }
    public abstract getExecutableNameFromSettings(product: Product, resource?: Uri): string;
    public isExecutableAModule(product: Product, resource?: Uri): boolean {
        let moduleName: string | undefined;
        try {
            moduleName = this.productInstaller.translateProductToModuleName(product);
        } catch {}

        // User may have customized the module name or provided the fully qualifieid path.
        const executableName = this.getExecutableNameFromSettings(product, resource);

        return (
            typeof moduleName === 'string' && moduleName.length > 0 && path.basename(executableName) === executableName
        );
    }
}

@injectable()
export class DataScienceProductPathService extends BaseProductPathsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getExecutableNameFromSettings(product: Product, _?: Uri): string {
        return this.productInstaller.translateProductToModuleName(product);
    }
}
