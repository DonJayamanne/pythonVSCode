import * as vscode from 'vscode';
import { JupyterCodeLensProvider } from '../editorIntegration/codeLensProvider';
import { CellHelper } from './cellHelper';

export class CodeHelper {
    private cellHelper: CellHelper;
    constructor(private cellCodeLenses: JupyterCodeLensProvider) {
        this.cellHelper = new CellHelper(cellCodeLenses);
    }

    public getSelectedCode(): Promise<string> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve('');
        }
        if (activeEditor.selection.isEmpty) {
            const lineText = activeEditor.document.lineAt(activeEditor.selection.start.line).text;
            if (!CodeHelper.isCodeBlock(lineText)) {
                return Promise.resolve(lineText);
            }

            // ok we're in a block, look for the end of the block untill the last line in the cell (if there are any cells)
            return new Promise<string>((resolve, reject) => {
                this.cellHelper.getActiveCell().then(activeCell => {
                    const endLineNumber = activeCell ? activeCell.cell.end.line : activeEditor.document.lineCount - 1;
                    const startIndent = lineText.indexOf(lineText.trim());
                    const nextStartLine = activeEditor.selection.start.line + 1;
                    
                    for (let lineNumber = nextStartLine; lineNumber <= endLineNumber; lineNumber++) {
                        const line = activeEditor.document.lineAt(lineNumber);
                        const nextLine = line.text;
                        const nextLineIndent = nextLine.indexOf(nextLine.trim());
                        if (nextLine.trim().indexOf('#') === 0) {
                            continue;
                        }
                        if (nextLineIndent === startIndent) {
                            // Return code untill previous line
                            const endRange = activeEditor.document.lineAt(lineNumber - 1).range.end;
                            resolve(activeEditor.document.getText(new vscode.Range(activeEditor.selection.start, endRange)));
                        }
                    }

                    resolve(activeEditor.document.getText(activeCell.cell));
                }, reject);
            });
            //return activeEditor.document.getText(new vscode.Range(activeEditor.selection.start, activeEditor.selection.))
        }
        else {
            return Promise.resolve(activeEditor.document.getText(activeEditor.selection));
        }
    }

    private static isCodeBlock(code: string): boolean {
        return code.trim().endsWith(':') && code.indexOf('#') === -1;
    }
}