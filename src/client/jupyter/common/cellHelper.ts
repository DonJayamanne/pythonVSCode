import { Cell } from '../contracts';
import { TextDocument, Range } from 'vscode';
import { JupyterCodeLensProvider } from '../editorIntegration/codeLensProvider';
import * as vscode from 'vscode';

const CellIdentifier = /^(# %%|#%%|# \<codecell\>|# In\[\d*?\]|# In\[ \])(.*)/i;

export class CellHelper {
    constructor(private cellCodeLenses: JupyterCodeLensProvider) {
    }

    public getActiveCell(): Thenable<{ cell: vscode.Range, nextCell?: vscode.Range, previousCell?: vscode.Range }> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve(null);
        }

        return this.cellCodeLenses.provideCodeLenses(activeEditor.document, null).then(lenses => {
            if (lenses.length === 0) {
                return null;
            }
            let currentCellRange: vscode.Range;
            let nextCellRange: vscode.Range;
            let previousCellRange: vscode.Range;
            lenses.forEach((lens, index) => {
                if (lens.range.contains(activeEditor.selection.start)) {
                    currentCellRange = lens.range;
                    if (index < (lenses.length - 1)) {
                        nextCellRange = lenses[index + 1].range;
                    }
                    if (index > 0) {
                        previousCellRange = lenses[index - 1].range;
                    }
                }
            });
            if (!currentCellRange) {
                return null;
            }
            return { cell: currentCellRange, nextCell: nextCellRange, previousCell: previousCellRange };
        });
    }
    public goToPreviousCell(): Thenable<any> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve();
        }
        return this.getActiveCell().then(cellInfo => {
            if (!cellInfo || !cellInfo.previousCell) {
                return;
            }
            return this.advanceToCell(activeEditor.document, cellInfo.previousCell);
        });
    }
    public goToNextCell(): Thenable<any> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve();
        }
        return this.getActiveCell().then(cellInfo => {
            if (!cellInfo || !cellInfo.nextCell) {
                return;
            }
            return this.advanceToCell(activeEditor.document, cellInfo.nextCell);
        });
    }
    public advanceToCell(document: vscode.TextDocument, range: vscode.Range): Promise<any> {
        if (!range || !document) {
            return;
        }
        const textEditor = vscode.window.visibleTextEditors.find(editor => editor.document && editor.document.fileName === document.fileName);
        if (!textEditor) {
            return;
        }

        // Remember, we use comments to identify cells
        // Setting the cursor to the comment doesn't make sense
        // Quirk 1: Besides the document highlighter doesn't kick in (event' not fired), when you have placed the cursor on a comment
        // Quirk 2: If the first character starts with a %, then for some reason the highlighter doesn't kick in (event' not fired)
        let firstLineOfCellRange = range;
        if (range.start.line < range.end.line) {
            // let line = textEditor.document.lineAt(range.start.line + 1);
            // let start = new vscode.Position(range.start.line + 1, range.start.character);
            // firstLineOfCellRange = new vscode.Range(start, range.end);
            const start = CellHelper.findStartPositionWithCode(document, range.start.line + 1, range.end.line);
            firstLineOfCellRange = new vscode.Range(start, range.end);
        }
        textEditor.selections = [];
        textEditor.selection = new vscode.Selection(firstLineOfCellRange.start, firstLineOfCellRange.start);
        textEditor.revealRange(range);
        vscode.window.showTextDocument(textEditor.document);
    }

    private static findStartPositionWithCode(document: vscode.TextDocument, startLine: number, endLine: number): vscode.Position {
        for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
            let line = document.lineAt(startLine);
            if (line.isEmptyOrWhitespace) {
                continue;
            }
            const lineText = line.text;
            const trimmedLine = lineText.trim();
            if (trimmedLine.startsWith('#')) {
                continue;
            }
            // Yay we have a line
            // Remember, we need to set the cursor to a character other than white space
            // Highlighting doesn't kick in for comments or white space
            return new vscode.Position(lineNumber, lineText.indexOf(trimmedLine));
        }

        // give up
        return new vscode.Position(startLine, 0);
    }
    public static getCells(document: TextDocument): Cell[] {
        const cells: Cell[] = [];
        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);
            if (CellIdentifier.test(line.text)) {
                const results = CellIdentifier.exec(line.text);
                if (cells.length > 0) {
                    const previousCell = cells[cells.length - 1];
                    previousCell.range = new Range(previousCell.range.start, document.lineAt(index - 1).range.end);
                }
                cells.push({
                    range: line.range,
                    title: results.length > 1 ? results[2].trim() : ''
                });
            }

        }

        if (cells.length >= 1) {
            const line = document.lineAt(document.lineCount - 1);
            const previousCell = cells[cells.length - 1];
            previousCell.range = new Range(previousCell.range.start, line.range.end);
        }
        return cells;
    }
}