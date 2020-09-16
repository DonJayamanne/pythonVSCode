// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { BANNER_NAME_DS_SURVEY, BANNER_NAME_INTERACTIVE_SHIFTENTER, IPythonExtensionBanner } from '../common/types';
import { DataScienceSurveyBanner } from '../datascience/dataScienceSurveyBanner';
import { InteractiveShiftEnterBanner } from '../datascience/shiftEnterBanner';
import { IServiceManager } from '../ioc/types';
import { ExtensionActivationManager } from './activationManager';
import { MigrateDataScienceSettingsService } from './migrateDataScienceSettingsService';

import { IExtensionActivationManager, IExtensionActivationService } from './types';

// tslint:disable-next-line: max-func-body-length
export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);
    serviceManager.addSingleton<IExtensionActivationService>(
        IExtensionActivationService,
        MigrateDataScienceSettingsService
    );

    serviceManager.addSingleton<IPythonExtensionBanner>(
        IPythonExtensionBanner,
        DataScienceSurveyBanner,
        BANNER_NAME_DS_SURVEY
    );
    serviceManager.addSingleton<IPythonExtensionBanner>(
        IPythonExtensionBanner,
        InteractiveShiftEnterBanner,
        BANNER_NAME_INTERACTIVE_SHIFTENTER
    );
}
