//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

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
import {initialize} from './initialize';
import {execPythonFile} from '../client/common/utils';

let pythonSettings = settings.PythonSettings.getInstance();
let ch = vscode.window.createOutputChannel('Lint');
let pythoFilesPath = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'linting');

let targetFlake8ConfigFile = path.join(__dirname, '.flake8');
let targetPep8ConfigFile = path.join(__dirname, '.pep8');
let targetPydocstyleConfigFile = path.join(__dirname, '.pydocstyle');
let pylintFileToLintLines: string[] = [];
let pyLintFileToLint = path.join(pythoFilesPath, 'pylintSample.py');
let targetPythonFileToLint = path.join(__dirname, 'pythonFiles', 'linting', path.basename(pyLintFileToLint));
let sourceFlake8ConfigFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'linting', 'pylintcfg', '.flake8');
let sourcePep8ConfigFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'linting', 'pylintcfg', '.pep8');
let sourcePydocstyleConfigFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'linting', 'pylintcfg', '.pydocstyle');

function deleteFile(file: string): Promise<any> {
    return new Promise<any>(resolve => {
        fs.exists(file, yes => {
            if (yes) {
                return fs.unlink(file, () => resolve());
            }
            resolve();
        });
    });
}
suiteSetup(done => {
    fs.copySync(pyLintFileToLint, targetPythonFileToLint);
    pylintFileToLintLines = fs.readFileSync(pyLintFileToLint).toString('utf-8').split(/\r?\n/g);
    done();
});
suiteTeardown(done => {
    // deleteFile(targetPythonFileToLint).then(done, done);
    done();
});

