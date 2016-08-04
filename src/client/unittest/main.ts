'use strict';
import * as vscode from 'vscode';
import {Tests, TestsToRun, TestFolder, TestFile, TestStatus, TestSuite, TestFunction, FlattenedTestFunction, CANCELLATION_REASON} from './contracts';
import * as nosetests from './nosetest/main';
import * as pytest from './pytest/main';
import {BaseTestManager, resolveValueAsTestToRun} from './testUtils';
import {PythonSettings} from '../common/configSettings';
import {TestResultDisplay} from './display/main';
import {TestFileCodeLensProvider} from './testFileCodeLensProvider';
import {TestDisplay} from './display/picker';
import * as fs from 'fs';
import * as path from 'path';

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
    discoverTests().catch(() => { });
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
    disposables.push(vscode.commands.registerCommand('python.discoverTests', (quiteMode: boolean) => {
        // Ignore the exceptions returned
        // This command will be invoked else where in the extension
        discoverTests(true, quiteMode).catch(() => { return null; });
    }));
    disposables.push(vscode.commands.registerCommand('python.runFailedTests', () => runTestsImpl(true)));
    disposables.push(vscode.commands.registerCommand('python.runtests', (testId) => runTestsImpl(testId)));
    disposables.push(vscode.commands.registerCommand('python.viewTests', () => displayUI()));
    disposables.push(vscode.commands.registerCommand('python.stopUnitTests', () => stopTests()));
    return disposables;
}

function displayUI() {
    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayTestUI();
}

let uniTestSettings = JSON.stringify(settings.unitTest);

function onConfigChanged() {
    // Possible that a test framework has been enabled or some settings have changed
    // Meaning we need to re-load the discovered tests (as something could have changed)
    const newSettings = JSON.stringify(settings.unitTest);
    if (uniTestSettings !== newSettings) {
        uniTestSettings = newSettings;
        discoverTests();
    }
}
function getTestRunner() {
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
function discoverTests(ignoreCache?: boolean, quiteMode: Boolean = false) {
    let testManager = getTestRunner();

    if (testManager && (testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
        if (quiteMode === true) {
            return testManager.discoverTests(ignoreCache);
        }
        else {
            testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);
            return testResultDisplay.DisplayDiscoverStatus(testManager.discoverTests(ignoreCache));
        }
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
        arg.parentTestSuite && typeof arg.testFunction.name === 'boolean';
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
        vscode.window.showInformationMessage('Please enable one of the test frameworks (pytest or nosetest)');
        return;
    }

    // lastRanTests = testsToRun;
    let runInfo = identifyTestType(arg);

    testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);
    outChannel.appendLine('\n');

    let runPromise = testManager.runTest(runInfo).then(tests => {
        if (tests.testFunctions.some(current => current.testFunction.passed === false)) {
            // Redisplay this if it was hidden, as we have errors
            outChannel.show();
        }
        return tests;
    }).catch(reason => {
        if (reason !== CANCELLATION_REASON) {
            outChannel.appendLine('Error: ' + reason);
        }
        outChannel.show();
        return Promise.reject(reason);
    });

    testResultDisplay.DisplayProgressStatus(runPromise);
}