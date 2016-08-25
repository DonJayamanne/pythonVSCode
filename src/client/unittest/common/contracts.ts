export const CANCELLATION_REASON = 'cancelled_user_request';

export interface TestFolder extends TestResult {
    name: string;
    testFiles: TestFile[];
    nameToRun: string;
    status?: TestStatus;
    folders: TestFolder[];
}
export interface TestFile extends TestResult {
    name: string;
    fullPath: string;
    functions: TestFunction[];
    suites: TestSuite[];
    nameToRun: string;
    xmlName: string;
    status?: TestStatus;
    errorsWhenDiscovering?: string;
}
export interface TestSuite extends TestResult {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    isUnitTest: Boolean;
    isInstance: Boolean;
    nameToRun: string;
    xmlName: string;
    status?: TestStatus;
}
export interface TestFunction extends TestResult {
    name: string;
    nameToRun: string;
    status?: TestStatus;
}
export interface TestResult extends Node {
    passed?: boolean;
    time: number;
    line?: number;
    message?: string;
    traceback?: string;
    functionsPassed?: number;
    functionsFailed?: number;
    functionsDidNotRun?: number;
}
export interface Node {
    expanded?: Boolean;
}
export interface FlattenedTestFunction {
    testFunction: TestFunction;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
}
export interface FlattenedTestSuite {
    testSuite: TestSuite;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
}
export interface TestSummary {
    passed: number;
    failures: number;
    errors: number;
    skipped: number;
}
export interface Tests {
    summary: TestSummary;
    testFiles: TestFile[];
    testFunctions: FlattenedTestFunction[];
    testSuits: FlattenedTestSuite[];
    testFolders: TestFolder[];
    rootTestFolders: TestFolder[];
}
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
export interface TestsToRun {
    testFolder?: TestFolder[];
    testFile?: TestFile[];
    testSuite?: TestSuite[];
    testFunction?: TestFunction[];
}