suite('Linting', () => {
    let pylintMessagesToBeReturned: baseLinter.ILintMessage[] = [
        { line: 17, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling unused-argument (W0613)', possibleWord: '', provider: '', type: '' },
        { line: 24, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 30, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 34, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 40, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 44, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 55, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 59, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 62, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', possibleWord: '', provider: '', type: '' },
        { line: 70, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 84, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', possibleWord: '', provider: '', type: '' },
        { line: 87, column: 0, severity: baseLinter.LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', possibleWord: '', provider: '', type: '' },
        { line: 1, column: 0, severity: baseLinter.LintMessageSeverity.Hint, code: 'C0103', message: 'Invalid module name \"pylintSample\"', possibleWord: '', provider: '', type: '' },
        { line: 11, column: 20, severity: baseLinter.LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', possibleWord: '', provider: '', type: '' },
        { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', possibleWord: '', provider: '', type: '' },
        { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' }
    ];
    let flake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
        { line: 5, column: 1, severity: baseLinter.LintMessageSeverity.Information, code: 'E302', message: 'expected 2 blank lines, found 1', possibleWord: '', provider: '', type: '' },
        { line: 13, column: 19, severity: baseLinter.LintMessageSeverity.Information, code: 'E901', message: 'SyntaxError: invalid syntax', possibleWord: '', provider: '', type: '' },
        { line: 19, column: 15, severity: baseLinter.LintMessageSeverity.Information, code: 'E127', message: 'continuation line over-indented for visual indent', possibleWord: '', provider: '', type: '' },
        { line: 24, column: 23, severity: baseLinter.LintMessageSeverity.Information, code: 'E261', message: 'at least two spaces before inline comment', possibleWord: '', provider: '', type: '' },
        { line: 62, column: 30, severity: baseLinter.LintMessageSeverity.Information, code: 'E261', message: 'at least two spaces before inline comment', possibleWord: '', provider: '', type: '' },
        { line: 70, column: 22, severity: baseLinter.LintMessageSeverity.Information, code: 'E261', message: 'at least two spaces before inline comment', possibleWord: '', provider: '', type: '' },
        { line: 80, column: 5, severity: baseLinter.LintMessageSeverity.Information, code: 'E303', message: 'too many blank lines (2)', possibleWord: '', provider: '', type: '' },
        { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Information, code: 'W292', message: 'no newline at end of file', possibleWord: '', provider: '', type: '' }
    ];
    let pep8MessagesToBeReturned: baseLinter.ILintMessage[] = [
        { line: 5, column: 1, severity: baseLinter.LintMessageSeverity.Information, code: 'E302', message: 'expected 2 blank lines, found 1', possibleWord: '', provider: '', type: '' },
        { line: 19, column: 15, severity: baseLinter.LintMessageSeverity.Information, code: 'E127', message: 'continuation line over-indented for visual indent', possibleWord: '', provider: '', type: '' },
        { line: 24, column: 23, severity: baseLinter.LintMessageSeverity.Information, code: 'E261', message: 'at least two spaces before inline comment', possibleWord: '', provider: '', type: '' },
        { line: 62, column: 30, severity: baseLinter.LintMessageSeverity.Information, code: 'E261', message: 'at least two spaces before inline comment', possibleWord: '', provider: '', type: '' },
        { line: 70, column: 22, severity: baseLinter.LintMessageSeverity.Information, code: 'E261', message: 'at least two spaces before inline comment', possibleWord: '', provider: '', type: '' },
        { line: 80, column: 5, severity: baseLinter.LintMessageSeverity.Information, code: 'E303', message: 'too many blank lines (2)', possibleWord: '', provider: '', type: '' },
        { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Information, code: 'W292', message: 'no newline at end of file', possibleWord: '', provider: '', type: '' }
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
        { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', possibleWord: '', provider: '', type: '' },
        { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' },
        { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', possibleWord: '', provider: '', type: '' }
    ];
    let filteredFlake8MessagesToBeReturned: baseLinter.ILintMessage[] = [
        { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Information, code: 'W292', message: 'no newline at end of file', possibleWord: '', provider: '', type: '' }
    ];
    let filteredPep88MessagesToBeReturned: baseLinter.ILintMessage[] = [
        { line: 87, column: 24, severity: baseLinter.LintMessageSeverity.Information, code: 'W292', message: 'no newline at end of file', possibleWord: '', provider: '', type: '' }
    ];
    let fiteredPydocstyleMessagseToBeReturned: baseLinter.ILintMessage[] = [
        { 'code': 'D102', severity: baseLinter.LintMessageSeverity.Information, 'message': 'Missing docstring in public method', 'column': 4, 'line': 8, 'type': '', 'provider': 'pydocstyle' }
    ];

    setup(done => {
        initialize().then(() => {
            pythonSettings.linting.enabled = true;
            pythonSettings.linting.pylintEnabled = true;
            pythonSettings.linting.flake8Enabled = true;
            pythonSettings.linting.pep8Enabled = true;
            pythonSettings.linting.prospectorEnabled = true;
            pythonSettings.linting.pydocstyleEnabled = true;
        }).then(done, done);
    });

    teardown(done => {
        Promise.all([deleteFile(targetFlake8ConfigFile),
            deleteFile(targetPep8ConfigFile),
            deleteFile(targetPydocstyleConfigFile)
        ]).then(() => done(), done);
    });

    function testEnablingDisablingOfLinter(linter: baseLinter.BaseLinter, propertyName: string) {
        pythonSettings.linting[propertyName] = true;
        assert.equal(true, linter.isEnabled());

        pythonSettings.linting[propertyName] = false;
        assert.equal(false, linter.isEnabled());
    }
    test('Enable and Disable Pylint', () => {
        testEnablingDisablingOfLinter(new pyLint.Linter(ch, __dirname), 'pylintEnabled');
    });
    test('Enable and Disable Pep8', () => {
        testEnablingDisablingOfLinter(new pep8.Linter(ch, __dirname), 'pep8Enabled');
    });
    test('Enable and Disable Flake8', () => {
        testEnablingDisablingOfLinter(new flake8.Linter(ch, __dirname), 'flake8Enabled');
    });
    test('Enable and Disable Prospector', () => {
        testEnablingDisablingOfLinter(new prospector.Linter(ch, __dirname), 'prospectorEnabled');
    });
    test('Enable and Disable Pydocstyle', () => {
        testEnablingDisablingOfLinter(new pydocstyle.Linter(ch, __dirname), 'pydocstyleEnabled');
    });

    function testLinterMessages(linter: baseLinter.BaseLinter, pythonFile: string, pythonFileLines: string[], messagesToBeReceived: baseLinter.ILintMessage[]): Promise<any> {
        return linter.runLinter(pythonFile, pythonFileLines).then(messages => {
            // Different versions of python return different errors, 
            // Here we have errors for version 2.7
            assert.notEqual(messages.length, 0, 'No errors in linter');
            messagesToBeReceived.forEach(msg => {
                let similarMessages = messages.filter(m => m.code === msg.code && m.column === msg.column &&
                    m.line === msg.line && m.message === msg.message && m.severity === msg.severity);
                assert.equal(true, similarMessages.length > 0, 'Error not found, ' + JSON.stringify(msg));
            });
        }, error => {
            assert.fail(error, null, 'Linter error');
        });
    }
    test('PyLint', done => {
        let linter = new pyLint.Linter(ch, __dirname);
        return testLinterMessages(linter, pyLintFileToLint, pylintFileToLintLines, pylintMessagesToBeReturned).then(done, done);
    });
    test('Flake8', done => {
        let linter = new flake8.Linter(ch, __dirname);
        return testLinterMessages(linter, pyLintFileToLint, pylintFileToLintLines, flake8MessagesToBeReturned).then(done, done);
    });
    test('Pep8', done => {
        let linter = new pep8.Linter(ch, __dirname);
        return testLinterMessages(linter, pyLintFileToLint, pylintFileToLintLines, pep8MessagesToBeReturned).then(done, done);
    });
    test('Pydocstyle', done => {
        let linter = new pydocstyle.Linter(ch, __dirname);
        return testLinterMessages(linter, pyLintFileToLint, pylintFileToLintLines, pydocstyleMessagseToBeReturned).then(done, done);
    });
    test('PyLint with config in root', done => {
        let rootDirContainingConfig = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'linting', 'pylintcfg');
        let linter = new pyLint.Linter(ch, rootDirContainingConfig);
        return testLinterMessages(linter, pyLintFileToLint, pylintFileToLintLines, filteredPylintMessagesToBeReturned).then(done, done);
    });
    test('Flake8 with config in root', done => {
        fs.copySync(sourceFlake8ConfigFile, targetFlake8ConfigFile);
        let linter = new flake8.Linter(ch, __dirname);
        return testLinterMessages(linter, targetPythonFileToLint, pylintFileToLintLines, filteredFlake8MessagesToBeReturned).then(done, done);
    });
    test('Pep8 with config in root', done => {
        fs.copySync(sourcePep8ConfigFile, targetPep8ConfigFile);
        let linter = new pep8.Linter(ch, __dirname);
        return testLinterMessages(linter, targetPythonFileToLint, pylintFileToLintLines, filteredPep88MessagesToBeReturned).then(done, done);
    });
    test('Pydocstyle with config in root', done => {
        fs.copySync(sourcePydocstyleConfigFile, targetPydocstyleConfigFile);
        let linter = new pydocstyle.Linter(ch, __dirname);
        return testLinterMessages(linter, targetPythonFileToLint, pylintFileToLintLines, fiteredPydocstyleMessagseToBeReturned).then(done, done);
    });
});