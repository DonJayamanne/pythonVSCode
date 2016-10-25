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
import { execPythonFile } from '../client/common/utils';
import { EOL } from 'os';
import { createDeferred } from '../client/common/helpers';
import * as vscode from 'vscode';

// Defines a Mocha test suite to group tests of similar kind together
suite('ChildProc', () => {
    setup(done => {
        initialize().then(() => done(), done);
    });
    test('Standard Response', done => {
        execPythonFile('python', ['-c', 'print(1)'], __dirname, false).then(data => {
            assert.ok(data === '1' + EOL);
        }).then(done, done);
    });
    test('Error Response', done => {
        const def = createDeferred<any>();
        execPythonFile('python', ['-c', 'print(1'], __dirname, false).then(() => {
            def.reject('Should have failed');
        }).catch(() => {
            def.resolve();
        });

        def.promise.then(done).catch(done);
    });

    test('Stream Stdout', done => {
        const output: string[] = [];
        function handleOutput(data: string) {
            output.push(data);
        }
        execPythonFile('python', ['-c', 'print(1)'], __dirname, false, handleOutput).then(() => {
            assert.equal(output.length, 1, 'Ouput length incorrect');
            assert.equal(output[0], '1' + EOL, 'Ouput value incorrect');
        }).then(done, done);
    });

    test('Stream Stdout with Threads', done => {
        const output: string[] = [];
        function handleOutput(data: string) {
            output.push(data);
        }
        execPythonFile('python', ['-c', 'import sys\nprint(1)\nsys.__stdout__.flush()\nimport time\ntime.sleep(5)\nprint(2)'], __dirname, false, handleOutput).then(() => {
            assert.equal(output.length, 2, 'Ouput length incorrect');
            assert.equal(output[0], '1' + EOL, 'First Ouput value incorrect');
            assert.equal(output[1], '2' + EOL, 'Second Ouput value incorrect');
        }).then(done, done);
    });

    test('Kill', done => {
        const def = createDeferred<any>();
        const output: string[] = [];
        function handleOutput(data: string) {
            output.push(data);
        }
        const cancellation = new vscode.CancellationTokenSource();
        execPythonFile('python', ['-c', 'import sys\nprint(1)\nsys.__stdout__.flush()\nimport time\ntime.sleep(5)\nprint(2)'], __dirname, false, handleOutput, cancellation.token).then(() => {
            def.reject('Should not have completed');
        }).catch(()=>{
            def.resolve();
        });

        setTimeout(() => {
            cancellation.cancel();
        }, 1000);

        def.promise.then(done).catch(done);
    });
});