// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { join } from 'path';
import { CancellationToken, Event, EventEmitter, NotebookCommunication, Uri } from 'vscode';
import {
    NotebookCell,
    NotebookDocument,
    NotebookKernel as VSCNotebookKernel,
    NotebookKernelProvider
} from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { IDisposableRegistry, IExtensionContext } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IInterpreterService } from '../../interpreter/contracts';
import { InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { IPyWidgetMessageDispatcher } from '../ipywidgets/ipyWidgetMessageDispatcher';
import { IPyWidgetScriptSource } from '../ipywidgets/ipyWidgetScriptSource';
import { areKernelConnectionsEqual } from '../jupyter/kernels/helpers';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { getKernelConnectionId, IKernelProvider, KernelConnectionMetadata } from '../jupyter/kernels/types';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { INotebook, INotebookProvider } from '../types';
import { getNotebookMetadata, isJupyterNotebook, updateKernelInNotebookMetadata } from './helpers/helpers';

class VSCodeNotebookKernelMetadata implements VSCNotebookKernel {
    get preloads(): Uri[] {
        return [
            // Uri.file(
            //     // '/Users/donjayamanne/Desktop/Development/vsc/vscode-python/out/datascience-ui/notebook/require.js'
            //     '/Users/donjayamanne/Desktop/Development/vsc/vscode-python/out/datascience-ui/notebook/ipywidgets.js'
            // ),
            Uri.file(join(this.context.extensionPath, 'out', 'ipywidgets', 'dist', 'ipywidgets.js'))
            // Uri.file(join(this.context.extensionPath, 'out', 'ipywidgets', 'dist', 'ipywidgets.js'))
        ];
        // tslint:disable-next-line: no-console
        // console.log([Uri.file(join(this.context.extensionPath, 'out', 'ipywidgets', 'dist', 'ipywidgets.js'))]);
        // // return [];
        // return [
        //     Uri.file(
        //         '/Users/donjayamanne/Desktop/Development/vsc/vscode-notebook-renderers/out/ipywidgets/dist/ipywidgets.js'
        //     )
        // ];
    }
    get id() {
        return getKernelConnectionId(this.selection);
    }
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly detail: string,
        public readonly selection: Readonly<KernelConnectionMetadata>,
        public readonly isPreferred: boolean,
        private readonly kernelProvider: IKernelProvider,
        private readonly context: IExtensionContext
    ) {}
    public executeCell(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.getOrCreate(cell.notebook.uri, { metadata: this.selection })?.executeCell(cell); // NOSONAR
    }
    public executeAllCells(document: NotebookDocument) {
        this.kernelProvider.getOrCreate(document.uri, { metadata: this.selection })?.executeAllCells(document); // NOSONAR
    }
    public cancelCellExecution(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.get(cell.notebook.uri)?.interrupt(); // NOSONAR
    }
    public cancelAllCellsExecution(document: NotebookDocument) {
        this.kernelProvider.get(document.uri)?.interrupt(); // NOSONAR
    }
}

