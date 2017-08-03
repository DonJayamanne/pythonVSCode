
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// Place this right on top
import { initialize, closeActiveWindows, setPythonExecutable } from '../initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';
import { execPythonFile } from '../../client/common/utils';
import { createDeferred } from '../../client/common/helpers';

let pythonSettings = settings.PythonSettings.getInstance();
let disposable: vscode.Disposable;

let autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const filePep484 = path.join(autoCompPath, 'pep484.py');

suite('Autocomplete PEP 484', () => {
    const isPython3Deferred = createDeferred<boolean>();
    const isPython3 = isPython3Deferred.promise;
    suiteSetup(async () => {
        disposable = setPythonExecutable(pythonSettings);
        await initialize();
        let version = await execPythonFile(pythonSettings.pythonPath, ['--version'], __dirname, true);
        isPython3Deferred.resolve(version.indexOf('3.') >= 0);
    });
    suiteTeardown(done => {
        disposable.dispose();
        closeActiveWindows().then(() => done(), () => done());
    });
    teardown(done => {
        closeActiveWindows().then(() => done(), () => done());
    });

    test('argument', async () => {
        if (!await isPython3) {
            return;
        }
        let textDocument = await vscode.workspace.openTextDocument(filePep484);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(2, 27);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('return value', async () => {
        if (!await isPython3) {
            return;
        }
        let textDocument = await vscode.workspace.openTextDocument(filePep484);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(8, 6);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'bit_length').length, 0, 'bit_length not found');
        assert.notEqual(list.items.filter(item => item.label === 'from_bytes').length, 0, 'from_bytes not found');
    });
});