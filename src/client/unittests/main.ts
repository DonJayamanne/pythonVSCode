'use strict';

// tslint:disable:no-duplicate-imports no-unnecessary-callback-wrapper

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, TextDocument, Uri } from 'vscode';
import * as vscode from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import * as constants from '../common/constants';
import { IConfigurationService, IDisposableRegistry, ILogger, IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { PythonSymbolProvider } from '../providers/symbolProvider';
import { UNITTEST_STOP, UNITTEST_VIEW_OUTPUT } from '../telemetry/constants';
import { sendTelemetryEvent } from '../telemetry/index';
import { activateCodeLenses } from './codeLenses/main';
import { CANCELLATION_REASON, CommandSource, TEST_OUTPUT_CHANNEL } from './common/constants';
import { selectTestWorkspace } from './common/testUtils';
import { ITestCollectionStorageService, ITestManager, IWorkspaceTestManagerService, TestFile, TestFunction, TestStatus, TestsToRun } from './common/types';
import { ITestDisplay, ITestResultDisplay, IUnitTestConfigurationService, IUnitTestManagementService } from './types';

@injectable()
export class UnitTestManagementService implements IUnitTestManagementService, Disposable {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly disposableRegistry: Disposable[];
    private workspaceTestManagerService?: IWorkspaceTestManagerService;
    private documentManager: IDocumentManager;
    private workspaceService: IWorkspaceService;
    private testResultDisplay?: ITestResultDisplay;
    private autoDiscoverTimer?: NodeJS.Timer;
    private configChangedTimer?: NodeJS.Timer;
    private readonly onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);

        this.disposableRegistry.push(this);
    }
    public dispose() {
        if (this.workspaceTestManagerService) {
            this.workspaceTestManagerService.dispose();
        }
    }
    public async activate(): Promise<void> {
        this.workspaceTestManagerService = this.serviceContainer.get<IWorkspaceTestManagerService>(IWorkspaceTestManagerService);

        this.registerHandlers();
        this.registerCommands();
        this.autoDiscoverTests()
            .catch(ex => this.serviceContainer.get<ILogger>(ILogger).logError('Failed to auto discover tests upon activation', ex));
    }
    public async activateCodeLenses(symboldProvider: PythonSymbolProvider): Promise<void> {
        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService);
        this.disposableRegistry.push(activateCodeLenses(this.onDidChange, symboldProvider, testCollectionStorage));
    }
    public async getTestManager(displayTestNotConfiguredMessage: boolean, resource?: Uri): Promise<ITestManager | undefined | void> {
        let wkspace: Uri | undefined;
        if (resource) {
            const wkspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
            wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
        } else {
            wkspace = await selectTestWorkspace();
        }
        if (!wkspace) {
            return;
        }
        const testManager = this.workspaceTestManagerService!.getTestManager(wkspace);
        if (testManager) {
            return testManager;
        }
        if (displayTestNotConfiguredMessage) {
            const configurationService = this.serviceContainer.get<IUnitTestConfigurationService>(IUnitTestConfigurationService);
            await configurationService.displayTestFrameworkError(wkspace);
        }
    }
    public async configurationChangeHandler(e: ConfigurationChangeEvent) {
        // If there's one workspace, then stop the tests and restart,
        // else let the user do this manually.
        if (!this.workspaceService.hasWorkspaceFolders || this.workspaceService.workspaceFolders!.length > 1) {
            return;
        }

        const workspaceUri = this.workspaceService.workspaceFolders![0].uri;
        if (!e.affectsConfiguration('python.unitTest', workspaceUri)) {
            return;
        }
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(workspaceUri);
        if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
            if (this.testResultDisplay) {
                this.testResultDisplay.enabled = false;
            }
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Why are we disposing, what happens when tests are enabled.
            if (this.workspaceTestManagerService) {
                this.workspaceTestManagerService.dispose();
            }
            return;
        }
        if (this.testResultDisplay) {
            this.testResultDisplay.enabled = true;
        }
        this.autoDiscoverTests()
            .catch(ex => this.serviceContainer.get<ILogger>(ILogger).logError('Failed to auto discover tests upon activation', ex));
    }

    public async discoverTestsForDocument(doc: TextDocument): Promise<void> {
        const testManager = await this.getTestManager(false, doc.uri);
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

        if (this.autoDiscoverTimer) {
            clearTimeout(this.autoDiscoverTimer);
        }
        this.autoDiscoverTimer = setTimeout(() => this.discoverTests(CommandSource.auto, doc.uri, true, false, true), 1000);
    }
    public async autoDiscoverTests() {
        if (!this.workspaceService.hasWorkspaceFolders) {
            return;
        }
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configurationService.getSettings();
        if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
            return;
        }

        // No need to display errors.
        // tslint:disable-next-line:no-empty
        this.discoverTests(CommandSource.auto, this.workspaceService.workspaceFolders![0].uri, true).catch(() => { });
    }
    public async discoverTests(cmdSource: CommandSource, resource?: Uri, ignoreCache?: boolean, userInitiated?: boolean, quietMode?: boolean) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }

        if (testManager.status === TestStatus.Discovering || testManager.status === TestStatus.Running) {
            return;
        }

        if (!this.testResultDisplay) {
            this.testResultDisplay = this.serviceContainer.get<ITestResultDisplay>(ITestResultDisplay);
            this.testResultDisplay.onDidChange(() => this.onDidChange.fire());
        }
        const discoveryPromise = testManager.discoverTests(cmdSource, ignoreCache, quietMode, userInitiated);
        this.testResultDisplay.displayDiscoverStatus(discoveryPromise, quietMode)
            .catch(ex => console.error('Python Extension: displayDiscoverStatus', ex));
        await discoveryPromise;
    }
    public async stopTests(resource: Uri) {
        sendTelemetryEvent(UNITTEST_STOP);
        const testManager = await this.getTestManager(true, resource);
        if (testManager) {
            testManager.stop();
        }
    }
    public async displayStopUI(message: string): Promise<void> {
        const testManager = await this.getTestManager(true);
        if (!testManager) {
            return;
        }

        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        testDisplay.displayStopTestUI(testManager.workspaceFolder, message);
    }
    public async displayUI(cmdSource: CommandSource) {
        const testManager = await this.getTestManager(true);
        if (!testManager) {
            return;
        }

        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        testDisplay.displayTestUI(cmdSource, testManager.workspaceFolder);
    }
    public async displayPickerUI(cmdSource: CommandSource, file: Uri, testFunctions: TestFunction[], debug?: boolean) {
        const testManager = await this.getTestManager(true, file);
        if (!testManager) {
            return;
        }

        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        testDisplay.displayFunctionTestPickerUI(cmdSource, testManager.workspaceFolder, testManager.workingDirectory, file, testFunctions, debug);
    }
    public viewOutput(cmdSource: CommandSource) {
        sendTelemetryEvent(UNITTEST_VIEW_OUTPUT);
        this.outputChannel.show();
    }
    public async selectAndRunTestMethod(cmdSource: CommandSource, resource: Uri, debug?: boolean) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }
        try {
            await testManager.discoverTests(cmdSource, true, true, true);
        } catch (ex) {
            return;
        }

        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService);
        const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        const selectedTestFn = await testDisplay.selectTestFunction(testManager.workspaceFolder.fsPath, tests);
        if (!selectedTestFn) {
            return;
        }
        // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
        await this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFunction: [selectedTestFn.testFunction] } as TestsToRun, false, debug);
    }
    public async selectAndRunTestFile(cmdSource: CommandSource) {
        const testManager = await this.getTestManager(true);
        if (!testManager) {
            return;
        }
        try {
            await testManager.discoverTests(cmdSource, true, true, true);
        } catch (ex) {
            return;
        }

        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService);
        const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        const selectedFile = await testDisplay.selectTestFile(testManager.workspaceFolder.fsPath, tests);
        if (!selectedFile) {
            return;
        }
        await this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [selectedFile] });
    }
    public async runCurrentTestFile(cmdSource: CommandSource) {
        if (!this.documentManager.activeTextEditor) {
            return;
        }
        const testManager = await this.getTestManager(true, this.documentManager.activeTextEditor.document.uri);
        if (!testManager) {
            return;
        }
        try {
            await testManager.discoverTests(cmdSource, true, true, true);
        } catch (ex) {
            return;
        }
        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService);
        const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
        const testFiles = tests.testFiles.filter(testFile => {
            return testFile.fullPath === this.documentManager.activeTextEditor!.document.uri.fsPath;
        });
        if (testFiles.length < 1) {
            return;
        }
        await this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [testFiles[0]] });
    }

    public async runTestsImpl(cmdSource: CommandSource, resource?: Uri, testsToRun?: TestsToRun, runFailedTests?: boolean, debug: boolean = false) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }

        if (!this.testResultDisplay) {
            this.testResultDisplay = this.serviceContainer.get<ITestResultDisplay>(ITestResultDisplay);
            this.testResultDisplay.onDidChange(() => this.onDidChange.fire());
        }

        const promise = testManager.runTest(cmdSource, testsToRun, runFailedTests, debug)
            .catch(reason => {
                if (reason !== CANCELLATION_REASON) {
                    this.outputChannel.appendLine(`Error: ${reason}`);
                }
                return Promise.reject(reason);
            });

        this.testResultDisplay.displayProgressStatus(promise, debug);
        await promise;
    }
    private registerCommands(): void {
        const disposablesRegistry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);

        const disposables = [
            commandManager.registerCommand(constants.Commands.Tests_Discover, (_, cmdSource: CommandSource = CommandSource.commandPalette, resource?: Uri) => {
                // Ignore the exceptions returned.
                // This command will be invoked from other places of the extension.
                this.discoverTests(cmdSource, resource, true, true).ignoreErrors();
            }),
            commandManager.registerCommand(constants.Commands.Tests_Run_Failed, (_, cmdSource: CommandSource = CommandSource.commandPalette, resource: Uri) => this.runTestsImpl(cmdSource, resource, undefined, true)),
            commandManager.registerCommand(constants.Commands.Tests_Run, (_, cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testToRun?: TestsToRun) => this.runTestsImpl(cmdSource, file, testToRun)),
            commandManager.registerCommand(constants.Commands.Tests_Debug, (_, cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testToRun: TestsToRun) => this.runTestsImpl(cmdSource, file, testToRun, false, true)),
            commandManager.registerCommand(constants.Commands.Tests_View_UI, () => this.displayUI(CommandSource.commandPalette)),
            commandManager.registerCommand(constants.Commands.Tests_Picker_UI, (_, cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testFunctions: TestFunction[]) => this.displayPickerUI(cmdSource, file, testFunctions)),
            commandManager.registerCommand(constants.Commands.Tests_Picker_UI_Debug, (_, cmdSource: CommandSource = CommandSource.commandPalette, file: Uri, testFunctions: TestFunction[]) => this.displayPickerUI(cmdSource, file, testFunctions, true)),
            commandManager.registerCommand(constants.Commands.Tests_Stop, (_, resource: Uri) => this.stopTests(resource)),
            commandManager.registerCommand(constants.Commands.Tests_ViewOutput, (_, cmdSource: CommandSource = CommandSource.commandPalette) => this.viewOutput(cmdSource)),
            commandManager.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () => this.displayStopUI('Stop discovering tests')),
            commandManager.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () => this.displayStopUI('Stop running tests')),
            commandManager.registerCommand(constants.Commands.Tests_Select_And_Run_Method, (_, cmdSource: CommandSource = CommandSource.commandPalette, resource: Uri) => this.selectAndRunTestMethod(cmdSource, resource)),
            commandManager.registerCommand(constants.Commands.Tests_Select_And_Debug_Method, (_, cmdSource: CommandSource = CommandSource.commandPalette, resource: Uri) => this.selectAndRunTestMethod(cmdSource, resource, true)),
            commandManager.registerCommand(constants.Commands.Tests_Select_And_Run_File, (_, cmdSource: CommandSource = CommandSource.commandPalette) => this.selectAndRunTestFile(cmdSource)),
            commandManager.registerCommand(constants.Commands.Tests_Run_Current_File, (_, cmdSource: CommandSource = CommandSource.commandPalette) => this.runCurrentTestFile(cmdSource))
        ];

        disposablesRegistry.push(...disposables);
    }
    private onDocumentSaved(doc: TextDocument) {
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(doc.uri);
        if (!settings.unitTest.autoTestDiscoverOnSaveEnabled) {
            return;
        }
        this.discoverTestsForDocument(doc);
    }
    private registerHandlers() {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);

        this.disposableRegistry.push(documentManager.onDidSaveTextDocument(this.onDocumentSaved.bind(this)));
        this.disposableRegistry.push(this.workspaceService.onDidChangeConfiguration(e => {
            if (this.configChangedTimer) {
                clearTimeout(this.configChangedTimer);
            }
            this.configChangedTimer = setTimeout(() => this.configurationChangeHandler(e), 1000);
        }));
    }
}
