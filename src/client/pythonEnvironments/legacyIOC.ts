// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceContainer, IServiceManager } from '../ioc/types';
import { initializeExternalDependencies } from './common/externalDependencies';
import { EnvironmentInfoService, IEnvironmentInfoService } from './info/environmentInfoService';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function registerForIOC(serviceManager: IServiceManager, serviceContainer: IServiceContainer) {
    serviceManager.addSingletonInstance<IEnvironmentInfoService>(IEnvironmentInfoService, new EnvironmentInfoService());
    initializeExternalDependencies(serviceContainer);
}
