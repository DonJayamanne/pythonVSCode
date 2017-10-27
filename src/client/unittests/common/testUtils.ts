import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';
import * as constants from '../../common/constants';
import { FlattenedTestFunction, FlattenedTestSuite, TestFile, TestFolder, TestFunction, Tests, TestStatus, TestsToRun, TestSuite } from './contracts';
import { ITestVisitor } from './testUtils';

export interface ITestCollectionStorageService {
    getTests(wkspace: Uri): Tests | undefined;
    storeTests(wkspace: Uri, tests: Tests | null | undefined): void;
}

export class TestCollectionStorageService implements ITestCollectionStorageService {
    private testsIndexedByWorkspaceUri = new Map<string, Tests | null | undefined>();
    public getTests(wkspace: Uri): Tests | undefined {
        const workspaceFolder = getWorkspaceFolderPath(wkspace) || '';
        return this.testsIndexedByWorkspaceUri.has(workspaceFolder) ? this.testsIndexedByWorkspaceUri.get(workspaceFolder) : undefined;
    }
    public storeTests(wkspace: Uri, tests: Tests | null | undefined): void {
        const workspaceFolder = getWorkspaceFolderPath(wkspace) || '';
        this.testsIndexedByWorkspaceUri.set(workspaceFolder, tests);
    }
}

function getWorkspaceFolderPath(resource?: Uri): string | undefined {
    if (!resource) {
        return undefined;
    }
    const folder = workspace.getWorkspaceFolder(resource);
    return folder ? folder.uri.path : undefined;
}
export async function selectTestWorkspace(): Promise<Uri | undefined> {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return undefined;
    } else if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    } else {
        // tslint:disable-next-line:no-any prefer-type-cast
        const workspaceFolder = await (window as any).showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspace ? workspaceFolder.uri : undefined;
    }
}

export function displayTestErrorMessage(message: string) {
    vscode.window.showErrorMessage(message, constants.Button_Text_Tests_View_Output).then(action => {
        if (action === constants.Button_Text_Tests_View_Output) {
            vscode.commands.executeCommand(constants.Commands.Tests_ViewOutput);
        }
    });

}

export function parseTestName(name: string, rootDirectory: string, testCollectionStorage: ITestCollectionStorageService): TestsToRun {
    // TODO: We need a better way to match (currently we have raw name, name, xmlname, etc = which one do we.
    // use to identify a file given the full file name, similary for a folder and function
    // Perhaps something like a parser or methods like TestFunction.fromString()... something)
    const workspaceUri = workspace.getWorkspaceFolder(Uri.file(rootDirectory)).uri;
    const tests = testCollectionStorage.getTests(workspaceUri);
    if (!tests) { return null; }
    const absolutePath = path.isAbsolute(name) ? name : path.resolve(rootDirectory, name);
    const testFolders = tests.testFolders.filter(folder => folder.nameToRun === name || folder.name === name || folder.name === absolutePath);
    if (testFolders.length > 0) { return { testFolder: testFolders }; }

    const testFiles = tests.testFiles.filter(file => file.nameToRun === name || file.name === name || file.fullPath === absolutePath);
    if (testFiles.length > 0) { return { testFile: testFiles }; }

    const testFns = tests.testFunctions.filter(fn => fn.testFunction.nameToRun === name || fn.testFunction.name === name).map(fn => fn.testFunction);
    if (testFns.length > 0) { return { testFunction: testFns }; }

    // Just return this as a test file
    return <TestsToRun>{ testFile: [{ name: name, nameToRun: name, functions: [], suites: [], xmlName: name, fullPath: '', time: 0 }] };
}
export function extractBetweenDelimiters(content: string, startDelimiter: string, endDelimiter: string): string {
    content = content.substring(content.indexOf(startDelimiter) + startDelimiter.length);
    return content.substring(0, content.lastIndexOf(endDelimiter));
}

