'use strict';
import * as vscode from 'vscode';
import * as settings from '../common/configSettings';
import { Commands, PythonLanguage } from '../common/constants';
import { EOL } from 'os';
let path = require('path');
let terminal: vscode.Terminal;
import { IS_WINDOWS } from '../common/utils';

export function activateExecInTerminalProvider(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    disposables.push(vscode.commands.registerCommand(Commands.Exec_In_Terminal, execInTerminal));
    disposables.push(vscode.commands.registerCommand(Commands.Import_Into_Terminal, importIntoTerminal));
    disposables.push(vscode.commands.registerCommand(Commands.Exec_Selection_In_Terminal, execSelectionInTerminal));
    disposables.push(vscode.commands.registerCommand(Commands.Exec_Selection_In_Django_Shell, execSelectionInDjangoShell));
    disposables.push(vscode.window.onDidCloseTerminal((closedTermina: vscode.Terminal) => {
        if (terminal === closedTermina) {
            terminal = null;
        }
    }));
    return disposables;
}

function removeBlankLines(code: string): string {
    let codeLines = code.split(/\r?\n/g);
    let codeLinesWithoutEmptyLines = codeLines.filter(line => line.trim().length > 0);
    let lastLineIsEmpty = codeLines.length > 0 && codeLines[codeLines.length - 1].trim().length === 0;
    if (lastLineIsEmpty) {
        codeLinesWithoutEmptyLines.unshift('');
    }
    return codeLinesWithoutEmptyLines.join(EOL);
}

function execInTerminal(fileUri?: vscode.Uri) {
    setUpTerminal(TerminalActions.execInTerminal, fileUri)
}

function importIntoTerminal(fileUri?: vscode.Uri) {
    setUpTerminal(TerminalActions.importIntoTerminal, fileUri)
}

const enum TerminalActions {
    'execInTerminal' = 0,
    'importIntoTerminal' = 1
}

function setUpTerminal(action: TerminalActions, fileUri?: vscode.Uri) {
    const terminalShellSettings = vscode.workspace.getConfiguration('terminal.integrated.shell');
    const IS_POWERSHELL = /powershell/.test(terminalShellSettings.get<string>('windows'));

    let pythonSettings = settings.PythonSettings.getInstance();
    let filePath: string;

    let currentPythonPath = pythonSettings.pythonPath;
    if (currentPythonPath.indexOf(' ') > 0) {
        currentPythonPath = `"${currentPythonPath}"`;
    }

    if (fileUri === undefined || fileUri === null || typeof fileUri.fsPath !== 'string') {
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
    if (action == TerminalActions.importIntoTerminal || (pythonSettings.terminal && pythonSettings.terminal.executeInFileDir)) {
        const fileDirPath = path.dirname(filePath);
        if (fileDirPath !== vscode.workspace.rootPath && fileDirPath.substring(1) !== vscode.workspace.rootPath) {
            terminal.sendText(`cd "${fileDirPath}"`);
        }
    }

    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";

    let command: string;
    if (action == TerminalActions.execInTerminal) {
        command = `${currentPythonPath}${launchArgsString} ${filePath}`;
    }
    else if (action == TerminalActions.importIntoTerminal) {
        command = `${currentPythonPath}${launchArgsString}`;        
    }

    if (IS_WINDOWS) {
        const commandWin = command.replace(/\\/g, "/");
        if (IS_POWERSHELL) {
            terminal.sendText(`& ${commandWin}`);
        }
        else {
            terminal.sendText(commandWin);
        }
    }
    else {
        terminal.sendText(command);
    }

    if (action == TerminalActions.importIntoTerminal) {
        const module = filePath.slice(path.dirname(filePath).length + 1, -3)
        terminal.sendText(`from ${module} import *`);
    }
    terminal.show();
}

function execSelectionInTerminal() {
    const terminalShellSettings = vscode.workspace.getConfiguration('terminal.integrated.shell');
    const IS_POWERSHELL = /powershell/.test(terminalShellSettings.get<string>('windows'));

    let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    if (currentPythonPath.indexOf(' ') > 0) {
        currentPythonPath = `"${currentPythonPath}"`;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const selection = vscode.window.activeTextEditor.selection;
    let code: string;
    if (selection.isEmpty) {
        code = vscode.window.activeTextEditor.document.lineAt(selection.start.line).text;
    }
    else {
        let textRange = new vscode.Range(selection.start, selection.end);
        code = vscode.window.activeTextEditor.document.getText(textRange);
    }
    if (code.length === 0) {
        return;
    }
    code = removeBlankLines(code);
    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";
    const command = `${currentPythonPath}${launchArgsString}`;
    if (!terminal) {
        terminal = vscode.window.createTerminal(`Python`);
        if (IS_WINDOWS) {
            const commandWin = command.replace(/\\/g, "/");
            if (IS_POWERSHELL) {
                terminal.sendText(`& ${commandWin}`);
            }
            else {
                terminal.sendText(commandWin);
            }
        }
        else {
            terminal.sendText(command);
        }
    }
    const unix_code = code.replace(/\r\n/g, "\n");
    if (IS_WINDOWS) {
        terminal.sendText(unix_code.replace(/\n/g, "\r\n"));
    }
    else {
        terminal.sendText(unix_code);
    }
    terminal.show();
}

function execSelectionInDjangoShell() {
    const terminalShellSettings = vscode.workspace.getConfiguration('terminal.integrated.shell');
    const IS_POWERSHELL = /powershell/.test(terminalShellSettings.get<string>('windows'));

    let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    if (currentPythonPath.indexOf(' ') > 0) {
        currentPythonPath = `"${currentPythonPath}"`;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const workspaceRoot = vscode.workspace.rootPath;
    const djangoShellCmd = `"${workspaceRoot}/manage.py" shell`;
    const selection = vscode.window.activeTextEditor.selection;
    let code: string;
    if (selection.isEmpty) {
        code = vscode.window.activeTextEditor.document.lineAt(selection.start.line).text;
    }
    else {
        let textRange = new vscode.Range(selection.start, selection.end);
        code = vscode.window.activeTextEditor.document.getText(textRange);
    }
    if (code.length === 0) {
        return;
    }
    const launchArgs = settings.PythonSettings.getInstance().terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? " ".concat(launchArgs.join(" ")) : "";
    const command = `${currentPythonPath}${launchArgsString} ${djangoShellCmd}`;
    if (!terminal) {
        terminal = vscode.window.createTerminal(`Django Shell`);
        if (IS_WINDOWS) {
            const commandWin = command.replace(/\\/g, "/");
            if (IS_POWERSHELL) {
                terminal.sendText(`& ${commandWin}`);
            }
            else {
                terminal.sendText(commandWin);
            }
        }
        else {
            terminal.sendText(command);
        }
    }
    const unix_code = code.replace(/\r\n/g, "\n");
    if (IS_WINDOWS) {
        terminal.sendText(unix_code.replace(/\n/g, "\r\n"));
    }
    else {
        terminal.sendText(unix_code);
    }
    terminal.show();
}