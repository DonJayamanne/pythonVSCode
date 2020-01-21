// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IJupyterSession } from '../types';

/**
 * Reasons why Jupyter Servers is busy.
 *
 * @export
 * @enum {number}
 */
export enum ServerBusyStatusReason {
    ExecutingCode = 'ExecutingCode',
    InspectingVariables = 'InspectingVariables',
    ProvingCodeCompletion = 'ProvingCodeCompletion'
}

export type InternalSessionStatus = ServerBusyStatusReason;

const sessionStatus = new Map<IJupyterSession, { status: ServerBusyStatusReason; requests: number }>();

@injectable()
export class JupyterSessionCompletionCleanup implements IExtensionSingleActivationService {
    constructor(@inject(IDisposableRegistry) disposables: IDisposableRegistry) {
        disposables.push(this);
    }
    public async activate(): Promise<void> {
        noop();
    }
    public dispose() {
        sessionStatus.clear();
    }
}

function isSessionTooBusyToProvideCodeCompletions(session: IJupyterSession): boolean {
    const info = sessionStatus.get(session);
    if (!info) {
        return false;
    }
    switch (info.status) {
        case ServerBusyStatusReason.InspectingVariables:
        case ServerBusyStatusReason.ExecutingCode: {
            // If we have multiple requests waiting on code completion or inspecting of variables,
            // then providing completions is not possible (to avoid unnecessary delays).
            return info.requests > 0;
        }
        default: {
            return false;
        }
    }
}

// tslint:disable-next-line: no-any
export type KernelCompleteReplyFunction = (...any: any[]) => Promise<KernelMessage.ICompleteReplyMsg | undefined>;
/**
 * If Jupyter Server is busy serving requests such as executing code or the like, then ignore requests for code completion.
 * This is to ensure code completion isn't blocked unnecessarily (we can provide some completions from the Language Server).
 *
 * @export
 * @returns
 */
export function returnEmptyResponseRequestIfServerIsBusy() {
    return function(target: IJupyterSession, _propertyName: string, descriptor: TypedPropertyDescriptor<KernelCompleteReplyFunction>) {
        const originalMethod = descriptor.value!;
        // tslint:disable-next-line:no-any no-function-expression
        descriptor.value = async function(...args: any[]) {
            if (isSessionTooBusyToProvideCodeCompletions(target)) {
                return Promise.resolve(undefined);
            }
            // tslint:disable-next-line: no-invalid-this
            return originalMethod.apply(this, args);
        };
    };
}

// tslint:disable-next-line: no-any
export type KernelExecReplyFunction = (...any: any[]) => Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined;
// tslint:disable-next-line: no-any
export type KernelInspectFunction = (...any: any[]) => Promise<KernelMessage.IInspectReplyMsg | undefined>;
// tslint:disable-next-line: no-any
export type KernelCompleteFunction = (...any: any[]) => Promise<KernelMessage.ICompleteReplyMsg | undefined>;

/**
 * Captures the reasons why Jupyter Session is busy.
 *
 * @export
 * @param {ServerBusyStatusReason} reason
 * @returns
 */
export function captureJupyterSessionBusyReason(reason: ServerBusyStatusReason) {
    return function(
        target: IJupyterSession,
        _propertyName: string,
        descriptor: TypedPropertyDescriptor<KernelExecReplyFunction> | TypedPropertyDescriptor<KernelInspectFunction> | TypedPropertyDescriptor<KernelCompleteFunction>
    ) {
        const originalMethod = descriptor.value!;
        // tslint:disable-next-line:no-any no-function-expression
        descriptor.value = function(...args: any[]) {
            if (!sessionStatus.has(target)) {
                sessionStatus.set(target, { status: reason, requests: 0 });
            }
            // Keep a counter alive to track number of requests that keep the server busy.
            // Once the method completes, reduce the counter.
            const info = sessionStatus.get(target)!;
            info.requests += 1;
            // tslint:disable-next-line:no-invalid-this
            const result = (originalMethod as Function).apply(this, args);
            const execReply = result as Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined;
            const inspectReply = result as Promise<KernelMessage.IInspectReplyMsg | KernelMessage.IExecuteReplyMsg | undefined>;
            if (execReply && execReply.done && execReply.done.then) {
                // If exec reply, then handle finally in the done property.
                execReply.done
                    .finally(() => {
                        info.requests -= 1;
                        info.requests = info.requests < 0 ? 0 : info.requests;
                    })
                    .catch(noop);
            } else if (inspectReply && inspectReply.then && inspectReply.finally) {
                // If inspect reply, then handle finally.
                inspectReply
                    .finally(() => {
                        info.requests -= 1;
                        info.requests = info.requests < 0 ? 0 : info.requests;
                    })
                    .catch(noop);
            } else {
                console.log('Hello');
                // If method returned nothing, then it has completed.
                info.requests -= 1;
                info.requests = info.requests < 0 ? 0 : info.requests;
            }

            return result;
        };
    };
}
