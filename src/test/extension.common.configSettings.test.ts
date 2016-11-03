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
import { PythonSettings } from '../client/common/configSettings';

const pythonSettings = PythonSettings.getInstance();

// Defines a Mocha test suite to group tests of similar kind together
suite('Configuration Settings', () => {
    setup(done => {
        initialize().then(() => done(), done);
    });
    test('Check Values', done => {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        Object.keys(pythonSettings).forEach(key => {
            const settingValue = pythonConfig.get(key, 'Not a config');
            if (settingValue === 'Not a config') {
                return;
            }
            assert.deepEqual(settingValue, pythonSettings[key], `Setting ${key} not the same`);
        });

        done();
    });
});