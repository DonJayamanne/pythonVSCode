// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// Place this right on top
import { initialize, PYTHON_PATH, closeActiveWindows } from '../initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { EOL } from 'os';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';

let pythonSettings = settings.PythonSettings.getInstance();
let autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');
const fileImport = path.join(autoCompPath, 'imp.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');

suite('Autocomplete', () => {
    suiteSetup(done => {
        initialize().then(() => {
            pythonSettings.pythonPath = PYTHON_PATH;
            done();
        }, done);
    });

    suiteTeardown(done => {
        closeActiveWindows().then(done, done);
    });
    teardown(done => {
        closeActiveWindows().then(done, done);
    });

    test('For "sys."', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(3, 10);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.notEqual(list.items.filter(item => item.label === 'api_version').length, 0, 'api_version not found');
            assert.notEqual(list.items.filter(item => item.label === 'argv').length, 0, 'argv not found');
            assert.notEqual(list.items.filter(item => item.label === 'prefix').length, 0, 'prefix not found');
        }).then(done, done);
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/975
    test('For "import *"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileImport);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(1, 4);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'fstat').length, 0, 'fstat not found');
    });

    test('For custom class', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(30, 4);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.notEqual(list.items.filter(item => item.label === 'method1').length, 0, 'method1 not found');
            assert.notEqual(list.items.filter(item => item.label === 'method2').length, 0, 'method2 not found');
        }).then(done, done);
    });

    test('With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(25, 4);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.equal(list.items.filter(item => item.label === 'bar').length, 1, 'bar not found');
            const documentation = `说明 - keep this line, it works${EOL}delete following line, it works${EOL}如果存在需要等待审批或正在执行的任务，将不刷新页面`;
            assert.equal(list.items.filter(item => item.label === 'bar')[0].documentation, documentation, 'unicode documentation is incorrect');
        }).then(done, done);
    });

    test('Across files With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 5);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.equal(list.items.filter(item => item.label === 'Foo').length, 1, 'Foo not found');
            assert.equal(list.items.filter(item => item.label === 'Foo')[0].documentation, '说明', 'Foo unicode documentation is incorrect');

            assert.equal(list.items.filter(item => item.label === 'showMessage').length, 1, 'showMessage not found');
            const documentation = `Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. ${EOL}Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.`;
            assert.equal(list.items.filter(item => item.label === 'showMessage')[0].documentation, documentation, 'showMessage unicode documentation is incorrect');
        }).then(done, done);
    });
});
