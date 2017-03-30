// import {TestFolder, TestsToRun, Tests, TestFile, TestSuite, TestFunction, TestStatus, FlattenedTestFunction, FlattenedTestSuite, CANCELLATION_REASON} from './contracts';
import { Tests, TestStatus, TestsToRun, CANCELLATION_REASON } from './contracts';
import * as vscode from 'vscode';
import { resetTestResults, displayTestErrorMessage, storeDiscoveredTests } from './testUtils';
import { Installer, Product } from '../../common/installer';
import { isNotInstalledError } from '../../common/helpers';

export abstract class BaseTestManager {
    private tests: Tests;
    private _status: TestStatus = TestStatus.Unknown;
    private cancellationTokenSource: vscode.CancellationTokenSource;
    private installer: Installer;
    protected get cancellationToken(): vscode.CancellationToken {
        if (this.cancellationTokenSource) {
            return this.cancellationTokenSource.token;
        }
    }
    public dispose() {
    }
    public get status(): TestStatus {
        return this._status;
    }
    public stop() {
        if (this.cancellationTokenSource) {
            this.cancellationTokenSource.cancel();
        }
    }
    constructor(private testProvider: string, private product: Product, protected rootDirectory: string, protected outputChannel: vscode.OutputChannel) {
        this._status = TestStatus.Unknown;
        this.installer = new Installer();
    }
    public reset() {
        this._status = TestStatus.Unknown;
        this.tests = null;
    }
    public resetTestResults() {
        if (!this.tests) {
            return;
        }

        resetTestResults(this.tests);
    }
    private createCancellationToken() {
        this.disposeCancellationToken();
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
    }
    private disposeCancellationToken() {
        if (this.cancellationTokenSource) {
            this.cancellationTokenSource.dispose();
        }
        this.cancellationTokenSource = null;
    }
    private discoverTestsPromise: Promise<Tests>;
    discoverTests(ignoreCache: boolean = false, quietMode: boolean = false): Promise<Tests> {
        if (this.discoverTestsPromise) {
            return this.discoverTestsPromise;
        }

        if (!ignoreCache && this.tests && this.tests.testFunctions.length > 0) {
            this._status = TestStatus.Idle;
            return Promise.resolve(this.tests);
        }
        this._status = TestStatus.Discovering;

        this.createCancellationToken();
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
                storeDiscoveredTests(tests);
                this.disposeCancellationToken();

                return tests;
            }).catch(reason => {
                if (isNotInstalledError(reason) && !quietMode) {
                    this.installer.promptToInstall(this.product);
                }

                this.tests = null;
                this.discoverTestsPromise = null;
                if (this.cancellationToken && this.cancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this._status = TestStatus.Idle;
                }
                else {
                    this._status = TestStatus.Error;
                    this.outputChannel.appendLine('Test Disovery failed: ');
                    this.outputChannel.appendLine('' + reason);
                }
                storeDiscoveredTests(null);
                this.disposeCancellationToken();
                return Promise.reject(reason);
            });
    }
    abstract discoverTestsImpl(ignoreCache: boolean, debug?: boolean): Promise<Tests>;
    public runTest(testsToRun?: TestsToRun, debug?: boolean): Promise<Tests>;
    public runTest(runFailedTests?: boolean, debug?: boolean): Promise<Tests>;
    public runTest(args: any, debug?: boolean): Promise<Tests> {
        let runFailedTests = false;
        let testsToRun: TestsToRun = null;
        let moreInfo = {
            Test_Provider: this.testProvider,
            Run_Failed_Tests: 'false',
            Run_Specific_File: 'false',
            Run_Specific_Class: 'false',
            Run_Specific_Function: 'false'
        };

        if (typeof args === 'boolean') {
            runFailedTests = args === true;
            moreInfo.Run_Failed_Tests = runFailedTests + '';
        }
        if (typeof args === 'object' && args !== null) {
            testsToRun = args;
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
        this.createCancellationToken();
        // If running failed tests, then don't clear the previously build UnitTests
        // If we do so, then we end up re-discovering the unit tests and clearing previously cached list of failed tests
        // Similarly, if running a specific test or test file, don't clear the cache (possible tests have some state information retained)
        const clearDiscoveredTestCache = runFailedTests || moreInfo.Run_Specific_File || moreInfo.Run_Specific_Class || moreInfo.Run_Specific_Function ? false : true;
        return this.discoverTests(clearDiscoveredTestCache, true)
            .catch(reason => {
                if (this.cancellationToken && this.cancellationToken.isCancellationRequested) {
                    return Promise.reject(reason);
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
                this.disposeCancellationToken();
                return this.tests;
            }).catch(reason => {
                if (this.cancellationToken && this.cancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this._status = TestStatus.Idle;
                }
                else {
                    this._status = TestStatus.Error;
                }
                this.disposeCancellationToken();
                return Promise.reject(reason);
            });
    }
    abstract runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any>;
}