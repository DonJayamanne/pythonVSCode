// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFormatterHelper } from '../../formatters/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager } from '../../linters/types';
import { ITestsHelper } from '../../unittests/common/types';
import { IConfigurationService, IInstaller, ModuleNamePurpose, Product } from '../types';
import { IProductPathService } from './types';

@injectable()
abstract class BaseProductPathsService implements IProductPathService {
    protected readonly configService: IConfigurationService;
    protected readonly productInstaller: IInstaller;
    constructor(@inject(IServiceContainer) protected serviceContainer: IServiceContainer) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.productInstaller = serviceContainer.get<IInstaller>(IInstaller);
    }
    public abstract getExecutableNameFromSettings(product: Product, resource?: Uri): string;
    public isExecutableAModule(product: Product, resource?: Uri): Boolean {
        let moduleName: string | undefined;
        try {
            moduleName = this.productInstaller.translateProductToModuleName(product, ModuleNamePurpose.run);
            // tslint:disable-next-line:no-empty
        } catch { }

        // User may have customized the module name or provided the fully qualifieid path.
        const executableName = this.getExecutableNameFromSettings(product, resource);

        return typeof moduleName === 'string' && moduleName.length > 0 && path.basename(executableName) === executableName;
    }
}

@injectable()
export class CTagsProductPathService extends BaseProductPathsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getExecutableNameFromSettings(_: Product, resource?: Uri): string {
        const settings = this.configService.getSettings(resource);
        return settings.workspaceSymbols.ctagsPath;
    }
}

@injectable()
export class FormatterProductPathService extends BaseProductPathsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getExecutableNameFromSettings(product: Product, resource?: Uri): string {
        const settings = this.configService.getSettings(resource);
        const formatHelper = this.serviceContainer.get<IFormatterHelper>(IFormatterHelper);
        const settingsPropNames = formatHelper.getSettingsPropertyNames(product);
        return settings.formatting[settingsPropNames.pathName] as string;
    }
}

@injectable()
export class LinterProductPathService extends BaseProductPathsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getExecutableNameFromSettings(product: Product, resource?: Uri): string {
        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        return linterManager.getLinterInfo(product).pathName(resource);
    }
}

@injectable()
export class TestFrameworkProductPathService extends BaseProductPathsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getExecutableNameFromSettings(product: Product, resource?: Uri): string {
        const testHelper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        const settingsPropNames = testHelper.getSettingsPropertyNames(product);
        if (!settingsPropNames.pathName) {
            // E.g. in the case of UnitTests we don't allow customizing the paths.
            return this.productInstaller.translateProductToModuleName(product, ModuleNamePurpose.run);
        }
        const settings = this.configService.getSettings(resource);
        return settings.unitTest[settingsPropNames.pathName] as string;
    }
}

@injectable()
export class RefactoringLibraryProductPathService extends BaseProductPathsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getExecutableNameFromSettings(product: Product, _?: Uri): string {
        return this.productInstaller.translateProductToModuleName(product, ModuleNamePurpose.run);
    }
}
