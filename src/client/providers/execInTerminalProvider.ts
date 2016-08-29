"use strict";
import * as vscode from "vscode";
import * as settings from "../common/configSettings";
import { Commands } from '../common/constants';

export function activateExecInTerminalProvider() {
    vscode.commands.registerCommand(Commands.Exec_In_Terminal, execInTerminal);
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
    // Temporary workaround until a promise of terminal readiness is available:
    // https://github.com/Tyriar/vscode-terminal-api-example/issues/2
    setTimeout(() => {
        terminal.sendText(`${currentPythonPath} ${filePath}`);
    }, 1000);

}
