'use strict';

import * as vscode from 'vscode';
import {Disposable} from 'vscode';
import * as telemetryContracts from '../../common/telemetryContracts';
import {JupyterCodeLensProvider} from './codeLensProvider';
import {JupyterCellHighlightProvider} from './cellHighlightProvider';
const decoration = vscode.window.createTextEditorDecorationType({
    dark: {
        border: '0.1em solid white'
    },
    light: {
        border: '0.1em solid black'
    },
    isWholeLine: true
});

export class JupyterCellBorderProvider extends Disposable {
    private disposables: Disposable[] = [];
    constructor(private codeLensProvider: JupyterCodeLensProvider, private cellHighlightProvider: JupyterCellHighlightProvider) {
        super(() => { });
        vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, this.disposables);
        vscode.workspace.onDidOpenTextDocument(this.onDidOpenTextDocument, this, this.disposables);
        vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this.disposables);

        this.highlightOpenEditors();
    }

    private onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
        if (!editor || !editor.document) {
            return;
        }
        this.drawDecorations(editor);
    }
    private onDidOpenTextDocument(document: vscode.TextDocument) {
        if (!document) {
            return;
        }

        const editor = this.getTextEditor(document);
        if (!editor) {
            return;
        }

        this.drawDecorations(editor);
    }
    private onDidChangeTextDocument(change: vscode.TextDocumentChangeEvent) {
        const editor = this.getTextEditor(change.document);
        if (!editor) {
            return;
        }

        this.drawDecorations(editor);
    }
    private drawDecorations(editor: vscode.TextEditor) {
        this.cellHighlightProvider.highlightCurrentCell(editor.document);
        this.codeLensProvider.provideCodeLenses(editor.document, null).then(lenses => {
            const options = [];
            lenses.forEach(lens => {
                const range = new vscode.Range(lens.range.start, lens.range.start);
                const option: vscode.DecorationOptions = { range: range };
                options.push(option);
            });

            editor.setDecorations(decoration, options);
        });
    }

    private highlightOpenEditors() {
        vscode.window.visibleTextEditors.forEach(this.drawDecorations.bind(this));
    }
    private getTextEditor(document: vscode.TextDocument): vscode.TextEditor {
        return vscode.window.visibleTextEditors.find(editor => editor.document && editor.document.fileName === document.fileName);
    }
}