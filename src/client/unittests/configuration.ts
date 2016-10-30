'use strict';
import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/installer';
import { TestConfigurationManager } from './common/testConfigurationManager';
import * as nose from './nosetest/testConfigurationManager';
import * as pytest from './pytest/testConfigurationManager';
import * as unittest from './unittest/testConfigurationManager';
import { createDeferred } from '../common/helpers';

const settings = PythonSettings.getInstance();

function promptToEnableAndConfigureTestFramework(messageToDisplay: string = 'Select a test framework/tool to enable', enableOnly: boolean = false): Thenable<any> {
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
                configMgr = new unittest.ConfigurationManager();
                break;
            }
            case Product.pytest: {
                configMgr = new pytest.ConfigurationManager();
                break;
            }
            case Product.nosetest: {
                configMgr = new nose.ConfigurationManager();
                break;
            }
            default: {
                throw new Error('Invalid test configuration');
            }
        }

        configMgr.enable();
        if (enableOnly) {
            // Ensure others are disabled
            if (item.product !== Product.unittest) {
                (new unittest.ConfigurationManager()).disable();
            }
            if (item.product !== Product.pytest) {
                (new pytest.ConfigurationManager()).disable();
            }
            if (item.product !== Product.nosetest) {
                (new nose.ConfigurationManager()).disable();
            }
            return Promise.resolve();
        }
        return configMgr.configure(vscode.workspace.rootPath);
    });
}
export function displayTestFrameworkError(): Thenable<any> {
    let enabledCount = settings.unitTest.pyTestEnabled ? 1 : 0;
    enabledCount += settings.unitTest.nosetestsEnabled ? 1 : 0;
    enabledCount += settings.unitTest.unittestEnabled ? 1 : 0;
    if (enabledCount > 1) {
        return promptToEnableAndConfigureTestFramework('Enable only one of the test frameworks (unittest, pytest or nosetest).', true);
    }
    else {
        const option = 'Enable and configure a Test Framework';
        return vscode.window.showInformationMessage('No test framework configured (unittest, pytest or nosetest)', option).then(item => {
            if (item === option) {
                return promptToEnableAndConfigureTestFramework();
            }
            return Promise.reject(null);
        });
    }
}