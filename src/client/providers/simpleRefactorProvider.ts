'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {RefactorProxy} from '../refactor/proxy';
import {getTextEditsFromPatch} from '../common/editor';

interface RenameResponse {
    results: [{ diff: string }];
}

export function activateSimplePythonRefactorProvider(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    let disposable = vscode.commands.registerCommand('python.refactorExtractVariable', () => {
        extractVariable(context.extensionPath,
            vscode.window.activeTextEditor,
            vscode.window.activeTextEditor.selection,
            outputChannel);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('python.refactorExtractMethod', () => {
        extractMethod(context.extensionPath,
            vscode.window.activeTextEditor,
            vscode.window.activeTextEditor.selection,
            outputChannel);
    });
    context.subscriptions.push(disposable);
}

// Exported for unit testing
export function extractVariable(extensionDir: string, textEditor: vscode.TextEditor, range: vscode.Range,
    outputChannel: vscode.OutputChannel, workspaceRoot: string = vscode.workspace.rootPath, renameAfterExtration: boolean = true): Promise<any> {
    let newName = 'newvariable' + new Date().getMilliseconds().toString();
    let proxy = new RefactorProxy(extensionDir, workspaceRoot);
    let rename = proxy.extractVariable<RenameResponse>(textEditor.document, newName, textEditor.document.uri.fsPath, range).then(response => {
        return response.results[0].diff;
    });

    return extractName(extensionDir, textEditor, range, newName, rename, outputChannel, renameAfterExtration);
}

// Exported for unit testing
export function extractMethod(extensionDir: string, textEditor: vscode.TextEditor, range: vscode.Range,
    outputChannel: vscode.OutputChannel, workspaceRoot: string = vscode.workspace.rootPath, renameAfterExtration: boolean = true): Promise<any> {
    let newName = 'newmethod' + new Date().getMilliseconds().toString();
    let proxy = new RefactorProxy(extensionDir, workspaceRoot);
    let rename = proxy.extractMethod<RenameResponse>(textEditor.document, newName, textEditor.document.uri.fsPath, range).then(response => {
        return response.results[0].diff;
    });

    return extractName(extensionDir, textEditor, range, newName, rename, outputChannel, renameAfterExtration);
}

function extractName(extensionDir: string, textEditor: vscode.TextEditor, range: vscode.Range, newName: string,
    renameResponse: Promise<string>, outputChannel: vscode.OutputChannel, renameAfterExtration: boolean = true): Promise<any> {
    let changeStartsAtLine = -1;
    return renameResponse.then(diff => {
        if (diff.length === 0) {
            return [];
        }
        let edits = getTextEditsFromPatch(textEditor.document.getText(), diff);
        return edits;
    }).then(edits => {
        return textEditor.edit(editBuilder => {
            edits.forEach(edit => {
                if (changeStartsAtLine === -1 || changeStartsAtLine > edit.range.start.line) {
                    changeStartsAtLine = edit.range.start.line;
                }
                editBuilder.replace(edit.range, edit.newText);
            });
        });
    }).then(done => {
        if (done && changeStartsAtLine >= 0 && renameAfterExtration) {
            let newWordPosition: vscode.Position;
            for (let lineNumber = changeStartsAtLine; lineNumber < textEditor.document.lineCount; lineNumber++) {
                let line = textEditor.document.lineAt(lineNumber);
                let indexOfWord = line.text.indexOf(newName);
                if (indexOfWord >= 0) {
                    newWordPosition = new vscode.Position(line.range.start.line, indexOfWord);
                    break;
                }
            }
            if (newWordPosition) {
                textEditor.selections = [];
                textEditor.selection = new vscode.Selection(newWordPosition, new vscode.Position(newWordPosition.line, newWordPosition.character + newName.length));
                textEditor.revealRange(new vscode.Range(textEditor.selection.start, textEditor.selection.end), vscode.TextEditorRevealType.Default);

                // Now that we have selected the new variable, lets invoke the rename command
                vscode.commands.executeCommand('editor.action.rename');
            }
        }
    }).catch(error => {
        let errorMessage = error + '';
        if (typeof error === 'string') {
            errorMessage = error;
        }
        if (typeof error === 'object' && error.message) {
            errorMessage = `Refactor failed, ${error.message}`;
        }
        outputChannel.appendLine('#'.repeat(10) + 'Refactor Output' + '#'.repeat(10));
        outputChannel.appendLine('Error in refactoring:\n' + errorMessage);
        console.error(error);
        vscode.window.showErrorMessage(errorMessage);
    });
}
