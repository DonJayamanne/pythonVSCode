import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../client/common/configSettings';
import * as fs from 'fs-extra';
import {initialize} from './initialize';
import {execPythonFile} from '../client/common/utils';
import {extractVariable, extractMethod} from '../client/providers/simpleRefactorProvider';

let EXTENSION_DIR = path.join(__dirname, '..', '..');
let pythonSettings = settings.PythonSettings.getInstance();

const refactorSourceFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFile = path.join(__dirname, '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
let isPython3 = true;
console.log('ExtractXABC');
class MockOutputChannel implements vscode.OutputChannel {
    constructor(name: string) {
        this.name = name;
        this.output = '';
    }
    name: string;
    output: string;
    append(value: string) {
        this.output += value;
    }
    appendLine(value: string) { this.append(value); this.append('\n'); }
    clear() { }
    show(preservceFocus?: boolean): void;
    show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    show(x?: any, y?: any): void { }
    hide() { }
    dispose() { }
}
suiteSetup(done => {
    console.log('Extract00000000');
    fs.copySync(refactorSourceFile, refactorTargetFile, { clobber: true });
    console.log('ExtractXX');
    initialize().then(() => {
        console.log('ExtractXY');
        new Promise<string>(resolve => {
            // Support for travis
            let version = process.env['TRAVIS_PYTHON_VERSION'];
            if (typeof version === 'string') {
                return resolve(version);
            }
            // Support for local tests
            execPythonFile('python', ['--version'], __dirname, true).then(resolve);
        }).then(version => {
            isPython3 = version.indexOf('3.') >= 0;
            console.log('ExtractXYZ');
            done();
        });
    });
});
suiteTeardown(done => {
    // deleteFile(targetPythonFileToLint).then(done, done);
    done();
});

suite('Simple Refactor', () => {
    console.log('Extract0000000');
    setup(() => {
        console.log('Extract00');
        if (fs.existsSync(refactorTargetFile)) {
            fs.unlinkSync(refactorTargetFile);
        }
        fs.copySync(refactorSourceFile, refactorTargetFile, { clobber: true });
        pythonSettings.python2Path = '/Users/donjayamanne/Desktop/Development/Python/Temp/MyEnvs/p3/bin/python'
        pythonSettings.pythonPath = '/Users/donjayamanne/Desktop/Development/Python/Temp/MyEnvs/p3/bin/python'
        console.log('Extract000');
    });
    teardown(() => {
        console.log('Extract0000');
        if (vscode.window.activeTextEditor) {
            return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
        console.log('Extract00000');
    });

    test('Extract Variable', () => {
        console.log('Extract0');
        let ch = new MockOutputChannel('Python');
        let textDocument: vscode.TextDocument;
        let textEditor: vscode.TextEditor;
        let rangeOfTextToExtract = new vscode.Range(new vscode.Position(234, 29), new vscode.Position(234, 38));
        console.log('Extract1');

        return vscode.workspace.openTextDocument(refactorTargetFile).then(document => {
            textDocument = document;
            console.log('Extract2');
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            console.log('Extract3');
            editor.selections = [new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end)];
            editor.selection = new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end);
            textEditor = editor;
            console.log('Extract4');
            return;
        }).then(() => {
            console.log('Extract5');
            return extractVariable(EXTENSION_DIR, textEditor, rangeOfTextToExtract, ch, path.dirname(refactorTargetFile), false).then(() => {
                console.log('Extract6');
                assert.equal(textDocument.lineAt(234).text.trim().indexOf('newvariable'), 0, 'New Variable not created');
                assert.equal(textDocument.lineAt(234).text.trim().endsWith('= "STARTED"'), true, 'Started Text Assigned to variable');
                assert.equal(textDocument.lineAt(235).text.indexOf('(newvariable') >= 0, true, 'New Variable not being used');
                console.log('Extract7');
            }).catch(error => {
                console.log('Extract8');
                assert.fail(error, null, 'Variable extraction failed\n' + ch.output);
            });
        }, error => {
            console.log('Extract9');
            assert.fail(error, null, 'error!?');
        });
    });
});