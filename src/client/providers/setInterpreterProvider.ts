"use strict";
import * as path from 'path';
import * as vscode from 'vscode';
import * as settings from './../common/configSettings';
import { InterpreterManager } from '../interpreter';
import { PythonInterpreter } from '../interpreter/contracts';


interface PythonPathQuickPickItem extends vscode.QuickPickItem {
    path: string;
}

export class SetInterpreterProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private ignoreShebangTemp: string[] = [];
    constructor(private interpreterManager: InterpreterManager) {
        this.disposables.push(vscode.commands.registerCommand("python.setInterpreter", this.setInterpreter.bind(this)));
        this.disposables.push(vscode.commands.registerCommand("python.setShebangInterpreter", this.setShebangInterpreter.bind(this)));

        vscode.workspace.onDidOpenTextDocument(this.detectShebangInterpreter.bind(this));
        vscode.workspace.onDidSaveTextDocument(this.detectShebangInterpreter.bind(this));
        vscode.workspace.onDidCloseTextDocument(this.removeFromIgnoreList.bind(this));
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    private suggestionToQuickPickItem(suggestion: PythonInterpreter): PythonPathQuickPickItem {
        let detail = suggestion.path;
        if (vscode.workspace.rootPath && suggestion.path.startsWith(vscode.workspace.rootPath)) {
            detail = `.${path.sep}` + path.relative(vscode.workspace.rootPath!, suggestion.path);
        }
        return {
            label: suggestion.displayName!,
            description: suggestion.companyDisplayName || '',
            detail: detail,
            path: suggestion.path
        };
    }
    private presentQuickPick() {
        this.getSuggestions().then(suggestions => {
            let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
            if (vscode.workspace.rootPath && currentPythonPath.startsWith(vscode.workspace.rootPath)) {
                currentPythonPath = `.${path.sep}` + path.relative(vscode.workspace.rootPath, currentPythonPath);
            }
            const quickPickOptions: vscode.QuickPickOptions = {
                matchOnDetail: true,
                matchOnDescription: true,
                placeHolder: `current: ${currentPythonPath}`
            };
            vscode.window.showQuickPick(suggestions, quickPickOptions).then(
                value => {
                    if (value !== undefined) {
                        this.interpreterManager.setPythonPath(value.path);
                    }
                });
        });
    }

    private getSuggestions() {
        return this.interpreterManager.getInterpreters()
            .then(interpreters => interpreters.sort((a, b) => a.displayName! > b.displayName! ? 1 : -1))
            .then(interpreters => interpreters.map(this.suggestionToQuickPickItem));
    }

    private setInterpreter() {
        this.presentQuickPick();
    }

    private setShebangInterpreter() {
        const document = vscode.window.activeTextEditor.document;
        let error = false;

        var firstLine = document.lineAt(0);
        if (firstLine.isEmptyOrWhitespace) {
            error = true;
        }

        if (!error && "#!" === firstLine.text.substr(0, 2)) {
            // Shebang detected
            this.interpreterManager.setPythonPath(firstLine.text.substr(2).trim());
        }

        if (error) {
            vscode.window.showErrorMessage("No shebang found.")
        }
    }

    private removeFromIgnoreList(document: vscode.TextDocument) {
        const index = this.ignoreShebangTemp.indexOf(document.fileName)
        if (index > -1 ) {
            this.ignoreShebangTemp.splice(index, 1);
        }
    }

    private detectShebangInterpreter(document: vscode.TextDocument) {
        if (document.languageId !== 'python' || typeof vscode.workspace.rootPath === "string") {
            return;
        }
        
        var firstLine = document.lineAt(0);
        if (firstLine.isEmptyOrWhitespace) {
            return;
        }

        const pythonConfig = vscode.workspace.getConfiguration('python');

        // check for Shebang
        const selectedPythonPath = pythonConfig.get("pythonPath");
        let intendedPythonPath = null;
        if ("#!" === firstLine.text.substr(0, 2)) {
            // Shebang detected
            intendedPythonPath = firstLine.text.substr(2).trim();
        }
        else {
            return;
        }

        // check, if automatic interpreter switch is globally disabled
        const disableShebangDetection = pythonConfig.get('disableShebangDetection');
        if (disableShebangDetection) {
            return;
        }

        // check, if the automatic interpreter switch is disabled for current file
        const filesIgnoreAlways = pythonConfig.get('ignoreShebang', [] as string[]);
        if (filesIgnoreAlways.indexOf(document.fileName) > -1 || this.ignoreShebangTemp.indexOf(document.fileName) > -1) {
            return;
        }

        // check, if current interpreter is already the right one
        if (selectedPythonPath === intendedPythonPath) {
            return;
        }


        const optionChange = 'Change interpreter';
        const optionIgnoreUntilClose = 'Ignore until close';
        const optionIgnoreAlways = 'Ignore always';
        const optionNeverShowAgain = `Don't ask again`;
        const options = [optionChange, optionIgnoreUntilClose, optionIgnoreAlways, optionNeverShowAgain];
        const nThis = this;

        vscode.window.showWarningMessage('Detected another interpreter for this file!', ...options).then(item => {
            switch(item) {
                case optionChange: {
                    nThis.interpreterManager.setPythonPath(intendedPythonPath);
                    return;
                }
                case optionIgnoreUntilClose: {
                    nThis.ignoreShebangTemp.push(document.fileName);
                    return;
                }
                case optionIgnoreAlways: {
                    filesIgnoreAlways.push(document.fileName);
                    pythonConfig.update('ignoreShebang', filesIgnoreAlways, true);
                    return;
                }
                case optionNeverShowAgain: {
                    pythonConfig.update('disableShebangDetection', true);
                    return;
                }
            }
        });
    }
}