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

export function initialize(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        vscode.workspace.openTextDocument(dummyPythonFile).then(resolve, reject);
    });
}

export async function closeActiveWindows(): Promise<any> {
    // https://github.com/Microsoft/vscode/blob/master/extensions/vscode-api-tests/src/utils.ts
    return new Promise((c, e) => {
        if (vscode.window.visibleTextEditors.length === 0) {
            return c();
        }

        // TODO: the visibleTextEditors variable doesn't seem to be
        // up to date after a onDidChangeActiveTextEditor event, not
        // even using a setTimeout 0... so we MUST poll :(
        let interval = setInterval(() => {
            if (vscode.window.visibleTextEditors.length > 0) {
                return;
            }

            clearInterval(interval);
            c();
        }, 10);

        setTimeout(() => {
            if (vscode.window.visibleTextEditors.length === 0) {
                return c();
            }
            vscode.commands.executeCommand('workbench.action.closeAllEditors')
                .then(() => null, (err: any) => {
                    clearInterval(interval);
                    //e(err);
                    c();
                });
        }, 50);

    }).then(() => {
        assert.equal(vscode.window.visibleTextEditors.length, 0);
        // assert(!vscode.window.activeTextEditor);
    });
}

export const IS_TRAVIS = (process.env['TRAVIS'] + '') === 'true';
export const TEST_TIMEOUT = 25000;

function getPythonPath(): string {
    const pythonPaths = ['/home/travis/virtualenv/python3.5.2/bin/python',
        '/Users/travis/.pyenv/versions/3.5.1/envs/MYVERSION/bin/python',
        '/Users/donjayamanne/Projects/PythonEnvs/p361/bin/python',
        '/Users/donjayamanne/Projects/PythonEnvs/p27/bin/python'];
    for (let counter = 0; counter < pythonPaths.length; counter++) {
        if (fs.existsSync(pythonPaths[counter])) {
            return pythonPaths[counter];
        }
    }
    return 'python';
}

// export const PYTHON_PATH = IS_TRAVIS ? getPythonPath() : 'python';
export const PYTHON_PATH = getPythonPath();
export function setPythonExecutable(pythonSettings: any): vscode.Disposable {
    pythonSettings.pythonPath = PYTHON_PATH;
    return vscode.workspace.onDidChangeConfiguration(() => {
        pythonSettings.pythonPath = PYTHON_PATH;
    });
}