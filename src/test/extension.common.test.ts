//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// Place this right on top
import { initialize } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { execPythonFile } from '../client/common/utils';

// Defines a Mocha test suite to group tests of similar kind together
suite('ChildProc', () => {
    setup(done => {
        initialize().then(() => done(), done);
    });
    test('Standard Response', done => {
        execPythonFile('python', ['-c', 'print(1)'], __dirname, false).then(data => {
            assert.ok(data === '1\n');
        }).then(done, done);
    });
    test('Error Response', done => {
        execPythonFile('python', ['-c', 'print(1'], __dirname, false).then(data => {
            assert.ok(false);
            done();
        }).catch(() => {
            assert.ok(true);
            done();
        });
    });
});