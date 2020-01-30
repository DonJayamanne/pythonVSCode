// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Disposable, Uri, WebviewPanel, WebviewPanelOptions } from 'vscode';
import { ICommandManager, ICustomEditorService, WebviewCustomEditorEditingDelegate, WebviewCustomEditorProvider } from '../../client/common/application/types';
import { IDisposableRegistry } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { INotebookEdit, INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';

export class MockCustomEditorService implements ICustomEditorService {
    private provider: WebviewCustomEditorProvider | undefined;
    private resolvedList = new Map<string, Thenable<void>>();

    constructor(disposableRegistry: IDisposableRegistry, commandManager: ICommandManager) {
        disposableRegistry.push(commandManager.registerCommand('workbench.action.files.save', this.onFileSave.bind(this)));
        disposableRegistry.push(commandManager.registerCommand('workbench.action.files.saveAs', this.onFileSaveAs.bind(this)));
    }

    public registerWebviewCustomEditorProvider(_viewType: string, provider: WebviewCustomEditorProvider, _options?: WebviewPanelOptions | undefined): Disposable {
        // Only support one view type, so just save the provider
        this.provider = provider;

        // Sign up for close so we can clear our resolved map
        // tslint:disable-next-line: no-any
        ((this.provider as any) as INotebookEditorProvider).onDidCloseNotebookEditor(this.closedEditor.bind(this));

        return { dispose: noop };
    }
    public async openEditor(file: Uri): Promise<void> {
        if (!this.provider) {
            throw new Error('Opening before registering');
        }

        // Make sure not to resolve more than once for the same file. At least in testing.
        let resolved = this.resolvedList.get(file.toString());
        if (!resolved) {
            // Pass undefined as the webview panel. This will make the editor create a new one
            // tslint:disable-next-line: no-any
            resolved = this.provider.resolveWebviewEditor(file, (undefined as any) as WebviewPanel);
            this.resolvedList.set(file.toString(), resolved);
        }

        await resolved;
    }

    private onFileSave(file: Uri) {
        const nativeProvider = (this.provider as unknown) as WebviewCustomEditorEditingDelegate<INotebookEdit>;
        if (nativeProvider) {
            nativeProvider.save(file);
        }
    }

    private onFileSaveAs(file: Uri) {
        const nativeProvider = (this.provider as unknown) as WebviewCustomEditorEditingDelegate<INotebookEdit>;
        if (nativeProvider) {
            // Just make up a new URI
            nativeProvider.saveAs(file, Uri.file('bar.ipynb'));
        }
    }

    private closedEditor(editor: INotebookEditor) {
        this.resolvedList.delete(editor.file.toString());
    }
}
