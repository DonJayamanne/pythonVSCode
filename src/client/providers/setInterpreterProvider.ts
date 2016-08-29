"use strict";
import * as child_process from 'child_process';
import * as path  from "path";
import * as vscode from "vscode";
import * as settings from "./../common/configSettings";
import * as utils from "./../common/utils";
let ncp = require("copy-paste");

// where to find the Python binary within a conda env
const CONDA_RELATIVE_PY_PATH = utils.IS_WINDOWS ? ['python'] : ['bin', 'python'] 
const REPLACE_PYTHONPATH_REGEXP = /("python\.pythonPath"\s*:\s*)"(.*)"/;

interface PythonPathSuggestion {
    label: string, // myenvname
    path: string,  // /full/path/to/bin/python
    type: string   // conda
}

function workspaceSettingsPath() {
    return path.join(vscode.workspace.rootPath, '.vscode', 'settings.json')
}

export function activateSetInterpreterProvider() {
    vscode.commands.registerCommand("python.setInterpreter", setInterpreter);
}

function suggestionsFromConda(): Promise<PythonPathSuggestion[]> {
    return new Promise((resolve, reject) => {
        // interrogate conda (if it's on the path) to find all environments
        child_process.execFile('conda', ['info', '--json'], (error, stdout, stderr) => {
            try {
                const info = JSON.parse(stdout)

                // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv
                const envs = <string[]>info['envs']

                // The root of the conda environment is itself a Python interpreter
                envs.push(info["default_prefix"])

                const suggestions = envs.map(env => ({
                    label: path.basename(env),  // e.g. someEnv, miniconda3
                    path: path.join(env, ...CONDA_RELATIVE_PY_PATH),
                    type: 'conda',
                }))
                resolve(suggestions)
            } catch (e) {
                // Failed because either:
                //   1. conda is not installed
                //   2. `conda info --json` has changed signature
                //   3. output of `conda info --json` has changed in structure
                // In all cases, we can't offer conda pythonPath suggestions.
                return resolve([])
            }
        })
    });
}

function suggestionToQuickPickItem(suggestion: PythonPathSuggestion) : vscode.QuickPickItem {
    return {
        label: suggestion.label,
        description: suggestion.type,
        detail: utils.IS_WINDOWS ? suggestion.path.replace(/\\/g, "/") : suggestion.path
    }
}

function suggestPythonPaths(): Promise<vscode.QuickPickItem[]> {

    // For now we only interrogate conda for suggestions.
    const condaSuggestions = suggestionsFromConda();

    // Here we could also look for virtualenvs/default install locations...

    return condaSuggestions.then(
        suggestions => suggestions.map(suggestionToQuickPickItem)
    );
}

function replaceContentsOfFile(doc: vscode.TextDocument, newContent: string) {

    const lastLine = doc.lineAt(doc.lineCount - 2);
    const start = new vscode.Position(0, 0);
    const end = new vscode.Position(doc.lineCount - 1, lastLine.text.length);

    const textEdit = vscode.TextEdit.replace(new vscode.Range(start, end), newContent);
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(doc.uri, [textEdit]);
    return vscode.workspace.applyEdit(workspaceEdit).then(() => doc.save())
}

function setPythonPath(pythonPath: string) {
    vscode.workspace.openTextDocument(workspaceSettingsPath())
        .then(doc => {
            const settingsText = doc.getText();
            if (settingsText.search(REPLACE_PYTHONPATH_REGEXP) === -1) {
                console.log("Can't find setting to replace.");
                // Can't find the setting to replace - will just have to offer a Copy to Clipboard button and instruct them to edit themselves.
                const copy_msg =  "Copy to Clipboard"
                vscode.commands.executeCommand('workbench.action.openWorkspaceSettings');
                vscode.window.showInformationMessage(pythonPath, copy_msg)
                    .then(item => {
                        if (item === copy_msg) {
                            ncp.copy(pythonPath)
                        }
                    })
            } else {
                // Great, the user already has a setting stated that we can relibly replace!
                const newSettingsText = settingsText.replace(REPLACE_PYTHONPATH_REGEXP, `$1"${pythonPath}"`);
                replaceContentsOfFile(doc, newSettingsText).then(
                    () => {
                        vscode.window.setStatusBarMessage(`Project Interpreter set to ${pythonPath}`);
                        // const currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
                        // console.log(currentPythonPath);
                        // console.log(pythonPath);
                        // if (currentPythonPath === pythonPath) {
                        // } else {
                        //     vscode.window.showErrorMessage(`Error in setting interpreter`);
                        // }
                    }
                )
            }
        });
}

function presentQuickPickOfSuggestedPythonPaths() {
    const currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    const quickPickOptions: vscode.QuickPickOptions = {
        matchOnDetail: true,
        matchOnDescription: false,
        placeHolder: `current: ${currentPythonPath}`
    }

    vscode.window.showQuickPick(suggestPythonPaths(), quickPickOptions).then(
        value => {
            if (value !== undefined) {
                setPythonPath(value.detail);
            }
        })
}

function setInterpreter() {
    // For now the user has to manually edit the workspace settings to change the
    // pythonPath -> First check they have .vscode/settings.json
    let settingsPath: string
    try {
        settingsPath = workspaceSettingsPath()
    } catch (e) {
        // We aren't even in a workspace
        vscode.window.showErrorMessage("The interpreter can only be set within a workspace (open a folder)")
        return
    }
    vscode.workspace.openTextDocument(workspaceSettingsPath()).then(
        presentQuickPickOfSuggestedPythonPaths,
        () => {
            // No settings present yet! Trigger the opening of the workspace settings for the first time
            // then present the picker.
            vscode.commands.executeCommand('workbench.action.openWorkspaceSettings').then(presentQuickPickOfSuggestedPythonPaths)
        }
    )
}
