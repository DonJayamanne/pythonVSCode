// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event } from 'vscode';
import { IDisposable } from '../../common/types';
import { IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';

export interface IPyWidgetMessage {
    message: IPyWidgetMessages;
    // tslint:disable-next-line: no-any
    payload: any;
}

/**
 * Used to send/receive messages related to IPyWidgets
 */
export interface IIPyWidgetMessageDispatcher extends IDisposable {
    // tslint:disable-next-line: no-any
    postMessage: Event<IPyWidgetMessage>;
    // tslint:disable-next-line: no-any
    receiveMessage(message: IPyWidgetMessage): void;
    initialize(): Promise<void>;
}

/**
 * Name value pair of widget name/module along with the Uri to the script.
 */
export type WidgetScriptSource = {
    moduleName: string;
    /**
     * Resource Uri (not using Uri type as this needs to be sent from extension to UI).
     */
    scriptUri?: string;
};

/**
 * Used to get an entry for widget (or all of them).
 */
export interface IWidgetScriptSourceProvider {
    /**
     * Return the script path for the requested module.
     */
    getWidgetScriptSource(moduleName: string): Promise<WidgetScriptSource>;
    /**
     * Returns a list of all widgets with their sources. Can be empty.
     */
    getWidgetScriptSources(ignoreCache?: boolean): Promise<Readonly<WidgetScriptSource[]>>;
}
