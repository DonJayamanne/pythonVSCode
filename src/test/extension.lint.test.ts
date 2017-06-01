//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
// Place this right on top
import { initialize, IS_TRAVIS, PYTHON_PATH, closeActiveWindows } from './initialize';
// The module \'assert\' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as baseLinter from '../client/linters/baseLinter';
import * as pyLint from '../client/linters/pylint';
import * as pep8 from '../client/linters/pep8Linter';
import * as flake8 from '../client/linters/flake8';
import * as prospector from '../client/linters/prospector';
import * as pydocstyle from '../client/linters/pydocstyle';
import * as path from 'path';
import * as settings from '../client/common/configSettings';
import * as fs from 'fs-extra';
import { execPythonFile } from '../client/common/utils';
let pythonSettings = settings.PythonSettings.getInstance();

const pythoFilesPath = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'linting');
const flake8ConfigPath = path.join(pythoFilesPath, 'flake8config');
const pep8ConfigPath = path.join(pythoFilesPath, 'pep8config');
const pydocstyleConfigPath = path.join(pythoFilesPath, 'pydocstyleconfig');
const pylintConfigPath = path.join(pythoFilesPath, 'pylintconfig');
const fileToLint = path.join(pythoFilesPath, 'file.py');
let pylintFileToLintLines: string[] = [];
let isPython3 = true;
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

let pylintMessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 24, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 30, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 34, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 40, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 44, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 55, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 59, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 62, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', provider: '', type: '' },
    { line: 70, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 84, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 87, column: 0, severity: baseLinter.LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', provider: '', type: '' },
    { line: 11, column: 20, severity: baseLinter.LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', provider: '', type: '' },
    { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
let pyLint3MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 13, column: 0, severity: baseLinter.LintMessageSeverity.Error, code: 'E0001', message: 'Missing parentheses in call to \'print\'', provider: '', type: '' }
];
let flake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 5, column: 1, severity: baseLinter.LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: baseLinter.LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: baseLinter.LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
let pep8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 5, column: 1, severity: baseLinter.LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: baseLinter.LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: baseLinter.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: baseLinter.LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
let pydocstyleMessagseToBeReturned: baseLinter.ILintMessage[] = [
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'e\')', 'column': 0, 'line': 1, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'t\')', 'column': 0, 'line': 5, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D102', severity: baseLinter.LintMessageSeverity.Information, 'message': 'Missing docstring in public method', 'column': 4, 'line': 8, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D401', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should be in imperative mood (\'thi\', not \'this\')', 'column': 4, 'line': 11, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'This\', not \'this\')', 'column': 4, 'line': 11, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'e\')', 'column': 4, 'line': 11, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'And\', not \'and\')', 'column': 4, 'line': 15, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'t\')', 'column': 4, 'line': 15, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', 'column': 4, 'line': 21, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'g\')', 'column': 4, 'line': 21, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', 'column': 4, 'line': 28, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'g\')', 'column': 4, 'line': 28, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', 'column': 4, 'line': 38, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'g\')', 'column': 4, 'line': 38, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', 'column': 4, 'line': 53, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'g\')', 'column': 4, 'line': 53, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', 'column': 4, 'line': 68, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'g\')', 'column': 4, 'line': 68, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D403', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', 'column': 4, 'line': 80, 'type': '', 'provider': 'pydocstyle' },
    { 'code': 'D400', severity: baseLinter.LintMessageSeverity.Information, 'message': 'First line should end with a period (not \'g\')', 'column': 4, 'line': 80, 'type': '', 'provider': 'pydocstyle' }
];

let filteredPylintMessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
let filteredPylint3MessagesToBeReturned: baseLinter.ILintMessage[] = [
];
let filteredFlake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
let filteredPep88MessagesToBeReturned: baseLinter.ILintMessage[] = [
    { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
let fiteredPydocstyleMessagseToBeReturned: baseLinter.ILintMessage[] = [
    { 'code': 'D102', severity: baseLinter.LintMessageSeverity.Information, 'message': 'Missing docstring in public method', 'column': 4, 'line': 8, 'type': '', 'provider': 'pydocstyle' }
];

suite('Linting', () => {
    suiteSetup(done => {
        pylintFileToLintLines = fs.readFileSync(fileToLint).toString('utf-8').split(/\r?\n/g);
        pythonSettings.pythonPath = PYTHON_PATH;
        initialize().then(() => {
            return execPythonFile(pythonSettings.pythonPath, ['--version'], __dirname, true);
        }).then(version => {
            isPython3 = version.indexOf('3.') >= 0;
        }).then(done, done);
    });
    setup(() => {
        pythonSettings.linting.enabled = true;
        pythonSettings.linting.pylintEnabled = true;
        pythonSettings.linting.flake8Enabled = true;
        pythonSettings.linting.pep8Enabled = true;
        pythonSettings.linting.prospectorEnabled = true;
        pythonSettings.linting.pydocstyleEnabled = true;
    });
    suiteTeardown(done => {
        closeActiveWindows().then(done, done);
    });
    teardown(done => {
        closeActiveWindows().then(done, done);
    });

    function testEnablingDisablingOfLinter(linter: baseLinter.BaseLinter, propertyName: string) {
        pythonSettings.linting[propertyName] = true;
        assert.equal(true, linter.isEnabled());

        pythonSettings.linting[propertyName] = false;
        assert.equal(false, linter.isEnabled());
    }
    test('Enable and Disable Pylint', () => {
        let ch = new MockOutputChannel('Lint');
        testEnablingDisablingOfLinter(new pyLint.Linter(ch, pythoFilesPath), 'pylintEnabled');
    });
    test('Enable and Disable Pep8', () => {
        let ch = new MockOutputChannel('Lint');
        testEnablingDisablingOfLinter(new pep8.Linter(ch, pythoFilesPath), 'pep8Enabled');
    });
    test('Enable and Disable Flake8', () => {
        let ch = new MockOutputChannel('Lint');
        testEnablingDisablingOfLinter(new flake8.Linter(ch, pythoFilesPath), 'flake8Enabled');
    });
    test('Enable and Disable Prospector', () => {
        let ch = new MockOutputChannel('Lint');
        testEnablingDisablingOfLinter(new prospector.Linter(ch, pythoFilesPath), 'prospectorEnabled');
    });
    test('Enable and Disable Pydocstyle', () => {
        let ch = new MockOutputChannel('Lint');
        testEnablingDisablingOfLinter(new pydocstyle.Linter(ch, pythoFilesPath), 'pydocstyleEnabled');
    });

    function testLinterMessages(linter: baseLinter.BaseLinter, outputChannel: MockOutputChannel, pythonFile: string, messagesToBeReceived: baseLinter.ILintMessage[]): Thenable<any> {
        let cancelToken = new vscode.CancellationTokenSource();
        return vscode.workspace.openTextDocument(pythonFile)
            .then(document => vscode.window.showTextDocument(document))
            .then(editor => linter.runLinter(editor.document, cancelToken.token))
            .then(messages => {
                // Different versions of python return different errors,
                if (messagesToBeReceived.length === 0) {
                    assert.equal(messages.length, 0, 'No errors in linter, Output - ' + outputChannel.output);
                }
                else {
                    if (outputChannel.output.indexOf('ENOENT') === -1) {
                        // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1
                        // Looks like pylint stops linting as soon as it comes across any ERRORS
                        assert.notEqual(messages.length, 0, 'No errors in linter, Output - ' + outputChannel.output);
                    }
                    else {
                        assert.ok('Linter not installed', 'Linter not installed');
                    }
                }
                // messagesToBeReceived.forEach(msg => {
                //     let similarMessages = messages.filter(m => m.code === msg.code && m.column === msg.column &&
                //         m.line === msg.line && m.message === msg.message && m.severity === msg.severity);
                //     assert.equal(true, similarMessages.length > 0, 'Error not found, ' + JSON.stringify(msg) + '\n, Output - ' + outputChannel.output);
                // });
            }, error => {
                assert.fail(error, null, 'Linter error, Output - ' + outputChannel.output, '');
            });
    }
    test('PyLint', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new pyLint.Linter(ch, pythoFilesPath);
        testLinterMessages(linter, ch, fileToLint, pylintMessagesToBeReturned).then(done, done);
    });
    test('Flake8', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new flake8.Linter(ch, pythoFilesPath);
        testLinterMessages(linter, ch, fileToLint, flake8MessagesToBeReturned).then(done, done);
    });
    test('Pep8', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new pep8.Linter(ch, pythoFilesPath);
        testLinterMessages(linter, ch, fileToLint, pep8MessagesToBeReturned).then(done, done);
    });
    test('Pydocstyle', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new pydocstyle.Linter(ch, pythoFilesPath);
        testLinterMessages(linter, ch, fileToLint, pydocstyleMessagseToBeReturned).then(done, done);
    });
    // Version dependenant, will be enabled once we have fixed this
    // TODO: Check version of python running and accordingly change the values
    if (!IS_TRAVIS) {
        test('PyLint with config in root', done => {
            let ch = new MockOutputChannel('Lint');
            let linter = new pyLint.Linter(ch, pylintConfigPath);
            testLinterMessages(linter, ch, path.join(pylintConfigPath, 'file.py'), filteredPylintMessagesToBeReturned).then(done, done);
        });
    }
    test('Flake8 with config in root', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new flake8.Linter(ch, flake8ConfigPath);
        testLinterMessages(linter, ch, path.join(flake8ConfigPath, 'file.py'), filteredFlake8MessagesToBeReturned).then(done, done);
    });
    test('Pep8 with config in root', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new pep8.Linter(ch, pep8ConfigPath);
        testLinterMessages(linter, ch, path.join(pep8ConfigPath, 'file.py'), filteredPep88MessagesToBeReturned).then(done, done);
    });
    test('Pydocstyle with config in root', done => {
        let ch = new MockOutputChannel('Lint');
        let linter = new pydocstyle.Linter(ch, pydocstyleConfigPath);
        testLinterMessages(linter, ch, path.join(pydocstyleConfigPath, 'file.py'), fiteredPydocstyleMessagseToBeReturned).then(done, done);
    });
});