export function convertFileToPackage(filePath: string): string {
    const lastIndex = filePath.lastIndexOf('.');
    return filePath.substring(0, lastIndex).replace(/\//g, '.').replace(/\\/g, '.');
}

export interface ITestResultService {
    resetResults(tests: Tests): void;
    updateResults(tests: Tests): void;
    updateTestSuiteResults(test: TestSuite): void;
    updateTestFileResults(test: TestFile): void;
    updateTestFolderResults(testFolder: TestFolder): void;
}

export class TestResultService implements ITestResultService {
    public resetResults(tests: Tests): void {
        tests.testFolders.forEach(f => {
            f.functionsDidNotRun = 0;
            f.functionsFailed = 0;
            f.functionsPassed = 0;
            f.passed = null;
            f.status = TestStatus.Unknown;
        });
        tests.testFunctions.forEach(fn => {
            fn.testFunction.passed = null;
            fn.testFunction.time = 0;
            fn.testFunction.message = '';
            fn.testFunction.traceback = '';
            fn.testFunction.status = TestStatus.Unknown;
            fn.testFunction.functionsFailed = 0;
            fn.testFunction.functionsPassed = 0;
            fn.testFunction.functionsDidNotRun = 0;
        });
        tests.testSuits.forEach(suite => {
            suite.testSuite.passed = null;
            suite.testSuite.time = 0;
            suite.testSuite.status = TestStatus.Unknown;
            suite.testSuite.functionsFailed = 0;
            suite.testSuite.functionsPassed = 0;
            suite.testSuite.functionsDidNotRun = 0;
        });
        tests.testFiles.forEach(testFile => {
            testFile.passed = null;
            testFile.time = 0;
            testFile.status = TestStatus.Unknown;
            testFile.functionsFailed = 0;
            testFile.functionsPassed = 0;
            testFile.functionsDidNotRun = 0;
        });
    }
    public updateResults(tests: Tests): void {
        tests.testFiles.forEach(test => this.updateTestFileResults(test));
        tests.testFolders.forEach(folder => this.updateTestFolderResults(folder));
    }
    public updateTestSuiteResults(test: TestSuite): void {
        this.updateTestSuiteAndFileResults(test);
    }
    public updateTestFileResults(test: TestFile): void {
        this.updateTestSuiteAndFileResults(test);
    }
    public updateTestFolderResults(testFolder: TestFolder): void {
        let allFilesPassed = true;
        let allFilesRan = true;

        testFolder.testFiles.forEach(fl => {
            if (allFilesPassed && typeof fl.passed === 'boolean') {
                if (!fl.passed) {
                    allFilesPassed = false;
                }
            } else {
                allFilesRan = false;
            }

            testFolder.functionsFailed += fl.functionsFailed;
            testFolder.functionsPassed += fl.functionsPassed;
        });

        let allFoldersPassed = true;
        let allFoldersRan = true;

        testFolder.folders.forEach(folder => {
            this.updateTestFolderResults(folder);
            if (allFoldersPassed && typeof folder.passed === 'boolean') {
                if (!folder.passed) {
                    allFoldersPassed = false;
                }
            } else {
                allFoldersRan = false;
            }

            testFolder.functionsFailed += folder.functionsFailed;
            testFolder.functionsPassed += folder.functionsPassed;
        });

        if (allFilesRan && allFoldersRan) {
            testFolder.passed = allFilesPassed && allFoldersPassed;
            testFolder.status = testFolder.passed ? TestStatus.Idle : TestStatus.Fail;
        } else {
            testFolder.passed = null;
            testFolder.status = TestStatus.Unknown;
        }
    }
    private updateTestSuiteAndFileResults(test: TestSuite | TestFile): void {
        let totalTime = 0;
        let allFunctionsPassed = true;
        let allFunctionsRan = true;

        test.functions.forEach(fn => {
            totalTime += fn.time;
            if (typeof fn.passed === 'boolean') {
                if (fn.passed) {
                    test.functionsPassed += 1;
                } else {
                    test.functionsFailed += 1;
                    allFunctionsPassed = false;
                }
            } else {
                allFunctionsRan = false;
            }
        });

        let allSuitesPassed = true;
        let allSuitesRan = true;

        test.suites.forEach(suite => {
            this.updateTestSuiteResults(suite);
            totalTime += suite.time;
            if (allSuitesRan && typeof suite.passed === 'boolean') {
                if (!suite.passed) {
                    allSuitesPassed = false;
                }
            } else {
                allSuitesRan = false;
            }

            test.functionsFailed += suite.functionsFailed;
            test.functionsPassed += suite.functionsPassed;
        });

        test.time = totalTime;
        if (allSuitesRan && allFunctionsRan) {
            test.passed = allFunctionsPassed && allSuitesPassed;
            test.status = test.passed ? TestStatus.Idle : TestStatus.Error;
        } else {
            test.passed = null;
            test.status = TestStatus.Unknown;
        }
    }
}
export function updateResults(tests: Tests) {
    new TestResultService().updateResults(tests);
}

export interface ITestsHelper {
    flattenTestFiles(testFiles: TestFile[]): Tests;
    placeTestFilesIntoFolders(tests: Tests): void;
}

export interface ITestVisitor {
    visitTestFunction(testFunction: TestFunction): void;
    visitTestSuite(testSuite: TestSuite): void;
    visitTestFile(testFile: TestFile): void;
}

export class TestFlatteningVisitor implements ITestVisitor {
    // tslint:disable-next-line:variable-name
    private _flattedTestFunctions = new Map<string, FlattenedTestFunction>();
    // tslint:disable-next-line:variable-name
    private _flattenedTestSuites = new Map<string, FlattenedTestSuite>();
    public get flattenedTestFunctions(): Readonly<FlattenedTestFunction[]> {
        return [...this._flattedTestFunctions.values()];
    }
    public get flattenedTestSuites(): Readonly<FlattenedTestSuite[]> {
        return [...this._flattenedTestSuites.values()];
    }
    // tslint:disable-next-line:no-empty
    public visitTestFunction(testFunction: TestFunction): void { }
    // tslint:disable-next-line:no-empty
    public visitTestSuite(testSuite: TestSuite): void { }
    public visitTestFile(testFile: TestFile): void {
        // sample test_three (file name without extension and all / replaced with ., meaning this is the package)
        const packageName = convertFileToPackage(testFile.name);

        testFile.functions.forEach(fn => this.addTestFunction(fn, testFile, packageName));
        testFile.suites.forEach(suite => this.visitTestSuiteOfAFile(suite, testFile));
    }
    private visitTestSuiteOfAFile(testSuite: TestSuite, parentTestFile: TestFile): void {
        testSuite.functions.forEach(fn => this.visitTestFunctionOfASuite(fn, testSuite, parentTestFile));
        testSuite.suites.forEach(suite => this.visitTestSuiteOfAFile(suite, parentTestFile));
        this.addTestSuite(testSuite, parentTestFile);
    }
    private visitTestFunctionOfASuite(testFunction: TestFunction, parentTestSuite: TestSuite, parentTestFile: TestFile) {
        const key = `Function:${testFunction.name},Suite:${parentTestSuite.name},SuiteXmlName:${parentTestSuite.xmlName},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattenedTestSuites.has(key)) {
            return;
        }
        const flattenedFunction = { testFunction, xmlClassName: parentTestSuite.xmlName, parentTestFile, parentTestSuite };
        this._flattedTestFunctions.set(key, flattenedFunction);
    }
    private addTestSuite(testSuite: TestSuite, parentTestFile: TestFile) {
        const key = `Suite:${testSuite.name},SuiteXmlName:${testSuite.xmlName},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattenedTestSuites.has(key)) {
            return;
        }
        const flattenedSuite = { parentTestFile, testSuite, xmlClassName: testSuite.xmlName };
        this._flattenedTestSuites.set(key, flattenedSuite);
    }
    private addTestFunction(testFunction: TestFunction, parentTestFile: TestFile, parentTestPackage: string) {
        const key = `Function:${testFunction.name},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattedTestFunctions.has(key)) {
            return;
        }
        const flattendFunction = { testFunction, xmlClassName: parentTestPackage, parentTestFile };
        this._flattedTestFunctions.set(key, flattendFunction);
    }
}

// tslint:disable-next-line:max-classes-per-file
export class TestFolderGenerationVisitor implements ITestVisitor {
    // tslint:disable-next-line:variable-name
    private _testFolders: TestFolder[] = [];
    // tslint:disable-next-line:variable-name
    private _rootTestFolders: TestFolder[] = [];
    private folderMap = new Map<string, TestFolder>();
    public get testFolders(): Readonly<TestFolder[]> {
        return [...this._testFolders];
    }
    public get rootTestFolders(): Readonly<TestFolder[]> {
        return [...this._rootTestFolders];
    }
    // tslint:disable-next-line:no-empty
    public visitTestFunction(testFunction: TestFunction): void { }
    // tslint:disable-next-line:no-empty
    public visitTestSuite(testSuite: TestSuite): void { }
    public visitTestFile(testFile: TestFile): void {
        // First get all the unique folders
        const folders: string[] = [];
        const dir = path.dirname(testFile.name);
        if (this.folderMap.has(dir)) {
            const folder = this.folderMap.get(dir);
            folder.testFiles.push(testFile);
            return;
        }

        dir.split(path.sep).reduce((accumulatedPath, currentName, index) => {
            let newPath = currentName;
            let parentFolder: TestFolder;
            if (accumulatedPath.length > 0) {
                parentFolder = this.folderMap.get(accumulatedPath);
                newPath = path.join(accumulatedPath, currentName);
            }
            if (!this.folderMap.has(newPath)) {
                const testFolder: TestFolder = { name: newPath, testFiles: [], folders: [], nameToRun: newPath, time: 0 };
                this.folderMap.set(newPath, testFolder);
                if (parentFolder) {
                    parentFolder.folders.push(testFolder);
                } else {
                    this._rootTestFolders.push(testFolder);
                }
                this._testFolders.push(testFolder);
            }
            return newPath;
        }, '');

        // tslint:disable-next-line:no-non-null-assertion
        this.folderMap.get(dir)!.testFiles.push(testFile);
    }
}

// tslint:disable-next-line:max-classes-per-file
export class TestsHelper implements ITestsHelper {
    public flattenTestFiles(testFiles: TestFile[]): Tests {
        const flatteningVisitor = new TestFlatteningVisitor();
        testFiles.forEach(testFile => flatteningVisitor.visitTestFile(testFile));

        const tests = <Tests>{
            testFiles: testFiles,
            testFunctions: flatteningVisitor.flattenedTestFunctions,
            testSuits: flatteningVisitor.flattenedTestSuites,
            testFolders: [],
            rootTestFolders: [],
            summary: { passed: 0, failures: 0, errors: 0, skipped: 0 }
        };

        this.placeTestFilesIntoFolders(tests);

        return tests;
    }
    public placeTestFilesIntoFolders(tests: Tests): void {
        // First get all the unique folders
        const folders: string[] = [];
        tests.testFiles.forEach(file => {
            const dir = path.dirname(file.name);
            if (folders.indexOf(dir) === -1) {
                folders.push(dir);
            }
        });

        tests.testFolders = [];
        const folderMap = new Map<string, TestFolder>();
        folders.sort();

        folders.forEach(dir => {
            dir.split(path.sep).reduce((parentPath, currentName, index, values) => {
                let newPath = currentName;
                let parentFolder: TestFolder;
                if (parentPath.length > 0) {
                    parentFolder = folderMap.get(parentPath);
                    newPath = path.join(parentPath, currentName);
                }
                if (!folderMap.has(newPath)) {
                    const testFolder: TestFolder = { name: newPath, testFiles: [], folders: [], nameToRun: newPath, time: 0 };
                    folderMap.set(newPath, testFolder);
                    if (parentFolder) {
                        parentFolder.folders.push(testFolder);
                    } else {
                        tests.rootTestFolders.push(testFolder);
                    }
                    tests.testFiles.filter(fl => path.dirname(fl.name) === newPath).forEach(testFile => {
                        testFolder.testFiles.push(testFile);
                    });
                    tests.testFolders.push(testFolder);
                }
                return newPath;
            }, '');
        });
    }
}

export function flattenTestFiles(testFiles: TestFile[]): Tests {
    return new TestsHelper().flattenTestFiles(testFiles);
}

export function resetTestResults(tests: Tests) {
    new TestResultService().resetResults(tests);
}
