export interface TestFile extends TestResult {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    rawName: string;
    xmlName:string;
}
export interface TestSuite extends TestResult {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    isUnitTest: Boolean;
    isInstance: Boolean;
    rawName: string;
    xmlName: string;
}
export interface TestFunction extends TestResult {
    name: string;
    rawName: string;
}
export interface TestResult {
    passed?: boolean;
    time?: number;
    line?: number;
    message?: string;
    traceback?: string;
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