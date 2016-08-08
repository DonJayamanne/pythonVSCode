export interface TestFile extends TestResult {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    rawName: string;
    xmlName: string;
    status?: TestStatus;
}
export interface TestSuite extends TestResult {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    isUnitTest: Boolean;
    isInstance: Boolean;
    rawName: string;
    xmlName: string;
    status?: TestStatus;
}
export interface TestFunction extends TestResult {
    name: string;
    rawName: string;
    status?: TestStatus;
}
export interface TestResult extends Node {
    passed?: boolean;
    time: number;
    line?: number;
    message?: string;
    traceback?: string;
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
export interface Tests {
    testFiles: TestFile[];
    testFunctions: FlattenedTestFunction[];
}
export enum TestStatus {
    Unknown,
    Discovering,
    Idle,
    Running,
    Error
}