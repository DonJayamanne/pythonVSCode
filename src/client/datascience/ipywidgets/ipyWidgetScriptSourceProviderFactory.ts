// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// 'use strict';

// import { inject, injectable } from 'inversify';
// import { Event, EventEmitter, Uri } from 'vscode';
// import { IFileSystem } from '../../common/platform/types';
// import { IDisposable, IDisposableRegistry } from '../../common/types';
// import { IInterpreterService } from '../../interpreter/contracts';
// import { IInteractiveWindowProvider, INotebook, INotebookEditorProvider, INotebookProvider } from '../types';
// import { IPyWidgetMessageDispatcher } from './ipyWidgetMessageDispatcher';
// import { IPyWidgetScriptSource } from './ipyWidgetScriptSource';
// import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

// // /**
// //  * This just wraps the iPyWidgetMessageDispatcher class.
// //  * When raising events for arrived messages, this class will first raise events for
// //  * all messages that arrived before this class was contructed.
// //  */
// // class IPyWidgetScriptSourceProviderFactory implements IIPyWidgetMessageDispatcher {
// //     public get postMessage(): Event<IPyWidgetMessage> {
// //         return this._postMessageEmitter.event;
// //     }
// //     private _postMessageEmitter = new EventEmitter<IPyWidgetMessage>();
// //     private readonly disposables: IDisposable[] = [];
// //     constructor(
// //         private readonly baseMulticaster: IPyWidgetMessageDispatcher,
// //         private oldMessages: ReadonlyArray<IPyWidgetMessage>
// //     ) {
// //         baseMulticaster.postMessage(this.raisePostMessage, this, this.disposables);
// //     }

// //     public dispose() {
// //         while (this.disposables.length) {
// //             const disposable = this.disposables.shift();
// //             disposable?.dispose(); // NOSONAR
// //         }
// //     }
// //     public async initialize() {
// //         return this.baseMulticaster.initialize();
// //     }

// //     public receiveMessage(message: IPyWidgetMessage) {
// //         this.baseMulticaster.receiveMessage(message);
// //     }
// //     private raisePostMessage(message: IPyWidgetMessage) {
// //         // Send all of the old messages the notebook may not have received.
// //         // Also send them in the same order.
// //         this.oldMessages.forEach((oldMessage) => {
// //             this._postMessageEmitter.fire(oldMessage);
// //         });
// //         this.oldMessages = [];
// //         this._postMessageEmitter.fire(message);
// //     }
// // }

// /**
//  * Creates the dispatcher responsible for handling loading ipywidget widget scripts.
//  */
// @injectable()
// export class IPyWidgetScriptSourceProviderFactory implements IDisposable {
//     private readonly scriptSourceProviders = new Map<string, IPyWidgetScriptSource>();
//     private disposed = false;
//     private disposables: IDisposable[] = [];
//     constructor(
//         @inject(INotebookProvider) private notebookProvider: INotebookProvider,
//         @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
//         @inject(IFileSystem) private readonly fs: IFileSystem,
//         @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
//         @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
//         @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
//     ) {
//         disposableRegistry.push(this);
//         notebookProvider.onNotebookCreated((e) => this.trackDisposingOfNotebook(e.notebook), this, this.disposables);

//         notebookProvider.activeNotebooks.forEach((nbPromise) =>
//             nbPromise.then((notebook) => this.trackDisposingOfNotebook(notebook)).ignoreErrors()
//         );
//     }

//     public dispose() {
//         this.disposed = true;
//         while (this.disposables.length) {
//             this.disposables.shift()?.dispose(); // NOSONAR
//         }
//     }
//     public create(identity: Uri): IPyWidgetScriptSource {
//         let scriptSource = this.scriptSourceProviders.get(identity.fsPath);
//         if (!scriptSource) {
//             scriptSource = new IPyWidgetScriptSource(
//                 this.disposableRegistry,
//                 this.notebookProvider,
//                 this.trackDisposingOfNotebook,
//                 this.notebookEditorProvider,
//                 this.interactiveWindowProvider,
//                 this.interpreterService,
//                 identity
//             );
//             this.scriptSourceProviders.set(identity.fsPath, scriptSource);
//             this.disposables.push(scriptSource);
//         }
//         return scriptSource;
//     }
//     private trackDisposingOfNotebook(notebook: INotebook) {
//         if (this.disposed) {
//             return;
//         }
//         notebook.onDisposed(
//             () => {
//                 const item = this.scriptSourceProviders.get(notebook.identity.fsPath);
//                 item?.dispose(); // NOSONAR
//                 this.scriptSourceProviders.delete(notebook.identity.fsPath);
//             },
//             this,
//             this.disposables
//         );
//     }
// }
