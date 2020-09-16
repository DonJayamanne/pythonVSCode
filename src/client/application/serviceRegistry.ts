// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { registerTypes as diagnosticsRegisterTypes } from './diagnostics/serviceRegistry';
import { JoinMailingListPrompt } from './misc/joinMailingListPrompt';

export function registerTypes(serviceManager: IServiceManager) {
    diagnosticsRegisterTypes(serviceManager);
    serviceManager.add<IExtensionSingleActivationService>(IExtensionSingleActivationService, JoinMailingListPrompt);
}
