import { ITestVisitor, TestFile, TestFolder, TestFunction, TestStatus, TestSuite } from '../types';

export class TestResultResetVisitor implements ITestVisitor {
    public visitTestFunction(testFunction: TestFunction): void {
        testFunction.passed = null;
        testFunction.time = 0;
        testFunction.message = '';
        testFunction.traceback = '';
        testFunction.status = TestStatus.Unknown;
        testFunction.functionsFailed = 0;
        testFunction.functionsPassed = 0;
        testFunction.functionsDidNotRun = 0;
    }
    public visitTestSuite(testSuite: TestSuite): void {
        testSuite.passed = null;
        testSuite.time = 0;
        testSuite.status = TestStatus.Unknown;
        testSuite.functionsFailed = 0;
        testSuite.functionsPassed = 0;
        testSuite.functionsDidNotRun = 0;
    }
    public visitTestFile(testFile: TestFile): void {
        testFile.passed = null;
        testFile.time = 0;
        testFile.status = TestStatus.Unknown;
        testFile.functionsFailed = 0;
        testFile.functionsPassed = 0;
        testFile.functionsDidNotRun = 0;
    }
    public visitTestFolder(testFolder: TestFolder) {
        testFolder.functionsDidNotRun = 0;
        testFolder.functionsFailed = 0;
        testFolder.functionsPassed = 0;
        testFolder.passed = null;
        testFolder.status = TestStatus.Unknown;
    }
}
