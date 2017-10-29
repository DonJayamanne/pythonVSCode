// import {TestFolder, TestsToRun, Tests, TestFile, TestSuite, TestFunction, TestStatus, FlattenedTestFunction, FlattenedTestSuite, CANCELLATION_REASON} from './contracts';
import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';
import { IPythonSettings, PythonSettings } from '../../common/configSettings';
import { isNotInstalledError } from '../../common/helpers';
import { Installer, Product } from '../../common/installer';
import { CANCELLATION_REASON } from './constants';
import { displayTestErrorMessage } from './testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper, Tests, TestStatus, TestsToRun } from './types';

export abstract class BaseTestManager {
    public readonly workspace: Uri;
    protected readonly settings: IPythonSettings;
    private tests: Tests;
    // tslint:disable-next-line:variable-name
    private _status: TestStatus = TestStatus.Unknown;
    private discoveryCancellationTokenSource: vscode.CancellationTokenSource;
    private testRunnerCancellationTokenSource: vscode.CancellationTokenSource;
    private installer: Installer;
    private discoverTestsPromise: Promise<Tests>;
    constructor(private testProvider: string, private product: Product, protected rootDirectory: string,
        protected outputChannel: vscode.OutputChannel, private testCollectionStorage: ITestCollectionStorageService,
        protected testResultsService: ITestResultsService, protected testsHelper: ITestsHelper) {
        this._status = TestStatus.Unknown;
        this.installer = new Installer();
        this.settings = PythonSettings.getInstance(this.rootDirectory ? Uri.file(this.rootDirectory) : undefined);
        this.workspace = workspace.getWorkspaceFolder(Uri.file(this.rootDirectory)).uri;
    }
    protected get testDiscoveryCancellationToken(): vscode.CancellationToken | undefined {
        return this.discoveryCancellationTokenSource ? this.discoveryCancellationTokenSource.token : undefined;
    }
    protected get testRunnerCancellationToken(): vscode.CancellationToken | undefined {
        return this.testRunnerCancellationTokenSource ? this.testRunnerCancellationTokenSource.token : undefined;
    }
    public dispose() {
        this.stop();
    }
    public get status(): TestStatus {
        return this._status;
    }
    public get workingDirectory(): string {
        const settings = PythonSettings.getInstance(vscode.Uri.file(this.rootDirectory));
        return settings.unitTest.cwd && settings.unitTest.cwd.length > 0 ? settings.unitTest.cwd : this.rootDirectory;
    }
    public stop() {
        if (this.discoveryCancellationTokenSource) {
            this.discoveryCancellationTokenSource.cancel();
        }
        if (this.testRunnerCancellationTokenSource) {
            this.testRunnerCancellationTokenSource.cancel();
        }
    }
    public reset() {
        this._status = TestStatus.Unknown;
        this.tests = null;
    }
    public resetTestResults() {
        if (!this.tests) {
            return;
        }

        this.testResultsService.resetResults(this.tests);
    }
    public async discoverTests(ignoreCache: boolean = false, quietMode: boolean = false, userInitiated: boolean = false): Promise<Tests> {
        if (this.discoverTestsPromise) {
            return this.discoverTestsPromise;
        }

        if (!ignoreCache && this.tests && this.tests.testFunctions.length > 0) {
            this._status = TestStatus.Idle;
            return Promise.resolve(this.tests);
        }
        this._status = TestStatus.Discovering;

        // If ignoreCache is true, its an indication of the fact that its a user invoked operation.
        // Hence we can stop the debugger.
        if (userInitiated) {
            this.stop();
        }

        this.createCancellationTokens();
        return this.discoverTestsPromise = this.discoverTestsImpl(ignoreCache)
            .then(tests => {
                this.tests = tests;
                this._status = TestStatus.Idle;
                this.resetTestResults();
                this.discoverTestsPromise = null;

                // have errors in Discovering
                let haveErrorsInDiscovering = false;
                tests.testFiles.forEach(file => {
                    if (file.errorsWhenDiscovering && file.errorsWhenDiscovering.length > 0) {
                        haveErrorsInDiscovering = true;
                        this.outputChannel.append('_'.repeat(10));
                        this.outputChannel.append(`There was an error in identifying unit tests in ${file.nameToRun}`);
                        this.outputChannel.appendLine('_'.repeat(10));
                        this.outputChannel.appendLine(file.errorsWhenDiscovering);
                    }
                });
                if (haveErrorsInDiscovering && !quietMode) {
                    displayTestErrorMessage('There were some errors in disovering unit tests');
                }
                const wkspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.rootDirectory)).uri;
                this.testCollectionStorage.storeTests(wkspace, tests);
                this.disposeCancellationTokens();

                return tests;
            }).catch(reason => {
                if (isNotInstalledError(reason) && !quietMode) {
                    // tslint:disable-next-line:no-floating-promises
                    this.installer.promptToInstall(this.product, this.workspace);
                }

                this.tests = null;
                this.discoverTestsPromise = null;
                if (this.testDiscoveryCancellationToken && this.testDiscoveryCancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this._status = TestStatus.Idle;
                } else {
                    this._status = TestStatus.Error;
                    this.outputChannel.appendLine('Test Disovery failed: ');
                    // tslint:disable-next-line:prefer-template
                    this.outputChannel.appendLine('' + reason);
                }
                const wkspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.rootDirectory)).uri;
                this.testCollectionStorage.storeTests(wkspace, null);
                this.disposeCancellationTokens();
                return Promise.reject(reason);
            });
    }
    public runTest(testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<Tests> {
        const moreInfo = {
            Test_Provider: this.testProvider,
            Run_Failed_Tests: 'false',
            Run_Specific_File: 'false',
            Run_Specific_Class: 'false',
            Run_Specific_Function: 'false'
        };

        if (runFailedTests === true) {
            // tslint:disable-next-line:prefer-template
            moreInfo.Run_Failed_Tests = runFailedTests + '';
        }
        if (testsToRun && typeof testsToRun === 'object') {
            if (Array.isArray(testsToRun.testFile) && testsToRun.testFile.length > 0) {
                moreInfo.Run_Specific_File = 'true';
            }
            if (Array.isArray(testsToRun.testSuite) && testsToRun.testSuite.length > 0) {
                moreInfo.Run_Specific_Class = 'true';
            }
            if (Array.isArray(testsToRun.testFunction) && testsToRun.testFunction.length > 0) {
                moreInfo.Run_Specific_Function = 'true';
            }
        }
        if (runFailedTests === false && testsToRun === null) {
            this.resetTestResults();
        }

        this._status = TestStatus.Running;
        this.stop();
        this.createCancellationTokens(true);

        // If running failed tests, then don't clear the previously build UnitTests
        // If we do so, then we end up re-discovering the unit tests and clearing previously cached list of failed tests
        // Similarly, if running a specific test or test file, don't clear the cache (possible tests have some state information retained)
        const clearDiscoveredTestCache = runFailedTests || moreInfo.Run_Specific_File || moreInfo.Run_Specific_Class || moreInfo.Run_Specific_Function ? false : true;
        return this.discoverTests(clearDiscoveredTestCache, true, true)
            .catch(reason => {
                if (this.testRunnerCancellationToken && this.testRunnerCancellationToken.isCancellationRequested) {
                    return Promise.reject<Tests>(reason);
                }
                displayTestErrorMessage('Errors in discovering tests, continuing with tests');
                return <Tests>{
                    rootTestFolders: [], testFiles: [], testFolders: [], testFunctions: [], testSuits: [],
                    summary: { errors: 0, failures: 0, passed: 0, skipped: 0 }
                };
            })
            .then(tests => {
                return this.runTestImpl(tests, testsToRun, runFailedTests, debug);
            }).then(() => {
                this._status = TestStatus.Idle;
                this.disposeCancellationTokens(true);
                return this.tests;
            }).catch(reason => {
                if (this.testRunnerCancellationToken && this.testRunnerCancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this._status = TestStatus.Idle;
                } else {
                    this._status = TestStatus.Error;
                }
                this.disposeCancellationTokens(true);
                return Promise.reject<Tests>(reason);
            });
    }
    // tslint:disable-next-line:no-any
    protected abstract runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any>;
    protected abstract discoverTestsImpl(ignoreCache: boolean, debug?: boolean): Promise<Tests>;
    private createCancellationTokens(createTestRunnerToken: boolean = false) {
        this.disposeCancellationTokens(createTestRunnerToken);
        this.discoveryCancellationTokenSource = new vscode.CancellationTokenSource();
        if (createTestRunnerToken) {
            this.testRunnerCancellationTokenSource = new vscode.CancellationTokenSource();
        }
    }
    private disposeCancellationTokens(disposeTestRunnerToken: boolean = false) {
        if (this.discoveryCancellationTokenSource) {
            this.discoveryCancellationTokenSource.dispose();
        }
        this.discoveryCancellationTokenSource = null;
        if (disposeTestRunnerToken) {
            if (this.testRunnerCancellationTokenSource) {
                this.testRunnerCancellationTokenSource.dispose();
            }
            this.testRunnerCancellationTokenSource = null;
        }
    }
}
