import { Uri, Disposable } from 'vscode';
import { Product } from '../../common/installer';
import { BaseTestManager } from './baseTestManager';

export const CANCELLATION_REASON = 'cancelled_user_request';

export type TestFolder = TestResult & {
    name: string;
    testFiles: TestFile[];
    nameToRun: string;
    status?: TestStatus;
    folders: TestFolder[];
};

export type TestFile = TestResult & {
    name: string;
    fullPath: string;
    functions: TestFunction[];
    suites: TestSuite[];
    nameToRun: string;
    xmlName: string;
    status?: TestStatus;
    errorsWhenDiscovering?: string;
};

export type TestSuite = TestResult & {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    isUnitTest: Boolean;
    isInstance: Boolean;
    nameToRun: string;
    xmlName: string;
    status?: TestStatus;
};

export type TestFunction = TestResult & {
    name: string;
    nameToRun: string;
    status?: TestStatus;
};

export type TestResult = Node & {
    passed?: boolean;
    time: number;
    line?: number;
    message?: string;
    traceback?: string;
    functionsPassed?: number;
    functionsFailed?: number;
    functionsDidNotRun?: number;
}
export type Node = {
    expanded?: Boolean;
};

export type FlattenedTestFunction = {
    testFunction: TestFunction;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
};

export type FlattenedTestSuite = {
    testSuite: TestSuite;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
};

export type TestSummary = {
    passed: number;
    failures: number;
    errors: number;
    skipped: number;
};

export type Tests = {
    summary: TestSummary;
    testFiles: TestFile[];
    testFunctions: FlattenedTestFunction[];
    testSuits: FlattenedTestSuite[];
    testFolders: TestFolder[];
    rootTestFolders: TestFolder[];
};

export enum TestStatus {
    Unknown,
    Discovering,
    Idle,
    Running,
    Fail,
    Error,
    Skipped,
    Pass
}

export type TestsToRun = {
    testFolder?: TestFolder[];
    testFile?: TestFile[];
    testSuite?: TestSuite[];
    testFunction?: TestFunction[];
};

export type UnitTestProduct = Product.nosetest | Product.pytest | Product.unittest;

export interface ITestConfigSettingsService {
    updateTestArgs(testDirectory: string, product: UnitTestProduct, args: string[]): Promise<void>;
    enable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void>;
    disable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void>;
}

export interface ITestManagerService extends Disposable {
    getTestManager(): BaseTestManager | undefined;
    getTestWorkingDirectory(): string;
    getPreferredTestManager(): UnitTestProduct;
}
export interface ITestManagerServiceFactory {
    createTestManagerService(wkspace: Uri): ITestManagerService;
}
export interface IWorkspaceTestManagerService extends Disposable {
    getTestManager(wkspace: Uri): BaseTestManager | undefined;
    getTestWorkingDirectory(wkspace: Uri): string;
    getPreferredTestManager(wkspace: Uri): UnitTestProduct;
}