@injectable()
export class VSCodeKernelPickerProvider implements NotebookKernelProvider {
    public get onDidChangeKernels(): Event<NotebookDocument | undefined> {
        return this._onDidChangeKernels.event;
    }
    private readonly _onDidChangeKernels = new EventEmitter<NotebookDocument | undefined>();
    private notebookKernelChangeHandled = new WeakSet<INotebook>();
    private readonly documentDispatchers = new WeakMap<NotebookDocument, IPyWidgetMessageDispatcher>();
    constructor(
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(KernelSelector) private readonly kernelSelector: KernelSelector,
        @inject(IKernelProvider) private readonly kernelProvider: IKernelProvider,
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(KernelSwitcher) private readonly kernelSwitcher: KernelSwitcher,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IPyWidgetScriptSource) private readonly scriptSource: IPyWidgetScriptSource
    ) {
        this.kernelSelectionProvider.onDidChangeSelections(
            (e) => {
                if (e) {
                    const doc = this.notebook.notebookDocuments.find((d) => d.uri.fsPath === e.fsPath);
                    if (doc) {
                        return this._onDidChangeKernels.fire(doc);
                    }
                }
                this._onDidChangeKernels.fire(undefined);
            },
            this,
            disposables
        );
        this.notebook.onDidChangeActiveNotebookKernel(this.onDidChangeActiveNotebookKernel, this, disposables);
    }
    public async resolveKernel?(
        _kernel: VSCodeNotebookKernelMetadata,
        document: NotebookDocument,
        webview: NotebookCommunication,
        _token: CancellationToken
    ): Promise<void> {
        if (this.documentDispatchers.has(document)) {
            return;
        }
        const dispatcher = new IPyWidgetMessageDispatcher(this.notebookProvider, document.uri);
        dispatcher.postMessage((e) => {
            webview.postMessage(e);
        });
        this.scriptSource.onMessage(InteractiveWindowMessages.NotebookIdentity, { resource: document.uri });
        this.scriptSource.postMessage((e) => {
            webview.postMessage(e);
        });
        this.scriptSource.postInternalMessage((e) => {
            if (e.message === InteractiveWindowMessages.ConvertUriForUseInWebViewRequest) {
                this.scriptSource.onMessage(InteractiveWindowMessages.ConvertUriForUseInWebViewResponse, {
                    request: e.payload,
                    response: webview.asWebviewUri(e.payload)
                });
            }
        });
        webview.onDidReceiveMessage((e) => {
            // tslint:disable-next-line: no-console
            // console.log(`Received ${e.type || e.message || e}`);
            dispatcher.receiveMessage({ message: e.type, payload: e.payload });
            if (e.type) {
                this.scriptSource.onMessage(e.type, e.payload);
            }
            if (e === 'Loaded') {
                webview.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
            }
        });
        this.documentDispatchers.set(document, dispatcher);
        // webview.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
        // existingKernel?.kernelSocket
    }

    public async provideKernels(
        document: NotebookDocument,
        token: CancellationToken
    ): Promise<VSCodeNotebookKernelMetadata[]> {
        const [preferredKernel, kernels, activeInterpreter] = await Promise.all([
            this.getPreferredKernel(document, token),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token),
            this.interpreterService.getActiveInterpreter(document.uri)
        ]);
        if (token.isCancellationRequested) {
            return [];
        }

        // Default the interpreter to the local interpreter (if none is provided).
        const withInterpreter = kernels.map((kernel) => {
            const selection = cloneDeep(kernel.selection); // Always clone, so we can make changes to this.
            selection.interpreter = selection.interpreter || activeInterpreter;
            return { ...kernel, selection };
        });

        // Turn this into our preferred list.
        const mapped = withInterpreter.map((kernel) => {
            return new VSCodeNotebookKernelMetadata(
                kernel.label,
                kernel.description || '',
                kernel.detail || '',
                kernel.selection,
                areKernelConnectionsEqual(kernel.selection, preferredKernel),
                this.kernelProvider,
                this.context
            );
        });

        // If no preferred kernel set but we have a language, use that to set preferred instead.
        if (!mapped.find((v) => v.isPreferred) && document.cells.length) {
            const languages = document.cells.map((c) => c.language);
            // Find the first that matches on language
            const indexOfKernelMatchingDocumentLanguage = kernels.findIndex((k) =>
                languages.find((l) => l === k.selection.kernelSpec?.language)
            );

            // If we have a preferred kernel, then add that to the list, & put it on top of the list.
            const preferredKernelMetadata = this.createNotebookKernelMetadataFromPreferredKernel(preferredKernel);
            if (preferredKernelMetadata) {
                mapped.splice(0, 0, preferredKernelMetadata);
            } else if (indexOfKernelMatchingDocumentLanguage >= 0) {
                const kernel = kernels[indexOfKernelMatchingDocumentLanguage];
                mapped.splice(
                    indexOfKernelMatchingDocumentLanguage,
                    1,
                    new VSCodeNotebookKernelMetadata(
                        kernel.label,
                        kernel.description || '',
                        kernel.detail || '',
                        kernel.selection,
                        true,
                        this.kernelProvider,
                        this.context
                    )
                );
            }
        }
        mapped.sort((a, b) => {
            if (a.label > b.label) {
                return 1;
            } else if (a.label === b.label) {
                return 0;
            } else {
                return -1;
            }
        });
        return mapped;
    }
    private createNotebookKernelMetadataFromPreferredKernel(
        preferredKernel?: KernelConnectionMetadata
    ): VSCodeNotebookKernelMetadata | undefined {
        if (!preferredKernel) {
            return;
        } else if (preferredKernel.kind === 'startUsingDefaultKernel') {
            return;
        } else if (preferredKernel.kind === 'startUsingPythonInterpreter') {
            return new VSCodeNotebookKernelMetadata(
                preferredKernel.interpreter.displayName || preferredKernel.interpreter.path,
                '',
                preferredKernel.interpreter.path,
                preferredKernel,
                true,
                this.kernelProvider,
                this.context
            );
        } else if (preferredKernel.kind === 'connectToLiveKernel') {
            return new VSCodeNotebookKernelMetadata(
                preferredKernel.kernelModel.display_name || preferredKernel.kernelModel.name,
                '',
                preferredKernel.kernelModel.name,
                preferredKernel,
                true,
                this.kernelProvider,
                this.context
            );
        } else {
            return new VSCodeNotebookKernelMetadata(
                preferredKernel.kernelSpec.display_name,
                '',
                preferredKernel.kernelSpec.name,
                preferredKernel,
                true,
                this.kernelProvider,
                this.context
            );
        }
    }
    private async getPreferredKernel(document: NotebookDocument, token: CancellationToken) {
        // If we already have a kernel selected, then return that.
        const editor =
            this.notebook.notebookEditors.find((e) => e.document === document) ||
            (this.notebook.activeNotebookEditor?.document === document
                ? this.notebook.activeNotebookEditor
                : undefined);
        if (editor && editor.kernel && editor.kernel instanceof VSCodeNotebookKernelMetadata) {
            return editor.kernel.selection;
        }
        return this.kernelSelector.getPreferredKernelForLocalConnection(
            document.uri,
            'raw',
            undefined,
            getNotebookMetadata(document),
            true,
            token,
            true
        );
    }
    private async onDidChangeActiveNotebookKernel({
        document,
        kernel
    }: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        // We're only interested in our Jupyter Notebooks & our kernels.
        if (!kernel || !(kernel instanceof VSCodeNotebookKernelMetadata) || !isJupyterNotebook(document)) {
            return;
        }
        const selectedKernelConnectionMetadata = kernel.selection;

        const model = this.storageProvider.get(document.uri);
        if (!model || !model.isTrusted) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: https://github.com/microsoft/vscode-python/issues/13476
            // If a model is not trusted, we cannot change the kernel (this results in changes to notebook metadata).
            // This is because we store selected kernel in the notebook metadata.
            return;
        }

        const existingKernel = this.kernelProvider.get(document.uri);
        if (existingKernel && areKernelConnectionsEqual(existingKernel.metadata, selectedKernelConnectionMetadata)) {
            return;
        }
        // Delete the old dispatcher.
        this.documentDispatchers.delete(document);

        // Make this the new kernel (calling this method will associate the new kernel with this Uri).
        // Calling `getOrCreate` will ensure a kernel is created and it is mapped to the Uri provided.
        // This way other parts of extension have access to this kernel immediately after event is handled.
        this.kernelProvider.getOrCreate(document.uri, {
            metadata: selectedKernelConnectionMetadata
        });

        // Change kernel and update metadata.
        const notebook = await this.notebookProvider.getOrCreateNotebook({
            resource: document.uri,
            identity: document.uri,
            getOnly: true
        });

        // If we have a notebook, change its kernel now
        if (notebook) {
            if (!this.notebookKernelChangeHandled.has(notebook)) {
                this.notebookKernelChangeHandled.add(notebook);
                notebook.onKernelChanged(
                    (e) => {
                        if (notebook.disposed) {
                            return;
                        }
                        updateKernelInNotebookMetadata(document, e);
                    },
                    this,
                    this.disposables
                );
            }
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: https://github.com/microsoft/vscode-python/issues/13514
            // We need to handle these exceptions in `siwthKernelWithRetry`.
            // We shouldn't handle them here, as we're already handling some errors in the `siwthKernelWithRetry` method.
            // Adding comment here, so we have context for the requirement.
            this.kernelSwitcher.switchKernelWithRetry(notebook, selectedKernelConnectionMetadata).catch(noop);
        } else {
            updateKernelInNotebookMetadata(document, selectedKernelConnectionMetadata);
        }
    }
}
