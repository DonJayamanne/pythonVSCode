import { Uri } from 'vscode';
import { noop } from '../../common/core.utils';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { UNITTEST_PROVIDER } from '../common/constants';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { ITestsHelper, TestDiscoveryOptions, TestRunOptions, Tests, TestStatus, TestsToRun } from '../common/types';
import { IArgumentsService, ITestManagerRunner, TestFilter } from '../types';

export class TestManager extends BaseTestManager {
    private readonly argsService: IArgumentsService;
    private readonly helper: ITestsHelper;
    private readonly runner: ITestManagerRunner;
    public get enabled() {
        return this.settings.unitTest.unittestEnabled;
    }
    constructor(workspaceFolder: Uri, rootDirectory: string, serviceContainer: IServiceContainer) {
        super(UNITTEST_PROVIDER, Product.unittest, workspaceFolder, rootDirectory, serviceContainer);
        this.argsService = this.serviceContainer.get<IArgumentsService>(IArgumentsService, this.testProvider);
        this.helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        this.runner = this.serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, this.testProvider);
    }
    public configure() {
        noop();
    }
    public getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken!, ignoreCache,
            outChannel: this.outputChannel
        };
    }
    public async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<{}> {
        let args: string[];

        const runAllTests = this.helper.shouldRunAllTests(testsToRun);
        if (debug) {
            args = this.argsService.filterArguments(this.settings.unitTest.unittestArgs, runAllTests ? TestFilter.debugAll : TestFilter.debugSpecific);
        } else {
            args = this.argsService.filterArguments(this.settings.unitTest.unittestArgs, runAllTests ? TestFilter.runAll : TestFilter.runSpecific);
        }

        if (runFailedTests === true) {
            testsToRun = { testFile: [], testFolder: [], testSuite: [], testFunction: [] };
            testsToRun.testFunction = tests.testFunctions.filter(fn => {
                return fn.testFunction.status === TestStatus.Error || fn.testFunction.status === TestStatus.Fail;
            }).map(fn => fn.testFunction);
        }
        const options: TestRunOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            tests, args, testsToRun, debug,
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel
        };
        return this.runner.runTest(this.testResultsService, options, this);
    }
}
