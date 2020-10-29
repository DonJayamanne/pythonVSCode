import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import * as uuid from 'uuid/v4';
import { Disposable, NotebookCellRunState, Uri } from 'vscode';
import { NotebookCell } from '../../../types/vscode-proposed';
import { IInteractiveWindowProvider, INotebookEditorProvider, IWebviewExtensibility } from './types';
import { translateCellStateFromNative } from './utils';

@injectable()
export class WebviewExtensibility implements IWebviewExtensibility {
    constructor(
        @inject(INotebookEditorProvider) private webviewNotebookProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider
    ) {}

    public registerCellToolbarButton(
        callback: (cell: NotebookCell, isInteractive: boolean, resource: Uri) => Promise<void>,
        codicon: string,
        statusToEnable: NotebookCellRunState[],
        tooltip: string
    ): Disposable {
        const disposables: IDisposable[] = [];
        const windows = new Set();
        const buttonId = uuid();

        this.interactiveWindowProvider.onDidChangeActiveInteractiveWindow((window) => {
            if (window && !windows.has(window)) {
                disposables.push(
                    window.createWebviewCellButton(
                        buttonId,
                        callback,
                        codicon,
                        statusToEnable.map(translateCellStateFromNative),
                        tooltip
                    )
                );
            }
        });

        this.interactiveWindowProvider.windows.forEach((window) => {
            windows.add(window);
            disposables.push(
                window.createWebviewCellButton(
                    buttonId,
                    callback,
                    codicon,
                    statusToEnable.map(translateCellStateFromNative),
                    tooltip
                )
            );
        });

        this.webviewNotebookProvider.onDidOpenNotebookEditor((editor) => {
            disposables.push(
                editor.createWebviewCellButton(
                    buttonId,
                    callback,
                    codicon,
                    statusToEnable.map(translateCellStateFromNative),
                    tooltip
                )
            );
        });

        this.webviewNotebookProvider.editors.forEach((editor) => {
            disposables.push(
                editor.createWebviewCellButton(
                    buttonId,
                    callback,
                    codicon,
                    statusToEnable.map(translateCellStateFromNative),
                    tooltip
                )
            );
        });

        return {
            dispose: () => {
                disposables.forEach((d) => d.dispose());
            }
        };
    }
}
