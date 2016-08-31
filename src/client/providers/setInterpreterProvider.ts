"use strict";
import * as child_process from 'child_process';
import * as path  from "path";
import * as vscode from "vscode";
import * as settings from "../common/configSettings";
import { Commands } from '../common/constants';
import * as utils from "../common/utils";
let ncp = require("copy-paste");

// where to find the Python binary within a conda env
const CONDA_RELATIVE_PY_PATH = utils.IS_WINDOWS ? ['python'] : ['bin', 'python'] 

interface PythonPathSuggestion {
    label: string, // myenvname
    path: string,  // /full/path/to/bin/python
    type: string   // conda
}

function workspaceSettingsPath() {
    return path.join(vscode.workspace.rootPath, '.vscode', 'settings.json')
}

export function activateSetInterpreterProvider() {
    vscode.commands.registerCommand(Commands.Set_Interpreter, setInterpreter);
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

function setPythonPath(pythonPath: string) {
    // Waiting on https://github.com/Microsoft/vscode/issues/1396
    // For now, just let the user copy this to clipboard
    const copy_msg =  "Copy to Clipboard"

    // If the user already has .vscode/settings.json in the workspace
    // open it for them
    vscode.workspace.openTextDocument(workspaceSettingsPath())
        .then(doc => vscode.window.showTextDocument(doc));
    
    vscode.window.showInformationMessage(pythonPath, copy_msg)
        .then(item => {
            if (item === copy_msg) {
                ncp.copy(pythonPath)
            }
        })
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
    vscode.workspace.openTextDocument(settingsPath)
        .then(doc => {
                // Great, workspace file exists. Present it for copy/pasting into...
                vscode.window.showTextDocument(doc);
                // ...and offer the quick-pick suggestions.
                presentQuickPickOfSuggestedPythonPaths()
            }, 
            () => {
                // The user doesn't have any workspace settings!
                // Prompt them to create one first
                vscode.window.showErrorMessage("No workspace settings file. First, run 'Preferences: Open Workspace Settings' to create one." )
                })
}
