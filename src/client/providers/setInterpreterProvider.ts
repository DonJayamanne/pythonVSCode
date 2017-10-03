"use strict";
import * as path from 'path';
import * as vscode from 'vscode';
import * as settings from './../common/configSettings';
import { InterpreterManager } from '../interpreter';
import { PythonInterpreter } from '../interpreter/contracts';
import { ShebangCodeLensProvider } from './shebangCodeLensProvider';


interface PythonPathQuickPickItem extends vscode.QuickPickItem {
    path: string;
}

export class SetInterpreterProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    constructor(private interpreterManager: InterpreterManager) {
        this.disposables.push(vscode.commands.registerCommand("python.setInterpreter", this.setInterpreter.bind(this)));
        this.disposables.push(vscode.commands.registerCommand("python.setShebangInterpreter", this.setShebangInterpreter.bind(this)));
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
        const shebang = ShebangCodeLensProvider.detectShebang(vscode.window.activeTextEditor.document);
        if (shebang) {
            this.interpreterManager.setPythonPath(shebang);
        }
    }
}
