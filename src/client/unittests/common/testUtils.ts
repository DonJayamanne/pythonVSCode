import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { commands, Uri, window, workspace } from 'vscode';
import * as constants from '../../common/constants';
import { IUnitTestSettings, Product } from '../../common/types';
import { CommandSource } from './constants';
import { TestFlatteningVisitor } from './testVisitors/flatteningVisitor';
import { ITestsHelper, ITestVisitor, TestFile, TestFolder, TestProvider, Tests, TestSettingsPropertyNames, TestsToRun, UnitTestProduct } from './types';

export async function selectTestWorkspace(): Promise<Uri | undefined> {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return undefined;
    } else if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    } else {
        // tslint:disable-next-line:no-any prefer-type-cast
        const workspaceFolder = await (window as any).showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspaceFolder ? workspaceFolder.uri : undefined;
    }
}

export function displayTestErrorMessage(message: string) {
    window.showErrorMessage(message, constants.Button_Text_Tests_View_Output).then(action => {
        if (action === constants.Button_Text_Tests_View_Output) {
            commands.executeCommand(constants.Commands.Tests_ViewOutput, undefined, CommandSource.ui);
        }
    });

}

export function extractBetweenDelimiters(content: string, startDelimiter: string, endDelimiter: string): string {
    content = content.substring(content.indexOf(startDelimiter) + startDelimiter.length);
    return content.substring(0, content.lastIndexOf(endDelimiter));
}

export function convertFileToPackage(filePath: string): string {
    const lastIndex = filePath.lastIndexOf('.');
    return filePath.substring(0, lastIndex).replace(/\//g, '.').replace(/\\/g, '.');
}

@injectable()
export class TestsHelper implements ITestsHelper {
    constructor(@inject(ITestVisitor) @named('TestFlatteningVisitor') private flatteningVisitor: TestFlatteningVisitor) { }
    public parseProviderName(product: UnitTestProduct): TestProvider {
        switch (product) {
            case Product.nosetest: return 'nosetest';
            case Product.pytest: return 'pytest';
            case Product.unittest: return 'unittest';
            default: {
                throw new Error(`Unknown Test Product ${product}`);
            }
        }
    }
    public parseProduct(provider: TestProvider): UnitTestProduct {
        switch (provider) {
            case 'nosetest': return Product.nosetest;
            case 'pytest': return Product.pytest;
            case 'unittest': return Product.unittest;
            default: {
                throw new Error(`Unknown Test Provider ${provider}`);
            }
        }
    }
    public getSettingsPropertyNames(product: UnitTestProduct): TestSettingsPropertyNames {
        const id = this.parseProviderName(product);
        switch (id) {
            case 'pytest': {
                return {
                    argsName: 'pyTestArgs' as keyof IUnitTestSettings,
                    pathName: 'pyTestPath' as keyof IUnitTestSettings,
                    enabledName: 'pyTestEnabled' as keyof IUnitTestSettings
                };
            }
            case 'nosetest': {
                return {
                    argsName: 'nosetestArgs' as keyof IUnitTestSettings,
                    pathName: 'nosetestPath' as keyof IUnitTestSettings,
                    enabledName: 'nosetestsEnabled' as keyof IUnitTestSettings
                };
            }
            case 'unittest': {
                return {
                    argsName: 'unittestArgs' as keyof IUnitTestSettings,
                    enabledName: 'unittestEnabled' as keyof IUnitTestSettings
                };
            }
            default: {
                throw new Error(`Unknown Test Provider '${product}'`);
            }
        }
    }
    public flattenTestFiles(testFiles: TestFile[]): Tests {
        testFiles.forEach(testFile => this.flatteningVisitor.visitTestFile(testFile));

        // tslint:disable-next-line:no-object-literal-type-assertion
        const tests = <Tests>{
            testFiles: testFiles,
            testFunctions: this.flatteningVisitor.flattenedTestFunctions,
            testSuites: this.flatteningVisitor.flattenedTestSuites,
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
                let parentFolder: TestFolder | undefined;
                if (parentPath.length > 0) {
                    parentFolder = folderMap.get(parentPath);
                    newPath = path.join(parentPath, currentName);
                }
                if (!folderMap.has(newPath)) {
                    const testFolder: TestFolder = { name: newPath, testFiles: [], folders: [], nameToRun: newPath, time: 0 };
                    folderMap.set(newPath, testFolder);
                    if (parentFolder) {
                        parentFolder!.folders.push(testFolder);
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
    public parseTestName(name: string, rootDirectory: string, tests: Tests): TestsToRun | undefined {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: We need a better way to match (currently we have raw name, name, xmlname, etc = which one do we.
        // Use to identify a file given the full file name, similarly for a folder and function.
        // Perhaps something like a parser or methods like TestFunction.fromString()... something).
        if (!tests) { return undefined; }
        const absolutePath = path.isAbsolute(name) ? name : path.resolve(rootDirectory, name);
        const testFolders = tests.testFolders.filter(folder => folder.nameToRun === name || folder.name === name || folder.name === absolutePath);
        if (testFolders.length > 0) { return { testFolder: testFolders }; }

        const testFiles = tests.testFiles.filter(file => file.nameToRun === name || file.name === name || file.fullPath === absolutePath);
        if (testFiles.length > 0) { return { testFile: testFiles }; }

        const testFns = tests.testFunctions.filter(fn => fn.testFunction.nameToRun === name || fn.testFunction.name === name).map(fn => fn.testFunction);
        if (testFns.length > 0) { return { testFunction: testFns }; }

        // Just return this as a test file.
        // tslint:disable-next-line:no-object-literal-type-assertion
        return <TestsToRun>{ testFile: [{ name: name, nameToRun: name, functions: [], suites: [], xmlName: name, fullPath: '', time: 0 }] };
    }
}
