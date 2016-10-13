//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

//First thing to be executed
process.env['PYTHON_DONJAYAMANNE_TEST'] = "1";

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
let dummyPythonFile = path.join(__dirname, "..", "..", "src", "test", "pythonFiles", "dummy.py");

export function initialize(): Thenable<any> {
    return vscode.workspace.openTextDocument(dummyPythonFile);
}

export function closeActiveWindows(counter: number = 0): Thenable<any> {
    if (counter >= 10 || !vscode.window.activeTextEditor) {
        return Promise.resolve();
    }
    return new Promise<any>(resolve => {
        setTimeout(function () {
            if (!vscode.window.activeTextEditor) {
                return resolve();
            }

            vscode.commands.executeCommand('workbench.action.closeActiveEditor').then(() => {
                closeActiveWindows(counter++).then(resolve, resolve);
            });
        }, 500);
    });
}
