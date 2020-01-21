// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { assert } from 'chai';
import { Event, EventEmitter } from 'vscode';
import { createDeferred } from '../../../client/common/utils/async';
import {
    captureJupyterSessionBusyReason,
    JupyterSessionCompletionCleanup,
    returnEmptyResponseRequestIfServerIsBusy,
    ServerBusyStatusReason
} from '../../../client/datascience/jupyter/jupyterSessionCompletionRequests';
import { LiveKernelModel } from '../../../client/datascience/jupyter/kernels/types';
import { IJupyterKernelSpec, IJupyterSession } from '../../../client/datascience/types';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import { noop } from '../../core';

// tslint:disable: max-func-body-length
suite('Data Science - Jupyter Session Code Completion (decorators)', () => {
    class TestJupyterSession implements IJupyterSession {
        // tslint:disable-next-line: no-any
        public requestExecuteDeferred = createDeferred<any>();
        // tslint:disable-next-line: no-any
        public requestInspectDeferred = createDeferred<any>();
        public get onSessionStatusChanged(): Event<ServerStatus> {
            return new EventEmitter<ServerStatus>().event;
        }
        public restart(_timeout: number): Promise<void> {
            throw new Error('Method not implemented.');
        }
        public interrupt(_timeout: number): Promise<void> {
            throw new Error('Method not implemented.');
        }
        public waitForIdle(_timeout: number): Promise<void> {
            throw new Error('Method not implemented.');
        }
        @captureJupyterSessionBusyReason(ServerBusyStatusReason.ExecutingCode)
        public requestExecute(
            _content: {
                code: string;
                silent?: boolean | undefined;
                store_history?: boolean | undefined;
                user_expressions?: JSONObject | undefined;
                allow_stdin?: boolean | undefined;
                stop_on_error?: boolean | undefined;
            },
            _disposeOnDone?: boolean | undefined,
            _metadata?: JSONObject | undefined
        ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined {
            // tslint:disable-next-line: no-any
            return { done: this.requestExecuteDeferred.promise } as any;
        }
        @returnEmptyResponseRequestIfServerIsBusy()
        @captureJupyterSessionBusyReason(ServerBusyStatusReason.ProvingCodeCompletion)
        public async requestComplete(_content: { code: string; cursor_pos: number }): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
            return {
                content: {
                    matches: ['1']
                }
                // tslint:disable-next-line: no-any
            } as any;
        }
        @captureJupyterSessionBusyReason(ServerBusyStatusReason.InspectingVariables)
        public requestInspect(_content: { code: string; cursor_pos: number; detail_level: 0 | 1 }): Promise<KernelMessage.IInspectReplyMsg | undefined> {
            // tslint:disable-next-line: no-any
            return this.requestInspectDeferred.promise as Promise<any>;
        }
        public sendInputReply(_content: string): void {
            throw new Error('Method not implemented.');
        }
        public changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
            throw new Error('Method not implemented.');
        }
        public dispose(): Promise<void> {
            throw new Error('Method not implemented.');
        }
    }

    let session: TestJupyterSession;
    // tslint:disable-next-line: no-any
    const content: any = {};
    setup(() => {
        session = new TestJupyterSession();
    });
    // tslint:disable-next-line: no-any
    teardown(() => new JupyterSessionCompletionCleanup([] as any).dispose());

    test('Can get Completions', async () => {
        const completions = await session.requestComplete(content);

        assert.isOk(completions);
    });
    test('Cannot get Completions if server is busy executing user code', async () => {
        session.requestExecute(content);

        const completions = await session.requestComplete(content);

        // Since server is busy executing user code, completions should be `undefined`.
        assert.isUndefined(completions);
    });
    test('Cannot get Completions if server is busy inspecting vars', async () => {
        session.requestInspect(content).ignoreErrors();

        const completions = await session.requestComplete(content);

        // Since server is busy executing user code, completions should be `undefined`.
        assert.isUndefined(completions);
    });
    test('Cannot get Completions if server busy executing user code or inspecting vars', async () => {
        const userCode = session.requestExecute(content);
        const inspect = session.requestInspect(content);

        let completions = await session.requestComplete(content);

        // Since server is busy executing user code, completions should be `undefined`.
        assert.isUndefined(completions);

        // Lets ensure user code has completed.
        session.requestExecuteDeferred.resolve();
        await userCode?.done;

        // Since inspection has not completed, completion will still not work.
        completions = await session.requestComplete(content);
        assert.isUndefined(completions);

        // Lets ensure var inspection has completed.
        session.requestInspectDeferred.reject(new Error('kaboom'));
        await inspect.catch(noop);

        // Now completions should be provided (since user code execution and var inspection have both completed).
        completions = await session.requestComplete(content);
        assert.isOk(completions);
    });
    test('Can get Completions if server is not busy executing user code', async () => {
        const userCode = session.requestExecute(content);

        let completions = await session.requestComplete(content);

        // Since server is busy executing user code, completions should be `undefined`.
        assert.isUndefined(completions);

        // Lets ensure user code has completed.
        session.requestExecuteDeferred.resolve();
        await userCode?.done;

        // Now completions should be provided.
        completions = await session.requestComplete(content);
        assert.isOk(completions);
    });
    test('Can get Completions if server is not busy inspecting vars', async () => {
        const inspect = session.requestInspect(content);

        let completions = await session.requestComplete(content);

        // Since server is busy inspecting vars, completions should be `undefined`.
        assert.isUndefined(completions);

        // Lets ensure var inspection has completed.
        session.requestInspectDeferred.resolve();
        await inspect;

        // Now completions should be provided.
        completions = await session.requestComplete(content);
        assert.isOk(completions);
    });
});
