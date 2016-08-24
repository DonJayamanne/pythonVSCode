"use strict";
import * as child_process from 'child_process';
import * as path  from "path";
import * as vscode from "vscode";
import * as settings from "./../common/configSettings";
import * as utils from "./../common/utils";

export function activateExecInTerminalProvider() {
    vscode.commands.registerCommand("python.execInTerminal", execInTerminal);
}

function execInTerminal(filePath: string) {
    const currentPythonPath = settings.PythonSettings.getInstance().pythonPath;

    console.log(filePath);
    if (filePath === undefined) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor !== undefined) {
            if (!activeEditor.document.isUntitled) {
                filePath = activeEditor.document.fileName;
            } else {
                vscode.window.showErrorMessage('The active file needs to be saved before it can be run');
                return;
            }
        } else {
            vscode.window.showErrorMessage('No open file to run in terminal');
            return;
        }
    }

    const terminal = (<any>vscode.window).createTerminal(`Ext Terminal`);
    setTimeout(() => {
        terminal.sendText(`${currentPythonPath} ${filePath}`);
    }, 1000);

}
