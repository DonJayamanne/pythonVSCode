// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { BANNER_NAME_DS_SURVEY, BANNER_NAME_INTERACTIVE_SHIFTENTER, IJupyterExtensionBanner } from '../common/types';
import { DataScienceSurveyBanner } from '../datascience/dataScienceSurveyBanner';
import { RecommendPythonExtensionBanner } from '../datascience/recommendPythonExtensionBanner';
import { InteractiveShiftEnterBanner } from '../datascience/shiftEnterBanner';
import { IServiceManager } from '../ioc/types';
import { ExtensionActivationManager } from './activationManager';
import { MigrateDataScienceSettingsService } from './migrateDataScienceSettingsService';

import { IExtensionActivationManager, IExtensionActivationService, IExtensionSingleActivationService } from './types';

// tslint:disable-next-line: max-func-body-length
export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);
    serviceManager.addSingleton<IExtensionActivationService>(
        IExtensionActivationService,
        MigrateDataScienceSettingsService
    );
    serviceManager.addSingleton<IJupyterExtensionBanner>(
        IJupyterExtensionBanner,
        DataScienceSurveyBanner,
        BANNER_NAME_DS_SURVEY
    );
    serviceManager.addSingleton<IJupyterExtensionBanner>(
        IJupyterExtensionBanner,
        InteractiveShiftEnterBanner,
        BANNER_NAME_INTERACTIVE_SHIFTENTER
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        RecommendPythonExtensionBanner
    );
}
