// //
// // Note: This example test is leveraging the Mocha test framework.
// // Please refer to their documentation on https://mochajs.org/ for help.
// // Place this right on top
// import { initialize, IS_TRAVIS, closeActiveWindows, setPythonExecutable } from '../initialize';
// // The module \'assert\' provides assertion methods from node
// import * as assert from 'assert';

// // You can import and use all API from the \'vscode\' module
// // as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as baseLinter from '../../client/linters/baseLinter';
// import * as pyLint from '../../client/linters/pylint';
// import * as pep8 from '../../client/linters/pep8Linter';
// import * as flake8 from '../../client/linters/flake8';
// import * as prospector from '../../client/linters/prospector';
// import * as pydocstyle from '../../client/linters/pydocstyle';
// import * as path from 'path';
// import * as settings from '../../client/common/configSettings';
// import * as fs from 'fs-extra';
// import { execPythonFile } from '../../client/common/utils';
// import { createDeferred } from '../../client/common/helpers';
// import { Product, disableLinter, SettingToDisableProduct, Linters } from '../../client/common/installer';
// import { EnumEx } from '../../client/common/enumUtils';
// import { MockOutputChannel } from '../mockClasses';
// let pythonSettings = settings.PythonSettings.getInstance();
// let disposable = setPythonExecutable(pythonSettings);

// const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');
// const flake8ConfigPath = path.join(pythoFilesPath, 'flake8config');
// const pep8ConfigPath = path.join(pythoFilesPath, 'pep8config');
// const pydocstyleConfigPath27 = path.join(pythoFilesPath, 'pydocstyleconfig27');
// const pylintConfigPath = path.join(pythoFilesPath, 'pylintconfig');
// const fileToLint = path.join(pythoFilesPath, 'file.py');
// let pylintFileToLintLines: string[] = [];

// suite('Interpreters', () => {
//     const isPython3Deferred = createDeferred<boolean>();
//     const isPython3 = isPython3Deferred.promise;
//     suiteSetup(done => {
//         pythonSettings.pythonPath = PYTHON_PATH;
//         initialize().then(() => {
//             return execPythonFile(pythonSettings.pythonPath, ['--version'], __dirname, true);
//         }).then(version => {
//             isPython3Deferred.resolve(version.indexOf('3.') >= 0);
//         }).then(done, done);
//     });
//     setup(() => {
//         pythonSettings.linting.lintOnSave = false;
//         pythonSettings.linting.lintOnTextChange = false;
//         pythonSettings.linting.enabled = true;
//         pythonSettings.linting.pylintEnabled = true;
//         pythonSettings.linting.flake8Enabled = true;
//         pythonSettings.linting.pep8Enabled = true;
//         pythonSettings.linting.prospectorEnabled = true;
//         pythonSettings.linting.pydocstyleEnabled = true;
//     });
//     suiteTeardown(done => {
//         if (disposable) { disposable.dispose() };
//         closeActiveWindows().then(() => done(), () => done());
//     });
//     teardown(done => {
//         closeActiveWindows().then(() => done(), () => done());
//     });

//     function testEnablingDisablingOfLinter(linter: baseLinter.BaseLinter, propertyName: string) {
//         pythonSettings.linting[propertyName] = true;
//         assert.equal(true, linter.isEnabled());

//         pythonSettings.linting[propertyName] = false;
//         assert.equal(false, linter.isEnabled());
//     }
//     test('Enable and Disable Pylint', () => {
//         let ch = new MockOutputChannel('Lint');
//         testEnablingDisablingOfLinter(new pyLint.Linter(ch, pythoFilesPath), 'pylintEnabled');
//     });
//     test('Enable and Disable Pep8', () => {
//         let ch = new MockOutputChannel('Lint');
//         testEnablingDisablingOfLinter(new pep8.Linter(ch, pythoFilesPath), 'pep8Enabled');
//     });
//     test('Enable and Disable Flake8', () => {
//         let ch = new MockOutputChannel('Lint');
//         testEnablingDisablingOfLinter(new flake8.Linter(ch, pythoFilesPath), 'flake8Enabled');
//     });
//     test('Enable and Disable Prospector', () => {
//         let ch = new MockOutputChannel('Lint');
//         testEnablingDisablingOfLinter(new prospector.Linter(ch, pythoFilesPath), 'prospectorEnabled');
//     });
//     test('Enable and Disable Pydocstyle', () => {
//         let ch = new MockOutputChannel('Lint');
//         testEnablingDisablingOfLinter(new pydocstyle.Linter(ch, pythoFilesPath), 'pydocstyleEnabled');
//     });

