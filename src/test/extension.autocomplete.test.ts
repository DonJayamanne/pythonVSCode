
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// Place this right on top
import { initialize, PYTHON_PATH, closeActiveWindows } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { EOL } from 'os';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../client/common/configSettings';

let pythonSettings = settings.PythonSettings.getInstance();
let autoCompPath = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');
const fileTwo = path.join(autoCompPath, 'two.py');
const fileThree = path.join(autoCompPath, 'three.py');
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
        return vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(3, 10);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then((list: { isIncomplete: boolean, items: vscode.CompletionItem[] }) => {
            assert.notEqual(list.items.filter(item => item.label === 'api_version').length, 0, 'api_version not found');
            assert.notEqual(list.items.filter(item => item.label === 'argv').length, 0, 'argv not found');
            assert.notEqual(list.items.filter(item => item.label === 'prefix').length, 0, 'prefix not found');
        }).then(done, done);
    });

    test('For custom class', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(30, 4);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then((list: { isIncomplete: boolean, items: vscode.CompletionItem[] }) => {
            assert.notEqual(list.items.filter(item => item.label === 'method1').length, 0, 'method1 not found');
            assert.notEqual(list.items.filter(item => item.label === 'method2').length, 0, 'method2 not found');
        }).then(done, done);
    });

    test('With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(25, 4);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then((list: { isIncomplete: boolean, items: vscode.CompletionItem[] }) => {
            assert.equal(list.items.filter(item => item.label === 'bar').length, 1, 'bar not found');
            const documentation = `bar()${EOL}${EOL}说明 - keep this line, it works${EOL}delete following line, it works${EOL}如果存在需要等待审批或正在执行的任务，将不刷新页面`;
            assert.equal(list.items.filter(item => item.label === 'bar')[0].documentation, documentation, 'unicode documentation is incorrect');
        }).then(done, done);
    });

    test('Across files With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 5);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then((list: { isIncomplete: boolean, items: vscode.CompletionItem[] }) => {
            assert.equal(list.items.filter(item => item.label === 'Foo').length, 1, 'Foo not found');
            assert.equal(list.items.filter(item => item.label === 'Foo')[0].documentation, '说明', 'Foo unicode documentation is incorrect');

            assert.equal(list.items.filter(item => item.label === 'showMessage').length, 1, 'showMessage not found');
            const documentation = `showMessage()${EOL}${EOL}Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. ${EOL}Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.`;
            assert.equal(list.items.filter(item => item.label === 'showMessage')[0].documentation, documentation, 'showMessage unicode documentation is incorrect');
        }).then(done, done);
    });
});

suite('Code Definition', () => {
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

    test('Go to method', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(30, 5);
            return vscode.commands.executeCommand('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, uri: vscode.Uri }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '17,8', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '17,8', 'End position is incorrect');
        }).then(done, done);
    });

    test('Across files', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileThree).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 5);
            return vscode.commands.executeCommand('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, uri: vscode.Uri }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '0,6', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '0,6', 'End position is incorrect');
            assert.equal(def[0].uri.fsPath, fileTwo, 'File is incorrect');
        }).then(done, done);
    });

    test('With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(25, 6);
            return vscode.commands.executeCommand('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, uri: vscode.Uri }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '10,8', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '10,8', 'End position is incorrect');
            assert.equal(def[0].uri.fsPath, fileEncoding, 'File is incorrect');
        }).then(done, done);
    });

    test('Across files with Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 11);
            return vscode.commands.executeCommand('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, uri: vscode.Uri }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '18,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '18,4', 'End position is incorrect');
            assert.equal(def[0].uri.fsPath, fileEncoding, 'File is incorrect');
        }).then(done, done);
    });
});

suite('Hover Definition', () => {
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

    test('Method', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(30, 5);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, contents: { language: string, value: string }[] }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '30,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '30,11', 'End position is incorrect');
            assert.equal(def[0].contents.length, 1, 'Invalid content items');
            assert.equal(def[0].contents[0].value, `method1(self)${EOL}${EOL}This is method1`, 'Invalid conents');
        }).then(done, done);
    });

    test('Across files', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileThree).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 12);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, contents: { language: string, value: string }[] }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '1,9', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '1,12', 'End position is incorrect');
            assert.equal(def[0].contents.length, 1, 'Invalid content items');
            assert.equal(def[0].contents[0].value, `fun()${EOL}${EOL}This is fun`, 'Invalid conents');
        }).then(done, done);
    });

    test('With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(25, 6);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, contents: { language: string, value: string }[] }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '25,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '25,7', 'End position is incorrect');
            assert.equal(def[0].contents.length, 1, 'Invalid content items');
            const documentation = `bar()${EOL}${EOL}说明 - keep this line, it works${EOL}delete following line, it works${EOL}如果存在需要等待审批或正在执行的任务，将不刷新页面`;
            assert.equal(def[0].contents[0].value, documentation, 'Invalid conents');
        }).then(done, done);
    });

    test('Across files with Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 11);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then((def: [{ range: vscode.Range, contents: { language: string, value: string }[] }]) => {
            assert.equal(def.length, 1, 'Definition lenght is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '1,5', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '1,16', 'End position is incorrect');
            assert.equal(def[0].contents.length, 1, 'Invalid content items');
            const documentation = `showMessage()${EOL}${EOL}Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. ${EOL}Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.`;
            assert.equal(def[0].contents[0].value, documentation, 'Invalid conents');
        }).then(done, done);
    });
});