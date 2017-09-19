"use strict";
import * as path from "path";
import * as vscode from "vscode";
import * as settings from "./../common/configSettings";
import * as utils from "../common/utils";
import { activate, PythonInterpreter, PythonInterpreterProvider } from '../interpreter';


interface PythonPathQuickPickItem extends vscode.QuickPickItem {
    path: string;
}

export function activateSetInterpreterProvider(): vscode.Disposable[] {
    return [
        activate(),
        vscode.commands.registerCommand("python.setInterpreter", setInterpreter)
    ];
}

function suggestionToQuickPickItem(suggestion: PythonInterpreter): PythonPathQuickPickItem {
    let detail = suggestion.path;
    if (suggestion.path.startsWith(vscode.workspace.rootPath)) {
        detail = `.${path.sep}` + path.relative(vscode.workspace.rootPath, suggestion.path);
    }
    return {
        label: suggestion.displayName,
        description: suggestion.companyDisplayName,
        detail: detail,
        path: suggestion.path
    };
}
function setPythonPath(pythonPath: string, created: boolean = false) {
    pythonPath = utils.IS_WINDOWS ? pythonPath.replace(/\\/g, "/") : pythonPath;
    if (pythonPath.startsWith(vscode.workspace.rootPath)) {
        pythonPath = path.join('${workspaceRoot}', path.relative(vscode.workspace.rootPath, pythonPath));
    }
    const pythonConfig = vscode.workspace.getConfiguration('python');
    pythonConfig.update('pythonPath', pythonPath).then(() => {
        //Done
    }, reason => {
        vscode.window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${reason.message}`);
        console.error(reason);
    });
}

function presentQuickPickOfSuggestedPythonPaths() {
    let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    if (currentPythonPath.startsWith(vscode.workspace.rootPath)) {
        currentPythonPath = `.${path.sep}` + path.relative(vscode.workspace.rootPath, currentPythonPath);
    }
    const quickPickOptions: vscode.QuickPickOptions = {
        matchOnDetail: true,
        matchOnDescription: true,
        placeHolder: `current: ${currentPythonPath}`
    };

    new PythonInterpreterProvider().getInterpreters().then(interpreters => {
        const suggestions = interpreters
            .sort((a, b) => a.displayName > b.displayName ? 1 : -1)
            .map(suggestionToQuickPickItem);

        vscode.window.showQuickPick(suggestions, quickPickOptions).then(
            value => {
                if (value !== undefined) {
                    setPythonPath(value.path);
                }
            });
    });
}

function setInterpreter() {
    if (typeof vscode.workspace.rootPath !== 'string') {
        return vscode.window.showErrorMessage('Please open a workspace to select the Python Interpreter');
    }
    presentQuickPickOfSuggestedPythonPaths();
}