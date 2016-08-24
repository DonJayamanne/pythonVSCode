// import {TestFolder, TestsToRun, Tests, TestFile, TestSuite, TestFunction, TestStatus, FlattenedTestFunction, FlattenedTestSuite, CANCELLATION_REASON} from './contracts';
import {Tests, TestStatus, TestsToRun, CANCELLATION_REASON} from './contracts';
import * as vscode from 'vscode';
import * as os from 'os';
import {resetTestResults, displayTestErrorMessage, storeDiscoveredTests} from './testUtils';

export abstract class BaseTestManager {
    private tests: Tests;
    private _status: TestStatus = TestStatus.Unknown;
    private cancellationTokenSource: vscode.CancellationTokenSource;
    protected get cancellationToken(): vscode.CancellationToken {
        return this.cancellationTokenSource && this.cancellationTokenSource.token;
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
    constructor(protected rootDirectory: string, protected outputChannel: vscode.OutputChannel) {
        this._status = TestStatus.Unknown;
    }
    protected stdOut(output: string) {
        this.outputChannel.append(output);
        // output.split(/\r?\n/g).forEach((line, index, lines) => {
        //     if (index === 0) {
        //         if (output.startsWith(os.EOL) || lines.length > 1) {
        //             return this.outputChannel.appendLine(line);
        //         }
        //         return this.outputChannel.append(line);
        //     }
        //     if (index === lines.length - 1) {
        //         return this.outputChannel.append(line);
        //     }
        //     this.outputChannel.appendLine(line);
        // });
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

        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this.createCancellationToken();
        return this.discoverTestsPromise = this.discoverTestsImpl()
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
                        this.outputChannel.appendLine('');
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
                this.tests = null;
                this.discoverTestsPromise = null;
                if (this.cancellationToken.isCancellationRequested) {
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
    abstract discoverTestsImpl(): Promise<Tests>;
    public runTest(testsToRun?: TestsToRun): Promise<Tests>;
    public runTest(runFailedTests?: boolean): Promise<Tests>;
    public runTest(args: any): Promise<Tests> {
        let runFailedTests = false;
        let testsToRun: TestsToRun = null;
        if (typeof args === 'boolean') {
            runFailedTests = args === true;
        }
        if (typeof args === 'object' && args !== null) {
            testsToRun = args;
        }
        if (runFailedTests === false && testsToRun === null) {
            this.resetTestResults();
        }
        this._status = TestStatus.Running;
        this.createCancellationToken();
        return this.discoverTests(false, true)
            .catch(reason => {
                if (this.cancellationToken.isCancellationRequested) {
                    return Promise.reject(reason);
                }
                displayTestErrorMessage('Errors in discovering tests, continuing with tests');
                return <Tests>{
                    rootTestFolders: [], testFiles: [], testFolders: [], testFunctions: [], testSuits: [],
                    summary: { errors: 0, failures: 0, passed: 0, skipped: 0 }
                };
            })
            .then(tests => {
                return this.runTestImpl(tests, testsToRun, runFailedTests);
            }).then(() => {
                this._status = TestStatus.Idle;
                this.disposeCancellationToken();
                return this.tests;
            }).catch(reason => {
                if (this.cancellationToken.isCancellationRequested) {
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
    abstract runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean): Promise<any>;
}