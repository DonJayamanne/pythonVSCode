"use strict";
import * as vscode from "vscode";
import * as settings from "../common/configSettings";
import { Commands } from '../common/constants';

export function activateExecInTerminalProvider() {
    vscode.commands.registerCommand(Commands.Exec_In_Terminal, execInTerminal);
    vscode.commands.registerCommand(Commands.Exec_Selection_In_Terminal, execSelectionInTerminal);
}

function execInTerminal(fileUri?: vscode.Uri) {
    const currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    let filePath: string;

    if (fileUri === undefined) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor !== undefined) {
            if (!activeEditor.document.isUntitled) {
                if (activeEditor.document.languageId == "python") {
                    filePath = activeEditor.document.fileName;
                } else {
                    vscode.window.showErrorMessage('The active file is not a Python source file');
                    return;
                }
            } else {
                vscode.window.showErrorMessage('The active file needs to be saved before it can be run');
                return;
            }
        } else {
            vscode.window.showErrorMessage('No open file to run in terminal');
            return;
        }
    } else {
        filePath = fileUri.fsPath;
    }

    const terminal = (<any>vscode.window).createTerminal(`Python`);
    terminal.sendText(`${currentPythonPath} ${filePath}`);

}

function execSelectionInTerminal() {
    const currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const selection = vscode.window.activeTextEditor.selection;
    if (selection.isEmpty){
        return;
    }
    const code = vscode.window.activeTextEditor.document.getText(new vscode.Range(selection.start, selection.end));
    const terminal = (<any>vscode.window).createTerminal(`Python`);
    terminal.sendText(`${currentPythonPath} -c "${code}"`);
}