//     function disableAllButThisLinter(linterToEnable: Product) {
//         EnumEx.getNamesAndValues(Product).map(linter => {
//             if (Linters.indexOf(linter.value) === -1) {
//                 return;
//             }
//             var setting = path.extname(SettingToDisableProduct.get(linter.value)).substring(1);
//             pythonSettings.linting[setting] = linterToEnable === linter.value;
//         });
//     }
//     function testLinterMessages(linter: baseLinter.BaseLinter, outputChannel: MockOutputChannel, pythonFile: string, messagesToBeReceived: baseLinter.ILintMessage[]): Thenable<any> {

//         let cancelToken = new vscode.CancellationTokenSource();
//         disableAllButThisLinter(linter.product);
//         return vscode.workspace.openTextDocument(pythonFile)
//             .then(document => vscode.window.showTextDocument(document))
//             .then(editor => {
//                 return linter.runLinter(editor.document, cancelToken.token);
//             })
//             .then(messages => {
//                 // Different versions of python return different errors,
//                 if (messagesToBeReceived.length === 0) {
//                     assert.equal(messages.length, 0, 'No errors in linter, Output - ' + outputChannel.output);
//                 }
//                 else {
//                     if (outputChannel.output.indexOf('ENOENT') === -1) {
//                         // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1
//                         // Looks like pylint stops linting as soon as it comes across any ERRORS
//                         assert.notEqual(messages.length, 0, 'No errors in linter, Output - ' + outputChannel.output);
//                     }
//                     else {
//                         assert.ok('Linter not installed', 'Linter not installed');
//                     }
//                 }
//                 // messagesToBeReceived.forEach(msg => {
//                 //     let similarMessages = messages.filter(m => m.code === msg.code && m.column === msg.column &&
//                 //         m.line === msg.line && m.message === msg.message && m.severity === msg.severity);
//                 //     assert.equal(true, similarMessages.length > 0, 'Error not found, ' + JSON.stringify(msg) + '\n, Output - ' + outputChannel.output);
//                 // });
//             }, error => {
//                 assert.fail(error, null, 'Linter error, Output - ' + outputChannel.output, '');
//             });
//     }
//     test('PyLint', done => {
//         let ch = new MockOutputChannel('Lint');
//         let linter = new pyLint.Linter(ch, pythoFilesPath);
//         testLinterMessages(linter, ch, fileToLint, pylintMessagesToBeReturned).then(done, done);
//     });
//     test('Flake8', done => {
//         let ch = new MockOutputChannel('Lint');
//         let linter = new flake8.Linter(ch, pythoFilesPath);
//         testLinterMessages(linter, ch, fileToLint, flake8MessagesToBeReturned).then(done, done);
//     });
//     test('Pep8', done => {
//         let ch = new MockOutputChannel('Lint');
//         let linter = new pep8.Linter(ch, pythoFilesPath);
//         testLinterMessages(linter, ch, fileToLint, pep8MessagesToBeReturned).then(done, done);
//     });
//     if (!isPython3) {
//         test('Pydocstyle', done => {
//             let ch = new MockOutputChannel('Lint');
//             let linter = new pydocstyle.Linter(ch, pythoFilesPath);
//             testLinterMessages(linter, ch, fileToLint, pydocstyleMessagseToBeReturned).then(done, done);
//         });
//     }
//     // Version dependenant, will be enabled once we have fixed this
//     // TODO: Check version of python running and accordingly change the values
//     if (!IS_TRAVIS) {
//         isPython3.then(value => {
//             const messagesToBeReturned = value ? filteredPylint3MessagesToBeReturned : filteredPylintMessagesToBeReturned;
//             test('PyLint with config in root', done => {
//                 let ch = new MockOutputChannel('Lint');
//                 let linter = new pyLint.Linter(ch, pylintConfigPath);
//                 testLinterMessages(linter, ch, path.join(pylintConfigPath, 'file.py'), messagesToBeReturned).then(done, done);
//             });
//         });
//     }
//     test('Flake8 with config in root', done => {
//         let ch = new MockOutputChannel('Lint');
//         let linter = new flake8.Linter(ch, flake8ConfigPath);
//         testLinterMessages(linter, ch, path.join(flake8ConfigPath, 'file.py'), filteredFlake8MessagesToBeReturned).then(done, done);
//     });
//     test('Pep8 with config in root', done => {
//         let ch = new MockOutputChannel('Lint');
//         let linter = new pep8.Linter(ch, pep8ConfigPath);
//         testLinterMessages(linter, ch, path.join(pep8ConfigPath, 'file.py'), filteredPep88MessagesToBeReturned).then(done, done);
//     });
//     isPython3.then(value => {
//         const messagesToBeReturned = value ? [] : fiteredPydocstyleMessagseToBeReturned;
//         test('Pydocstyle with config in root', done => {
//             let ch = new MockOutputChannel('Lint');
//             let linter = new pydocstyle.Linter(ch, pydocstyleConfigPath27);
//             testLinterMessages(linter, ch, path.join(pydocstyleConfigPath27, 'file.py'), messagesToBeReturned).then(done, done);
//         });
//     });
// });
