// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { ProductType } from '../types';
import { InstallationChannelManager } from './channelManager';
import { CondaInstaller } from './condaInstaller';
import { PipEnvInstaller } from './pipEnvInstaller';
import { PipInstaller } from './pipInstaller';
import { CTagsProductPathService, FormatterProductPathService, LinterProductPathService, RefactoringLibraryProductPathService, TestFrameworkProductPathService } from './productPath';
import { ProductService } from './productService';
import { IInstallationChannelManager, IModuleInstaller, IProductPathService, IProductService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipEnvInstaller);
    serviceManager.addSingleton<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);

    serviceManager.addSingleton<IProductService>(IProductService, ProductService);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
}
