// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// 'use strict';

// import * as util from 'util';
// import { Event, EventEmitter, Uri } from 'vscode';
// import { traceError, traceInfo } from '../../common/logger';
// import { IDisposable } from '../../common/types';
// import { noop } from '../../common/utils/misc';
// import { deserializeDataViews, serializeDataViews } from '../../common/utils/serializers';
// import {
//     IInteractiveWindowMapping,
//     InteractiveWindowMessages,
//     IPyWidgetMessages
// } from '../interactive-common/interactiveWindowTypes';
// import { INotebook, INotebookProvider, KernelSocketInformation } from '../types';
// import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

// // tslint:disable: no-any
// /**
//  * This class maps between messages from the react code and talking to a real kernel.
//  */
// export abstract class BaseNotebookMessageListener implements IIPyWidgetMessageDispatcher {
//     public get postMessage(): Event<IPyWidgetMessage> {
//         return this._postMessageEmitter.event;
//     }
//     protected notebook?: INotebook;

//     protected readonly disposables: IDisposable[] = [];
//     protected disposed = false;
//     private _postMessageEmitter = new EventEmitter<IPyWidgetMessage>();
//     constructor(protected readonly notebookProvider: INotebookProvider, public readonly notebookIdentity: Uri) {
//         notebookProvider.onNotebookCreated(
//             (e) => {
//                 if (e.identity.toString() === notebookIdentity.toString()) {
//                     this.initialize().ignoreErrors();
//                 }
//             },
//             this,
//             this.disposables
//         );
//     }
//     public dispose() {
//         this.disposed = true;
//         while (this.disposables.length) {
//             const disposable = this.disposables.shift();
//             disposable?.dispose(); // NOSONAR
//         }
//     }

//     public receiveMessage(message: IPyWidgetMessage | { message: InteractiveWindowMessages.RestartKernel }): void {
//         traceInfo(`IPyWidgetMessage: ${util.inspect(message)}`);
//         switch (message.message) {
//             case IPyWidgetMessages.IPyWidgets_Ready:
//                 this.initialize().ignoreErrors();
//                 break;
//             default:
//                 break;
//         }
//     }
//     public async initialize() {
//         // If we have any pending targets, register them now
//         await this.getNotebook();
//     }
//     protected abstract async onNotebookInitialized(): Promise<void>;
//     protected raisePostMessage<M extends IInteractiveWindowMapping, T extends keyof IInteractiveWindowMapping>(
//         message: IPyWidgetMessages,
//         payload: M[T]
//     ) {
//         this._postMessageEmitter.fire({ message, payload });
//     }
//     private async getNotebook(): Promise<INotebook | undefined> {
//         if (this.notebookIdentity && !this.notebook) {
//             this.notebook = await this.notebookProvider.getOrCreateNotebook({
//                 identity: this.notebookIdentity,
//                 getOnly: true
//             });
//             if (this.notebook) {
//                 await this.onNotebookInitialized();
//             }
//         }
//         return this.notebook;
//     }
// }
