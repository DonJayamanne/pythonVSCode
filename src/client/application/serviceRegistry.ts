// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { JoinMailingListPrompt } from './misc/joinMailingListPrompt';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.add<IExtensionSingleActivationService>(IExtensionSingleActivationService, JoinMailingListPrompt);
}
