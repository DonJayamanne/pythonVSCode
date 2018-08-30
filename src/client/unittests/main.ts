'use strict';
import * as vscode from 'vscode';
// tslint:disable-next-line:no-duplicate-imports
import { Disposable, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import * as constants from '../common/constants';
import { IInstaller } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { PythonSymbolProvider } from '../providers/symbolProvider';
import { UNITTEST_STOP, UNITTEST_VIEW_OUTPUT } from '../telemetry/constants';
import { sendTelemetryEvent } from '../telemetry/index';
import { activateCodeLenses } from './codeLenses/main';
import { CANCELLATION_REASON, CommandSource } from './common/constants';
import { selectTestWorkspace } from './common/testUtils';
import { ITestCollectionStorageService, ITestManager, IWorkspaceTestManagerService, TestFile, TestFunction, TestStatus, TestsToRun } from './common/types';
import { displayTestFrameworkError } from './configuration';
import { TestResultDisplay } from './display/main';
import { TestDisplay } from './display/picker';

let workspaceTestManagerService: IWorkspaceTestManagerService;
let testResultDisplay: TestResultDisplay;
let testDisplay: TestDisplay;
let outChannel: vscode.OutputChannel;
const onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
let testCollectionStorage: ITestCollectionStorageService;
let _serviceContaner: IServiceContainer;

export function activate(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, symboldProvider: PythonSymbolProvider, serviceContainer: IServiceContainer) {
    _serviceContaner = serviceContainer;

    context.subscriptions.push({ dispose: dispose });
    outChannel = outputChannel;
    const disposables = registerCommands();
    context.subscriptions.push(...disposables);

    testCollectionStorage = serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService);
    workspaceTestManagerService = serviceContainer.get<IWorkspaceTestManagerService>(IWorkspaceTestManagerService);

    context.subscriptions.push(autoResetTests());
    context.subscriptions.push(activateCodeLenses(onDidChange, symboldProvider, testCollectionStorage));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(onDocumentSaved));

    autoDiscoverTests();
}
async function getTestManager(displayTestNotConfiguredMessage: boolean, resource?: Uri): Promise<ITestManager | undefined | void> {
    let wkspace: Uri | undefined;
    if (resource) {
        const wkspaceFolder = workspace.getWorkspaceFolder(resource);
        wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
    } else {
        wkspace = await selectTestWorkspace();
    }
    if (!wkspace) {
        return;
    }
    const testManager = workspaceTestManagerService.getTestManager(wkspace);
    if (testManager) {
        return testManager;
    }
    if (displayTestNotConfiguredMessage) {
        await displayTestFrameworkError(wkspace, outChannel, _serviceContaner.get<IInstaller>(IInstaller));
    }
}
let timeoutId: NodeJS.Timer;
async function onDocumentSaved(doc: vscode.TextDocument): Promise<void> {
    const testManager = await getTestManager(false, doc.uri);
    if (!testManager) {
        return;
    }
    const tests = await testManager.discoverTests(CommandSource.auto, false, true);
    if (!tests || !Array.isArray(tests.testFiles) || tests.testFiles.length === 0) {
        return;
    }
    if (tests.testFiles.findIndex((f: TestFile) => f.fullPath === doc.uri.fsPath) === -1) {
        return;
    }

    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => discoverTests(CommandSource.auto, doc.uri, true, false, true), 1000);
}

function dispose() {
    workspaceTestManagerService.dispose();
    testCollectionStorage.dispose();
}
function registerCommands(): vscode.Disposable[] {
    const disposables: Disposable[] = [];
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Discover, (cmdSource: CommandSource = CommandSource.commandPalette, resource?: Uri) => {
        // Ignore the exceptions returned.
        // This command will be invoked else where in the extension.
        // tslint:disable-next-line:no-empty
        discoverTests(cmdSource, resource, true, true).catch(() => { });
    }));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Failed, (cmdSource: CommandSource = CommandSource.commandPalette, resource: Uri) => runTestsImpl(cmdSource, resource, undefined, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run, (cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testToRun?: TestsToRun) => runTestsImpl(cmdSource, file, testToRun)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Debug, (cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testToRun: TestsToRun) => runTestsImpl(cmdSource, file, testToRun, false, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_View_UI, () => displayUI(CommandSource.commandPalette)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI, (cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testFunctions: TestFunction[]) => displayPickerUI(cmdSource, file, testFunctions)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI_Debug, (cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testFunctions: TestFunction[]) => displayPickerUI(cmdSource, file, testFunctions, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Stop, (resource: Uri) => stopTests(resource)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_ViewOutput, (cmdSource: CommandSource = CommandSource.commandPalette) => viewOutput(cmdSource)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () => displayStopUI('Stop discovering tests')));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () => displayStopUI('Stop running tests')));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_Method, (cmdSource: CommandSource = CommandSource.commandPalette, resource: Uri) => selectAndRunTestMethod(cmdSource, resource)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Debug_Method, (cmdSource: CommandSource = CommandSource.commandPalette, resource: Uri) => selectAndRunTestMethod(cmdSource, resource, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_File, (cmdSource: CommandSource = CommandSource.commandPalette) => selectAndRunTestFile(cmdSource)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Current_File, (cmdSource: CommandSource = CommandSource.commandPalette) => runCurrentTestFile(cmdSource)));

    return disposables;
}

