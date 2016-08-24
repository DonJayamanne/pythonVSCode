'use strict';
import * as vscode from 'vscode';
import {Tests, TestsToRun, TestFolder, TestFile, TestStatus, TestSuite, TestFunction, FlattenedTestFunction, CANCELLATION_REASON} from './common/contracts';
import * as nosetests from './nosetest/main';
import * as pytest from './pytest/main';
import {resolveValueAsTestToRun} from './common/testUtils';
import {BaseTestManager} from './common/baseTestManager';
import {PythonSettings, IUnitTestSettings} from '../common/configSettings';
import {TestResultDisplay} from './display/main';
import {TestFileCodeLensProvider} from './testFileCodeLensProvider';
import {TestDisplay} from './display/picker';
import * as fs from 'fs';
import * as path from 'path';
import * as constants from '../common/constants';

const settings = PythonSettings.getInstance();
let testManager: BaseTestManager;
let pyTestManager: pytest.TestManager;
let nosetestManager: nosetests.TestManager;
let testResultDisplay: TestResultDisplay;
let testDisplay: TestDisplay;
let outChannel: vscode.OutputChannel;
let lastRanTests: TestsToRun = null;

export function activate(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    context.subscriptions.push({ dispose: dispose });
    outChannel = outputChannel;
    let disposables = registerCommands();
    context.subscriptions.push(...disposables);
    // Ignore the exceptions returned
    // This function is invoked via a command which will be invoked else where in the extension
    discoverTests(true, true).catch(() => {
        // Ignore the errors
        let x = '';
    });
    settings.addListener('change', onConfigChanged);
}
function dispose() {
    if (pyTestManager) {
        pyTestManager.dispose();
    }
    if (nosetestManager) {
        nosetestManager.dispose();
    }
}
function registerCommands(): vscode.Disposable[] {
    const disposables = [];
    disposables.push(vscode.commands.registerCommand(constants.Command_Tests_Discover, (quiteMode: boolean) => {
        // Ignore the exceptions returned
        // This command will be invoked else where in the extension
        discoverTests(true, quiteMode).catch(() => { return null; });
    }));
    disposables.push(vscode.commands.registerCommand(constants.Command_Tests_Run_Failed, () => runTestsImpl(true)));
    disposables.push(vscode.commands.registerCommand(constants.Command_Tests_Run, (testId) => runTestsImpl(testId)));
    disposables.push(vscode.commands.registerCommand(constants.Command_Tests_View_UI, () => displayUI()));
    disposables.push(vscode.commands.registerCommand(constants.Command_Tests_Stop, () => stopTests()));
    disposables.push(vscode.commands.registerCommand(constants.Command_Tests_ViewOutput, () => outChannel.show()));

    return disposables;
}

function displayUI() {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayTestUI();
}

let uniTestSettingsString = JSON.stringify(settings.unitTest);

function onConfigChanged() {
    // Possible that a test framework has been enabled or some settings have changed
    // Meaning we need to re-load the discovered tests (as something could have changed)
    const newSettings = JSON.stringify(settings.unitTest);
    if (uniTestSettingsString === newSettings) {
        return;
    }

    uniTestSettingsString = newSettings;
    if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled) {
        if (testResultDisplay) {
            testResultDisplay.enabled = false;
        }

        if (testManager) {
            testManager.stop();
            testManager = null;
        }
        if (pyTestManager) {
            pyTestManager.dispose();
            pyTestManager = null;
        }
        if (nosetestManager) {
            nosetestManager.dispose();
            nosetestManager = null;
        }
        return;
    }

    if (testResultDisplay) {
        testResultDisplay.enabled = true;
    }

    // No need to display errors
    discoverTests(true, true);
}
function displayTestFrameworkError() {
    if (settings.unitTest.pyTestEnabled && settings.unitTest.nosetestsEnabled) {
        vscode.window.showErrorMessage("Enable only one of the test frameworks (nosetest or pytest), not both.")
    }
    else {
        vscode.window.showInformationMessage('Please enable one of the test frameworks (pytest or nosetest)');
    }
    return null;
}
function getTestRunner() {
    if (settings.unitTest.pyTestEnabled && settings.unitTest.nosetestsEnabled) {
        return null;
    }
    else if (settings.unitTest.nosetestsEnabled) {
        return nosetestManager = nosetestManager ? nosetestManager : new nosetests.TestManager(vscode.workspace.rootPath, outChannel);
    }
    if (settings.unitTest.pyTestEnabled) {
        return pyTestManager = pyTestManager ? pyTestManager : new pytest.TestManager(vscode.workspace.rootPath, outChannel);
    }
    else if (settings.unitTest.nosetestsEnabled) {
        return nosetestManager = nosetestManager ? nosetestManager : new nosetests.TestManager(vscode.workspace.rootPath, outChannel);
    }
}

function stopTests() {
    let testManager = getTestRunner();
    if (testManager) {
        testManager.stop();
    }
}
function discoverTests(ignoreCache?: boolean, quietMode: boolean = false) {
    let testManager = getTestRunner();
    if (!testManager) {
        if (!quietMode) {
            displayTestFrameworkError();
        }
        return Promise.resolve(null);
    }

    if (testManager && (testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
        testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);
        return testResultDisplay.DisplayDiscoverStatus(testManager.discoverTests(ignoreCache, quietMode), quietMode);
    }
    else {
        return Promise.resolve(null);
    }
}
function isTestsToRun(arg: any): arg is TestsToRun {
    return arg && arg.testFunction && Array.isArray(arg.testFunction);
}
function isUri(arg: any): arg is vscode.Uri {
    return arg && arg.fsPath && typeof arg.fsPath === 'string';
}
function isFlattenedTestFunction(arg: any): arg is FlattenedTestFunction {
    return arg && arg.testFunction && arg.xmlClassName && arg.parentTestFile &&
        typeof arg.testFunction.name === 'string';
}
function identifyTestType(arg?: vscode.Uri | TestsToRun | boolean | FlattenedTestFunction): TestsToRun | Boolean {
    if (typeof arg === 'boolean') {
        return arg === true;
    }
    if (isTestsToRun(arg)) {
        return arg;
    }
    if (isFlattenedTestFunction(arg)) {
        return <TestsToRun>{ testFunction: [arg.testFunction] };
    }
    if (isUri(arg)) {
        return resolveValueAsTestToRun(path.relative(vscode.workspace.rootPath, arg.fsPath));
    }
    return null;
}
function runTestsImpl(arg?: vscode.Uri | TestsToRun | boolean | FlattenedTestFunction) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }

    // lastRanTests = testsToRun;
    let runInfo = identifyTestType(arg);

    testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);
    outChannel.appendLine('\n');

    let runPromise = testManager.runTest(runInfo).catch(reason => {
        if (reason !== CANCELLATION_REASON) {
            outChannel.appendLine('Error: ' + reason);
        }
        return Promise.reject(reason);
    });

    testResultDisplay.DisplayProgressStatus(runPromise);
}