'use strict';
import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/installer';
import { TestConfigurationManager } from './common/testConfigurationManager';
import * as nose from './nosetest/testConfigurationManager';
import * as pytest from './pytest/testConfigurationManager';
import * as unittest from './unittest/testConfigurationManager';
import { getSubDirectories } from '../common/utils';
import * as path from 'path';

const settings = PythonSettings.getInstance();

function promptToEnableAndConfigureTestFramework(outputChannel: vscode.OutputChannel, messageToDisplay: string = 'Select a test framework/tool to enable', enableOnly: boolean = false): Thenable<any> {
    const items = [{
        label: 'unittest',
        product: Product.unittest,
        description: 'Standard Python test framework',
        detail: 'https://docs.python.org/2/library/unittest.html'
    },
    {
        label: 'pytest',
        product: Product.pytest,
        description: 'Can run unittest (including trial) and nose test suites out of the box',
        detail: 'http://docs.pytest.org/en/latest/'
    },
    {
        label: 'nose',
        product: Product.nosetest,
        description: 'nose framework',
        detail: 'https://docs.python.org/2/library/unittest.html'
    }];
    const options = {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: messageToDisplay
    };
    return vscode.window.showQuickPick(items, options).then(item => {
        if (!item) {
            return Promise.reject(null);
        }
        let configMgr: TestConfigurationManager;
        switch (item.product) {
            case Product.unittest: {
                configMgr = new unittest.ConfigurationManager(outputChannel);
                break;
            }
            case Product.pytest: {
                configMgr = new pytest.ConfigurationManager(outputChannel);
                break;
            }
            case Product.nosetest: {
                configMgr = new nose.ConfigurationManager(outputChannel);
                break;
            }
            default: {
                throw new Error('Invalid test configuration');
            }
        }

        if (enableOnly) {
            // Ensure others are disabled
            if (item.product !== Product.unittest) {
                (new unittest.ConfigurationManager(outputChannel)).disable();
            }
            if (item.product !== Product.pytest) {
                (new pytest.ConfigurationManager(outputChannel)).disable();
            }
            if (item.product !== Product.nosetest) {
                (new nose.ConfigurationManager(outputChannel)).disable();
            }
            return configMgr.enable();
        }

        // Configure everything before enabling
        // Cuz we don't want the test engine (in main.ts file - tests get discovered when config changes are detected) 
        // to start discovering tests when tests haven't been configured properly
        function enableTest(): Thenable<any> {
            const pythonConfig = vscode.workspace.getConfiguration('python');
            if (settings.unitTest.promptToConfigure) {
                return configMgr.enable();
            }
            return pythonConfig.update('unitTest.promptToConfigure', undefined).then(() => {
                return configMgr.enable();
            }, reason => {
                return configMgr.enable().then(() => Promise.reject(reason));
            });
        }
        return configMgr.configure(vscode.workspace.rootPath).then(() => {
            return enableTest();
        }).catch(reason => {
            return enableTest().then(() => Promise.reject(reason));
        });
    });
}
export function displayTestFrameworkError(outputChannel: vscode.OutputChannel): Thenable<any> {
    let enabledCount = settings.unitTest.pyTestEnabled ? 1 : 0;
    enabledCount += settings.unitTest.nosetestsEnabled ? 1 : 0;
    enabledCount += settings.unitTest.unittestEnabled ? 1 : 0;
    if (enabledCount > 1) {
        return promptToEnableAndConfigureTestFramework(outputChannel, 'Enable only one of the test frameworks (unittest, pytest or nosetest).', true);
    }
    else {
        const option = 'Enable and configure a Test Framework';
        return vscode.window.showInformationMessage('No test framework configured (unittest, pytest or nosetest)', option).then(item => {
            if (item === option) {
                return promptToEnableAndConfigureTestFramework(outputChannel);
            }
            return Promise.reject(null);
        });
    }
}
export function displayPromptToEnableTests(rootDir: string, outputChannel: vscode.OutputChannel): Thenable<any> {
    if (settings.unitTest.pyTestEnabled ||
        settings.unitTest.nosetestsEnabled ||
        settings.unitTest.unittestEnabled) {
        return Promise.reject(null);
    }

    if (!settings.unitTest.promptToConfigure) {
        return Promise.reject(null);
    }

    const yes = 'Yes';
    const no = `Later`;
    const noNotAgain = `No, don't ask again`;

    return checkIfHasTestDirs(rootDir).then(hasTests => {
        if (!hasTests) {
            return Promise.reject(null);
        }
        return vscode.window.showInformationMessage('You seem to have tests, would you like to enable a test framework?', yes, no, noNotAgain).then(item => {
            if (!item || item === no) {
                return Promise.reject(null);
            }
            if (item === yes) {
                return promptToEnableAndConfigureTestFramework(outputChannel);
            }
            else {
                const pythonConfig = vscode.workspace.getConfiguration('python');
                return pythonConfig.update('unitTest.promptToConfigure', false);
            }
        });
    });
}
function checkIfHasTestDirs(rootDir: string): Promise<boolean> {
    return getSubDirectories(rootDir).then(subDirs => {
        return subDirs.map(dir => path.relative(rootDir, dir)).filter(dir => dir.match(/test/i)).length > 0;
    });
}