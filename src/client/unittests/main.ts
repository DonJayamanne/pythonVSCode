'use strict';
import * as vscode from 'vscode';
import { TestsToRun, TestStatus, TestFunction, FlattenedTestFunction, CANCELLATION_REASON } from './common/contracts';
import * as nosetests from './nosetest/main';
import * as pytest from './pytest/main';
import * as unittest from './unittest/main';
import { resolveValueAsTestToRun, getDiscoveredTests } from './common/testUtils';
import { BaseTestManager } from './common/baseTestManager';
import { PythonSettings } from '../common/configSettings';
import { TestResultDisplay } from './display/main';
import { TestDisplay } from './display/picker';
import * as constants from '../common/constants';
import { activateCodeLenses } from './codeLenses/main';
import { displayTestFrameworkError, displayPromptToEnableTests } from './configuration';

const settings = PythonSettings.getInstance();
let testManager: BaseTestManager;
let pyTestManager: pytest.TestManager;
let unittestManager: unittest.TestManager;
let nosetestManager: nosetests.TestManager;
let testResultDisplay: TestResultDisplay;
let testDisplay: TestDisplay;
let outChannel: vscode.OutputChannel;

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
    context.subscriptions.push(activateCodeLenses());

    displayPromptToEnableTests(vscode.workspace.rootPath);
}
function dispose() {
    if (pyTestManager) {
        pyTestManager.dispose();
    }
    if (nosetestManager) {
        nosetestManager.dispose();
    }
    if (unittestManager) {
        unittestManager.dispose();
    }
}
function registerCommands(): vscode.Disposable[] {
    const disposables = [];
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Discover, (quiteMode: boolean) => {
        // Ignore the exceptions returned
        // This command will be invoked else where in the extension
        discoverTests(true, quiteMode).catch(() => { return null; });
    }));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Failed, () => runTestsImpl(true)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run, (testId) => runTestsImpl(testId)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_View_UI, () => displayUI()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI, (file, testFunctions) => displayPickerUI(file, testFunctions)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Stop, () => stopTests()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_ViewOutput, () => outChannel.show()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () => displayStopUI('Stop discovering tests')));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () => displayStopUI('Stop running tests')));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_Method, () => selectAndRunTestMethod()));

    return disposables;
}

function displayUI() {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayTestUI(vscode.workspace.rootPath);
}
function displayPickerUI(file: string, testFunctions: TestFunction[]) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayFunctionTestPickerUI(vscode.workspace.rootPath, file, testFunctions);
}
function selectAndRunTestMethod() {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }
    testManager.discoverTests(true, true).then(() => {
        const tests = getDiscoveredTests();
        testDisplay = testDisplay ? testDisplay : new TestDisplay();
        testDisplay.selectTestFunction(vscode.workspace.rootPath, tests).then(testFn => {
            runTestsImpl(testFn);
        }).catch(() => { });
    });
}
function displayStopUI(message: string) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayStopTestUI(message);
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
    if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
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
        if (unittestManager) {
            unittestManager.dispose();
            unittestManager = null;
        }
        return;
    }

    if (testResultDisplay) {
        testResultDisplay.enabled = true;
    }

    // No need to display errors
    discoverTests(true, true);
}
function getTestRunner() {
    const rootDirectory = vscode.workspace.rootPath;
    if (settings.unitTest.nosetestsEnabled) {
        return nosetestManager = nosetestManager ? nosetestManager : new nosetests.TestManager(rootDirectory, outChannel);
    }
    else if (settings.unitTest.pyTestEnabled) {
        return pyTestManager = pyTestManager ? pyTestManager : new pytest.TestManager(rootDirectory, outChannel);
    }
    else if (settings.unitTest.unittestEnabled) {
        return unittestManager = unittestManager ? unittestManager : new unittest.TestManager(rootDirectory, outChannel);
    }
    return null;
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
    if (arg && arg.testFunction && Array.isArray(arg.testFunction)) {
        return true;
    }
    if (arg && arg.testSuite && Array.isArray(arg.testSuite)) {
        return true;
    }
    if (arg && arg.testFile && Array.isArray(arg.testFile)) {
        return true;
    }
    return false;
}
function isUri(arg: any): arg is vscode.Uri {
    return arg && arg.fsPath && typeof arg.fsPath === 'string';
}
function isFlattenedTestFunction(arg: any): arg is FlattenedTestFunction {
    return arg && arg.testFunction && typeof arg.xmlClassName === 'string' &&
        arg.parentTestFile && typeof arg.testFunction.name === 'string';
}
function identifyTestType(rootDirectory: string, arg?: vscode.Uri | TestsToRun | boolean | FlattenedTestFunction): TestsToRun | Boolean {
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
        return resolveValueAsTestToRun(arg.fsPath, rootDirectory);
    }
    return null;
}
function runTestsImpl(arg?: vscode.Uri | TestsToRun | boolean | FlattenedTestFunction) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError();
    }

    // lastRanTests = testsToRun;
    let runInfo = identifyTestType(vscode.workspace.rootPath, arg);

    testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);

    let runPromise = testManager.runTest(runInfo).catch(reason => {
        if (reason !== CANCELLATION_REASON) {
            outChannel.appendLine('Error: ' + reason);
        }
        return Promise.reject(reason);
    });

    testResultDisplay.DisplayProgressStatus(runPromise);
}