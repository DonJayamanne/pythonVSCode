// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { BANNER_NAME_LS_SURVEY, BANNER_NAME_PROPOSE_LS, IPythonExtensionBanner } from '../common/types';
import { IServiceManager } from '../ioc/types';
import { LanguageServerSurveyBanner } from '../languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../languageServices/proposeLanguageServerBanner';
import { ExtensionActivationService } from './activationService';
import { JediExtensionActivator } from './jedi';
import { LanguageServerExtensionActivator } from './languageServer';
import { ExtensionActivators, IExtensionActivationService, IExtensionActivator } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, ExtensionActivationService);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, JediExtensionActivator, ExtensionActivators.Jedi);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, LanguageServerExtensionActivator, ExtensionActivators.DotNet);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, LanguageServerSurveyBanner, BANNER_NAME_LS_SURVEY);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, ProposeLanguageServerBanner, BANNER_NAME_PROPOSE_LS);
}