function viewOutput(cmdSource: CommandSource) {
    sendTelemetryEvent(UNITTEST_VIEW_OUTPUT);
    outChannel.show();
}
async function displayUI(cmdSource: CommandSource) {
    const testManager = await getTestManager(true);
    if (!testManager) {
        return;
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    testDisplay.displayTestUI(cmdSource, testManager.workspaceFolder);
}
async function displayPickerUI(cmdSource: CommandSource, file: Uri, testFunctions: TestFunction[], debug?: boolean) {
    const testManager = await getTestManager(true, file);
    if (!testManager) {
        return;
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    testDisplay.displayFunctionTestPickerUI(cmdSource, testManager.workspaceFolder, testManager.workingDirectory, file, testFunctions, debug);
}
async function selectAndRunTestMethod(cmdSource: CommandSource, resource: Uri, debug?: boolean) {
    const testManager = await getTestManager(true, resource);
    if (!testManager) {
        return;
    }
    try {
        await testManager.discoverTests(cmdSource, true, true, true);
    } catch (ex) {
        return;
    }

    const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    const selectedTestFn = await testDisplay.selectTestFunction(testManager.workspaceFolder.fsPath, tests);
    if (!selectedTestFn) {
        return;
    }
    // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
    await runTestsImpl(cmdSource, testManager.workspaceFolder, { testFunction: [selectedTestFn.testFunction] } as TestsToRun, false, debug);
}
async function selectAndRunTestFile(cmdSource: CommandSource) {
    const testManager = await getTestManager(true);
    if (!testManager) {
        return;
    }
    try {
        await testManager.discoverTests(cmdSource, true, true, true);
    } catch (ex) {
        return;
    }

    const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    const selectedFile = await testDisplay.selectTestFile(testManager.workspaceFolder.fsPath, tests);
    if (!selectedFile) {
        return;
    }
    // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
    await runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [selectedFile] } as TestsToRun);
}
async function runCurrentTestFile(cmdSource: CommandSource) {
    if (!window.activeTextEditor) {
        return;
    }
    const testManager = await getTestManager(true, window.activeTextEditor.document.uri);
    if (!testManager) {
        return;
    }
    try {
        await testManager.discoverTests(cmdSource, true, true, true);
    } catch (ex) {
        return;
    }
    const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
    const testFiles = tests.testFiles.filter(testFile => {
        return testFile.fullPath === window.activeTextEditor!.document.uri.fsPath;
    });
    if (testFiles.length < 1) {
        return;
    }
    // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
    await runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [testFiles[0]] } as TestsToRun);
}
async function displayStopUI(message: string) {
    const testManager = await getTestManager(true);
    if (!testManager) {
        return;
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    testDisplay.displayStopTestUI(testManager.workspaceFolder, message);
}

let uniTestSettingsString: string;
function autoResetTests() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length > 1) {
        // tslint:disable-next-line:no-empty
        return { dispose: () => { } };
    }

    const settings = PythonSettings.getInstance();
    uniTestSettingsString = JSON.stringify(settings.unitTest);
    return workspace.onDidChangeConfiguration(() => setTimeout(onConfigChanged, 1000));
}
function onConfigChanged() {
    // If there's one workspace, then stop the tests and restart,
    // else let the user do this manually.
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length > 1) {
        return;
    }
    const settings = PythonSettings.getInstance();

    // Possible that a test framework has been enabled or some settings have changed.
    // Meaning we need to re-load the discovered tests (as something could have changed).
    const newSettings = JSON.stringify(settings.unitTest);
    if (uniTestSettingsString === newSettings) {
        return;
    }

    uniTestSettingsString = newSettings;
    if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
        if (testResultDisplay) {
            testResultDisplay.enabled = false;
        }
        workspaceTestManagerService.dispose();
        return;
    }
    if (testResultDisplay) {
        testResultDisplay.enabled = true;
    }
    autoDiscoverTests();
}
function autoDiscoverTests() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length > 1) {
        return;
    }
    const settings = PythonSettings.getInstance();
    if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
        return;
    }

    // No need to display errors.
    // tslint:disable-next-line:no-empty
    discoverTests(CommandSource.auto, workspace.workspaceFolders[0].uri, true).catch(() => { });
}
async function stopTests(resource: Uri) {
    sendTelemetryEvent(UNITTEST_STOP);
    const testManager = await getTestManager(true, resource);
    if (testManager) {
        testManager.stop();
    }
}
async function discoverTests(cmdSource: CommandSource, resource?: Uri, ignoreCache?: boolean, userInitiated?: boolean, quietMode?: boolean) {
    const testManager = await getTestManager(true, resource);
    if (!testManager) {
        return;
    }

    if (testManager && (testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
        testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(onDidChange);
        const discoveryPromise = testManager.discoverTests(cmdSource, ignoreCache, quietMode, userInitiated);
        testResultDisplay.displayDiscoverStatus(discoveryPromise, quietMode)
            .catch(ex => console.error('Python Extension: displayDiscoverStatus', ex));
        await discoveryPromise;
    }
}
async function runTestsImpl(cmdSource: CommandSource, resource?: Uri, testsToRun?: TestsToRun, runFailedTests?: boolean, debug: boolean = false) {
    const testManager = await getTestManager(true, resource);
    if (!testManager) {
        return;
    }

    testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(onDidChange);
    const promise = testManager.runTest(cmdSource, testsToRun, runFailedTests, debug)
        .catch(reason => {
            if (reason !== CANCELLATION_REASON) {
                outChannel.appendLine(`Error: ${reason}`);
            }
            return Promise.reject(reason);
        });

    testResultDisplay.displayProgressStatus(promise, debug);
    await promise;
}
