import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { clearPythonPathInWorkspaceFolder } from './common';
const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');

//First thing to be executed
// tslint:disable-next-line:no-string-literal
process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';

// tslint:disable-next-line:no-any
let configSettings: any;
let extensionActivated: boolean = false;
// tslint:disable-next-line:no-any
export async function initialize(): Promise<any> {
    await initializePython();
    // Opening a python file activates the extension.
    await vscode.workspace.openTextDocument(dummyPythonFile);
    if (!extensionActivated) {
        // tslint:disable-next-line:no-require-imports
        const ext = require('../client/extension');
        // tslint:disable-next-line:no-unsafe-any
        await ext.activated;
        extensionActivated = true;
    }
    if (!configSettings) {
        // tslint:disable-next-line:no-require-imports
        configSettings = await require('../client/common/configSettings');
    }
    // Dispose any cached python settings (used only in test env).
    // tslint:disable-next-line:no-unsafe-any)
    configSettings.PythonSettings.dispose();
}
// tslint:disable-next-line:no-any
export async function initializeTest(): Promise<any> {
    await initializePython();
    await closeActiveWindows();
    if (!configSettings) {
        // tslint:disable-next-line:no-require-imports no-unsafe-any
        configSettings = await require('../client/common/configSettings');
    }
    // Dispose any cached python settings (used only in test env)
    // tslint:disable-next-line:no-unsafe-any
    configSettings.PythonSettings.dispose();
}

export async function wait(timeoutMilliseconds: number) {
    return new Promise(resolve => {
        // tslint:disable-next-line:no-string-based-set-timeout
        setTimeout(resolve, timeoutMilliseconds);
    });
}

// tslint:disable-next-line:no-any
export async function closeActiveWindows(): Promise<any> {
    // https://github.com/Microsoft/vscode/blob/master/extensions/vscode-api-tests/src/utils.ts
    return new Promise(resolve => {
        if (vscode.window.visibleTextEditors.length === 0) {
            return resolve();
        }

        // TODO: the visibleTextEditors variable doesn't seem to be
        // up to date after a onDidChangeActiveTextEditor event, not
        // even using a setTimeout 0... so we MUST poll :(
        const interval = setInterval(() => {
            if (vscode.window.visibleTextEditors.length > 0) {
                return;
            }

            clearInterval(interval);
            resolve();
        }, 10);

        setTimeout(() => {
            if (vscode.window.visibleTextEditors.length === 0) {
                return resolve();
            }
            vscode.commands.executeCommand('workbench.action.closeAllEditors')
                // tslint:disable-next-line:no-any
                .then(() => null, (err: any) => {
                    clearInterval(interval);
                    resolve();
                });
        }, 50);

    }).then(() => {
        assert.equal(vscode.window.visibleTextEditors.length, 0);
    });
}

function getPythonPath(): string {
    // tslint:disable-next-line:no-unsafe-any
    if (process.env.TRAVIS_PYTHON_PATH && fs.existsSync(process.env.TRAVIS_PYTHON_PATH)) {
        // tslint:disable-next-line:no-unsafe-any
        return process.env.TRAVIS_PYTHON_PATH;
    }
    return 'python';
}

function isMultitrootTest() {
    return Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 1;
}

const PYTHON_PATH = getPythonPath();
// tslint:disable-next-line:no-string-literal prefer-template
export const IS_TRAVIS = (process.env['TRAVIS'] + '') === 'true';
export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();

// Ability to use custom python environments for testing
export async function initializePython() {
    const pythonConfig = vscode.workspace.getConfiguration('python');
    const value = pythonConfig.inspect('pythonPath');
    if (value && value.workspaceValue !== PYTHON_PATH) {
        await pythonConfig.update('pythonPath', PYTHON_PATH, vscode.ConfigurationTarget.Workspace);
    }

    await clearPythonPathInWorkspaceFolder(dummyPythonFile);
}
