// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugConfigurationProvider } from 'vscode';
import { IServiceManager } from '../../../ioc/types';
import { IDebugConfigurationProvider } from '../../types';
import { ConfigurationProviderUtils } from './configurationProviderUtils';
import { PythonV2DebugConfigurationProvider } from './pythonV2Provider';
import { IConfigurationProviderUtils } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<DebugConfigurationProvider>(IDebugConfigurationProvider, PythonV2DebugConfigurationProvider);
    serviceManager.addSingleton<IConfigurationProviderUtils>(IConfigurationProviderUtils, ConfigurationProviderUtils);
}
