'use strict';
import * as vscode from 'vscode';
import * as settings from '../common/configSettings';
import { Commands, PythonLanguage } from '../common/constants';
let path = require('path');
let terminal: vscode.Terminal;
import { IS_WINDOWS } from '../common/utils';

export function activateExecInTerminalProvider(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    disposables.push(vscode.commands.registerCommand(Commands.Exec_In_Terminal, execInTerminal));
    disposables.push(vscode.commands.registerCommand(Commands.Exec_Selection_In_Terminal, execSelectionInTerminal));
    disposables.push(vscode.window.onDidCloseTerminal((closedTermina: vscode.Terminal) => {
        if (terminal === closedTermina) {
            terminal = null;
        }
    }));
    return disposables;
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
    terminal = terminal ? terminal : vscode.window.createTerminal(`Python`);
    if (pythonSettings.terminal && pythonSettings.terminal.executeInFileDir) {
        const fileDirPath = path.dirname(filePath);
        if (fileDirPath !== vscode.workspace.rootPath && fileDirPath.substring(1) !== vscode.workspace.rootPath) {
            terminal.sendText(`cd "${fileDirPath}"`);
        }
    }
    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";
    if (IS_WINDOWS) {
        const cmd = `"${currentPythonPath}"${launchArgsString} ${filePath}`;
        terminal.sendText(cmd.replace(/\\/g, "/"));
    }
    else {
        terminal.sendText(`${currentPythonPath}${launchArgsString} ${filePath}`);
    }
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
    terminal = terminal ? terminal : vscode.window.createTerminal(`Python`);
    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";
    if (IS_WINDOWS) {
        // Multi line commands don't work the same way on windows terminals as it does on other OS
        // So just start the Python REPL, then send the commands
        if (currentPythonPath.indexOf(' ') > 0) {
            terminal.sendText(`"${currentPythonPath}"${launchArgsString}`);
        }
        else {
            terminal.sendText(`${currentPythonPath}${launchArgsString}`);
        }
        terminal.sendText(code);
    }
    else {
        terminal.sendText(`${currentPythonPath}${launchArgsString} -c "${code}"`);
    }
    terminal.show();
}