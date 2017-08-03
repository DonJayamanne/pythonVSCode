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
import { displayTestFrameworkError } from './configuration';
import { PythonSymbolProvider } from '../providers/symbolProvider';

const settings = PythonSettings.getInstance();
let testManager: BaseTestManager;
let pyTestManager: pytest.TestManager;
let unittestManager: unittest.TestManager;
let nosetestManager: nosetests.TestManager;
let testResultDisplay: TestResultDisplay;
let testDisplay: TestDisplay;
let outChannel: vscode.OutputChannel;
let onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

export function activate(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, symboldProvider: PythonSymbolProvider) {
    context.subscriptions.push({ dispose: dispose });
    outChannel = outputChannel;
    let disposables = registerCommands();
    context.subscriptions.push(...disposables);

    if (settings.unitTest.nosetestsEnabled || settings.unitTest.pyTestEnabled || settings.unitTest.unittestEnabled) {
        // Ignore the exceptions returned
        // This function is invoked via a command which will be invoked else where in the extension
        discoverTests(true).catch(() => {
            // Ignore the errors
        });
    }

    settings.addListener('change', onConfigChanged);
    context.subscriptions.push(activateCodeLenses(onDidChange, symboldProvider));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(onDocumentSaved));
}

let timeoutId: number;
async function onDocumentSaved(doc: vscode.TextDocument): Promise<void> {
    let testManager = getTestRunner();
    if (!testManager) {
        return;
    }

    let tests = await testManager.discoverTests(false, true);
    if (!tests || !Array.isArray(tests.testFiles) || tests.testFiles.length === 0) {
        return;
    }
    if (tests.testFiles.findIndex(f => f.fullPath === doc.uri.fsPath) === -1) {
        return;
    }

    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => { discoverTests(true); }, 1000);
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
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Discover, () => {
        // Ignore the exceptions returned
        // This command will be invoked else where in the extension
        discoverTests(true).catch(() => { return null; });
    }));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Failed, () => runTestsImpl(true)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run, (testId) => runTestsImpl(testId)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Debug, (testId) => runTestsImpl(testId, true)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_View_UI, () => displayUI()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI, (file, testFunctions) => displayPickerUI(file, testFunctions)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI_Debug, (file, testFunctions) => displayPickerUI(file, testFunctions, true)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Stop, () => stopTests()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_ViewOutput, () => outChannel.show()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () => displayStopUI('Stop discovering tests')));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () => displayStopUI('Stop running tests')));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_Method, () => selectAndRunTestMethod()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Debug_Method, () => selectAndRunTestMethod(true)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_File, () => selectAndRunTestFile()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Current_File, () => runCurrentTestFile()));

    return disposables;
}

function displayUI() {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayTestUI(vscode.workspace.rootPath);
}
function displayPickerUI(file: string, testFunctions: TestFunction[], debug?: boolean) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay();
    testDisplay.displayFunctionTestPickerUI(vscode.workspace.rootPath, file, testFunctions, debug);
}
function selectAndRunTestMethod(debug?: boolean) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
    }
    testManager.discoverTests(true, true).then(() => {
        const tests = getDiscoveredTests();
        testDisplay = testDisplay ? testDisplay : new TestDisplay();
        testDisplay.selectTestFunction(vscode.workspace.rootPath, tests).then(testFn => {
            runTestsImpl(testFn, debug);
        }).catch(() => { });
    });
}
function selectAndRunTestFile() {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
    }
    testManager.discoverTests(true, true).then(() => {
        const tests = getDiscoveredTests();
        testDisplay = testDisplay ? testDisplay : new TestDisplay();
        testDisplay.selectTestFile(vscode.workspace.rootPath, tests).then(testFile => {
            runTestsImpl({ testFile: [testFile] });
        }).catch(() => { });
    });
}
function runCurrentTestFile() {
    if (!vscode.window.activeTextEditor) {
        return;
    }
    const currentFilePath = vscode.window.activeTextEditor.document.fileName;
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
    }
    testManager.discoverTests(true, true).then(() => {
        const tests = getDiscoveredTests();
        const testFiles = tests.testFiles.filter(testFile => {
            return testFile.fullPath === currentFilePath;
        });
        if (testFiles.length < 1) {
            return;
        }
        runTestsImpl({ testFile: [testFiles[0]] });
    });
}
function displayStopUI(message: string) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
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
    if (settings.unitTest.nosetestsEnabled || settings.unitTest.pyTestEnabled || settings.unitTest.unittestEnabled) {
        discoverTests(true);
    }
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
function discoverTests(ignoreCache?: boolean) {
    let testManager = getTestRunner();
    if (!testManager) {
        displayTestFrameworkError(outChannel);
        return Promise.resolve(null);
    }

    if (testManager && (testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
        testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel, onDidChange);
        return testResultDisplay.DisplayDiscoverStatus(testManager.discoverTests(ignoreCache));
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
function identifyTestType(rootDirectory: string, arg?: vscode.Uri | TestsToRun | boolean | FlattenedTestFunction): TestsToRun | boolean {
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
function runTestsImpl(arg?: vscode.Uri | TestsToRun | boolean | FlattenedTestFunction, debug: boolean = false) {
    let testManager = getTestRunner();
    if (!testManager) {
        return displayTestFrameworkError(outChannel);
    }

    // lastRanTests = testsToRun;
    let runInfo = identifyTestType(vscode.workspace.rootPath, arg);

    testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel, onDidChange);

    let ret = typeof runInfo === 'boolean' ? testManager.runTest(runInfo, debug) : testManager.runTest(runInfo, debug);
    let runPromise = ret.catch(reason => {
        if (reason !== CANCELLATION_REASON) {
            outChannel.appendLine('Error: ' + reason);
        }
        return Promise.reject(reason);
    });

    testResultDisplay.DisplayProgressStatus(runPromise, debug);
}