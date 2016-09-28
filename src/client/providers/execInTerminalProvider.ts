'use strict';
import * as vscode from 'vscode';
import * as settings from '../common/configSettings';
import { Commands, PythonLanguage } from '../common/constants';
let path = require('path');

export function activateExecInTerminalProvider() {
    vscode.commands.registerCommand(Commands.Exec_In_Terminal, execInTerminal);
    vscode.commands.registerCommand(Commands.Exec_Selection_In_Terminal, execSelectionInTerminal);
}

function execInTerminal(fileUri?: vscode.Uri) {
    let pythonSettings = settings.PythonSettings.getInstance();
    const currentPythonPath = pythonSettings.pythonPath;
    let filePath: string;

    if (fileUri === undefined || typeof fileUri.fsPath !== 'string') {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor !== undefined) {
            if (!activeEditor.document.isUntitled) {
                if (activeEditor.document.languageId === PythonLanguage.language) {
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

    if (filePath.indexOf(' ') > 0) {
        filePath = `"${filePath}"`;
    }
    const terminal = vscode.window.createTerminal(`Python`);
    if (pythonSettings.terminal && pythonSettings.terminal.executeInFileDir) {
        const fileDirPath = path.dirname(filePath).substring(1);
        if (fileDirPath !== vscode.workspace.rootPath) {
            terminal.sendText(`cd "${fileDirPath}"`);
        }
    }
    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";
    terminal.sendText(`${currentPythonPath}${launchArgsString} ${filePath}`);
    terminal.show();
}

function execSelectionInTerminal() {
    const currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const selection = vscode.window.activeTextEditor.selection;
    if (selection.isEmpty) {
        return;
    }
    const code = vscode.window.activeTextEditor.document.getText(new vscode.Range(selection.start, selection.end));
    const terminal = vscode.window.createTerminal(`Python`);
    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";
    terminal.sendText(`${currentPythonPath}${launchArgsString} -c "${code}"`);
    terminal.show();
}