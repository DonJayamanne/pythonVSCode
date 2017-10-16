//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import { initialize, IS_MULTI_ROOT_TEST, IS_TRAVIS } from './../initialize';
import { PythonSettings } from '../../client/common/configSettings';
import { SystemVariables } from '../../client/common/systemVariables';
import { rootWorkspaceUri } from '../common';

const workspaceRoot = path.join(__dirname, '..', '..', '..', 'src', 'test');

// Defines a Mocha test suite to group tests of similar kind together
suite('Configuration Settings', () => {
    setup(() => initialize());

    if (!IS_MULTI_ROOT_TEST) {
        test('Check Values', done => {
            const systemVariables: SystemVariables = new SystemVariables(workspaceRoot);
            const pythonConfig = vscode.workspace.getConfiguration('python');
            const pythonSettings = PythonSettings.getInstance(vscode.Uri.file(workspaceRoot));
            Object.keys(pythonSettings).forEach(key => {
                let settingValue = pythonConfig.get(key, 'Not a config');
                if (settingValue === 'Not a config') {
                    return;
                }
                if (settingValue) {
                    settingValue = systemVariables.resolve(settingValue);
                }
                assert.deepEqual(settingValue, (pythonSettings as any)[key], `Setting ${key} not the same`);
            });

            done();
        });
    }
});
