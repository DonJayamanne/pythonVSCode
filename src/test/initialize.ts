//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

//First thing to be executed
process.env['PYTHON_DONJAYAMANNE_TEST'] = "1";

// The module 'assert' provides assertion methods from node
import * as assert from "assert";
import * as fs from 'fs';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
let dummyPythonFile = path.join(__dirname, "..", "..", "src", "test", "pythonFiles", "dummy.py");

let configSettings: any = undefined;
export async function initialize(): Promise<any> {
    await initializePython();
    if (!configSettings) {
        configSettings = await require('../client/common/configSettings');
    }
    // Dispose any cached python settings (used only in test env)
    configSettings.PythonSettings.dispose();
    // Opening a python file activates the extension
    return await new Promise<any>((resolve, reject) => {
        vscode.workspace.openTextDocument(dummyPythonFile).then(() => resolve(), reject);
    });
}
export async function initializeTest(): Promise<any> {
    await initializePython();
    await closeActiveWindows();
    if (!configSettings) {
        configSettings = await require('../client/common/configSettings');
    }
    // Dispose any cached python settings (used only in test env)
    configSettings.PythonSettings.dispose();
}

export async function wait(timeoutMilliseconds: number) {
    return new Promise(resolve => {
        setTimeout(resolve, timeoutMilliseconds);
    });
}

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
    if (process.env.TRAVIS_PYTHON_PATH && fs.existsSync(process.env.TRAVIS_PYTHON_PATH)) {
        return process.env.TRAVIS_PYTHON_PATH;
    }
    return 'python';
}

function isMultitrootTest() {
    return Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 1;
}

const PYTHON_PATH = getPythonPath();
export const IS_TRAVIS = (process.env['TRAVIS'] + '') === 'true';
export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();

// Ability to use custom python environments for testing
export function initializePython() {
    const pythonConfig = vscode.workspace.getConfiguration('python');
    pythonConfig.update('pythonPath', PYTHON_PATH);
}

