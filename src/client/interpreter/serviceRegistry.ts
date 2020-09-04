// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../ioc/types';
import { InterpreterSelector } from './configuration/interpreterSelector/interpreterSelector';
import { IInterpreterSelector } from './configuration/types';

export function registerInterpreterTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
}

export function registerTypes(serviceManager: IServiceManager) {
    registerInterpreterTypes(serviceManager);
}
