
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, multiInject } from 'inversify';
import { DebugSessionCustomEvent, Disposable } from 'vscode';
import { IDebugManager } from '../../../common/application/types';
import { Logger } from '../../../common/logger';
import { IDisposableRegistry } from '../../../common/types';
import { IServiceManager } from '../../../ioc/types';
import { ICustomDebugSessionEventHandlers } from './types';

const attachToChildProcess = 'ATTACH';

export class CustomDebugSessionEventDispatcher {
    constructor(@multiInject(ICustomDebugSessionEventHandlers) private readonly eventHandlers: ICustomDebugSessionEventHandlers[],
        @inject(IDebugManager) private readonly debugManager: IDebugManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry) { }
    public registerEventHandlers() {
        this.disposables.push(this.debugManager.onDidReceiveDebugSessionCustomEvent(e => {
            this.eventHandlers.forEach(handler => handler.handleEvent(e).ignoreErrors());
        }));
    }
}
