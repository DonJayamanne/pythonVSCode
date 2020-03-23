// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { KernelMessage } from '@jupyterlab/services';
import { Event } from 'vscode';
import { IDisposable } from '../../common/types';
import { IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';

export type IPyWidgetMessage =
    | {
          message: IPyWidgetMessages.IPyWidgets_display_data_msg;
          payload: KernelMessage.IDisplayDataMsg;
      }
    | { message: IPyWidgetMessages.IPyWidgets_comm_open; payload: KernelMessage.ICommOpenMsg }
    | {
          message: IPyWidgetMessages.IPyWidgets_ShellSend_resolve;
          payload: { requestId: string; msg: KernelMessage.IShellMessage<KernelMessage.ShellMessageType> | undefined };
      }
    | { message: IPyWidgetMessages.IPyWidgets_ShellSend_reject; payload: { requestId: string; msg: Error } }
    | {
          message: IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub;
          payload: { requestId: string; msg: KernelMessage.IIOPubMessage };
      }
    | { message: IPyWidgetMessages.IPyWidgets_comm_msg; payload: KernelMessage.ICommMsgMsg }
    | {
          message: IPyWidgetMessages.IPyWidgets_ShellSend_reply;
          payload: { requestId: string; msg: KernelMessage.IShellMessage };
      };

/**
 * Used to send/receive messages related to IPyWidgets
 */
export interface IIPyWidgetMessageDispatcher extends IDisposable {
    onMessage: Event<IPyWidgetMessage>;
    initialize(): Promise<void>;
    sendIPythonShellMsg(payload: {
        // tslint:disable: no-any
        data: any;
        metadata: any;
        commId: string;
        requestId: string;
        buffers?: any;
        msgType: string;
        targetName?: string;
    }): Promise<void>;
    registerCommTarget(targetName: string): Promise<void>;
}
