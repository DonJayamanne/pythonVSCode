'use strict';

import * as vscode from 'vscode';
import {DocumentHighlight, TextDocument, CancellationToken, Position} from 'vscode';
import * as telemetryContracts from '../../common/telemetryContracts';
import {JupyterCodeLensProvider} from './codeLensProvider';
const decoration = vscode.window.createTextEditorDecorationType({
    dark: {
        backgroundColor: 'black'
    },
    light: {
        backgroundColor: 'lightgrey'
    },
    isWholeLine: true
});

export class JupyterCellHighlightProvider implements vscode.DocumentHighlightProvider {
    constructor(private codeLensProvider: JupyterCodeLensProvider) {
    }
    provideDocumentHighlights(document: TextDocument, position: Position, token: CancellationToken): Thenable<DocumentHighlight[]> {
        return this.highlightCurrentCell(document, position).then(() => {
            return [];
        }, () => {
            return [];
        });
    }

    public highlightCurrentCell(document: TextDocument, position?: vscode.Position): Thenable<any> {
        const textEditor = vscode.window.visibleTextEditors.find(editor => editor.document && editor.document.fileName === document.fileName);
        if (!textEditor || !textEditor.selection) {
            return Promise.resolve();
        }

        if (!position) {
            position = new vscode.Position(textEditor.selection.start.line, textEditor.selection.start.character);
        }
        return this.codeLensProvider.provideCodeLenses(document, null).then(lenses => {
            const currentCell = lenses.find(lens => lens.range.contains(position));
            if (!currentCell) {
                return;
            }
            const currentCellRange = currentCell.range;
            if (!currentCell) {
                return;
            }
            const otherCells = lenses.filter(lens => !lens.range.isEqual(currentCellRange)).map(lens => lens.range);
            this.highlightCellRange(document, currentCellRange, otherCells);
            return;
        });
    }
    private highlightCellRange(document: TextDocument, range: vscode.Range, otherRanges: vscode.Range[]) {
        const textEditor = vscode.window.visibleTextEditors.find(editor => editor.document && editor.document.fileName === document.fileName);
        if (!textEditor) {
            return;
        }
        textEditor.setDecorations(decoration, [range]);
    }
}