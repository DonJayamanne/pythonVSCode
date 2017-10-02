'use strict';

import * as vscode from 'vscode';
import { CodeLensProvider, TextDocument, CancellationToken, CodeLens, SymbolInformation } from 'vscode';
import { TestFile, TestsToRun, TestSuite, TestFunction, TestStatus } from '../common/contracts';
import * as constants from '../../common/constants';
import { getDiscoveredTests } from '../common/testUtils';
import { PythonSymbolProvider } from '../../providers/symbolProvider';

interface CodeLensData {
    symbolKind: vscode.SymbolKind;
    symbolName: string;
    fileName: string;
}
interface FunctionsAndSuites {
    functions: TestFunction[];
    suites: TestSuite[];
}

export class TestFileCodeLensProvider implements CodeLensProvider {
    constructor(private _onDidChange: vscode.EventEmitter<void>, private symbolProvider: PythonSymbolProvider) {
    }

    get onDidChangeCodeLenses(): vscode.Event<void> {
        return this._onDidChange.event;
    }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): Thenable<CodeLens[]> {
        let testItems = getDiscoveredTests();
        if (!testItems || testItems.testFiles.length === 0 || testItems.testFunctions.length === 0) {
            return Promise.resolve([]);
        }

        let cancelTokenSrc = new vscode.CancellationTokenSource();
        token.onCancellationRequested(() => { cancelTokenSrc.cancel(); });

        // Strop trying to build the code lenses if unable to get a list of
        // symbols in this file afrer x time
        setTimeout(() => {
            if (!cancelTokenSrc.token.isCancellationRequested) {
                cancelTokenSrc.cancel();
            }
        }, constants.Delays.MaxUnitTestCodeLensDelay);

        return getCodeLenses(document, token, this.symbolProvider);
    }

    resolveCodeLens(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
        codeLens.command = { command: 'python.runtests', title: 'Test' };
        return Promise.resolve(codeLens);
    }
}

function getCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken, symbolProvider: PythonSymbolProvider): Thenable<CodeLens[]> {
    const documentUri = document.uri;
    const tests = getDiscoveredTests();
    if (!tests) {
        return null;
    }
    const file = tests.testFiles.find(file => file.fullPath === documentUri.fsPath);
    if (!file) {
        return Promise.resolve([]);
    }
    const allFuncsAndSuites = getAllTestSuitesAndFunctionsPerFile(file);

    return symbolProvider.provideDocumentSymbolsForInternalUse(document, token)
        .then((symbols: vscode.SymbolInformation[]) => {
            return symbols.filter(symbol => {
                return symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Class;
            }).map(symbol => {
                // This is bloody crucial, if the start and end columns are the same
                // then vscode goes bonkers when ever you edit a line (start scrolling magically)
                const range = new vscode.Range(symbol.location.range.start,
                    new vscode.Position(symbol.location.range.end.line,
                        symbol.location.range.end.character + 1));

                return getCodeLens(documentUri.fsPath, allFuncsAndSuites,
                    range, symbol.name, symbol.kind, symbol.containerName);
            }).reduce((previous, current) => previous.concat(current), []).filter(codeLens => codeLens !== null);
        }, reason => {
            if (token.isCancellationRequested) {
                return [];
            }
            return Promise.reject(reason);
        });
}

function getCodeLens(fileName: string, allFuncsAndSuites: FunctionsAndSuites,
    range: vscode.Range, symbolName: string, symbolKind: vscode.SymbolKind, symbolContainer: string): vscode.CodeLens[] {

    switch (symbolKind) {
        case vscode.SymbolKind.Function:
        case vscode.SymbolKind.Method: {
            return getFunctionCodeLens(fileName, allFuncsAndSuites, symbolName, range, symbolContainer);
        }
        case vscode.SymbolKind.Class: {
            const cls = allFuncsAndSuites.suites.find(cls => cls.name === symbolName);
            if (!cls) {
                return null;
            }
            return [
                new CodeLens(range, {
                    title: getTestStatusIcon(cls.status) + constants.Text.CodeLensRunUnitTest,
                    command: constants.Commands.Tests_Run,
                    arguments: [<TestsToRun>{ testSuite: [cls] }]
                }),
                new CodeLens(range, {
                    title: getTestStatusIcon(cls.status) + constants.Text.CodeLensDebugUnitTest,
                    command: constants.Commands.Tests_Debug,
                    arguments: [<TestsToRun>{ testSuite: [cls] }]
                })
            ];
        }
    }

    return null;
}

function getTestStatusIcon(status: TestStatus): string {
    switch (status) {
        case TestStatus.Pass: {
            return '✔ ';
        }
        case TestStatus.Error:
        case TestStatus.Fail: {
            return '✘ ';
        }
        case TestStatus.Skipped: {
            return '⃠ ';
        }
        default: {
            return '';
        }
    }
}

function getTestStatusIcons(fns: TestFunction[]): string {
    let statuses: string[] = [];
    let count = fns.filter(fn => fn.status === TestStatus.Pass).length;
    if (count > 0) {
        statuses.push(`✔ ${count}`);
    }
    count = fns.filter(fn => fn.status === TestStatus.Error || fn.status === TestStatus.Fail).length;
    if (count > 0) {
        statuses.push(`✘ ${count}`);
    }
    count = fns.filter(fn => fn.status === TestStatus.Skipped).length;
    if (count > 0) {
        statuses.push(`⃠ ${count}`);
    }

    return statuses.join(' ');
}
function getFunctionCodeLens(filePath: string, functionsAndSuites: FunctionsAndSuites,
    symbolName: string, range: vscode.Range, symbolContainer: string): vscode.CodeLens[] {

    let fn: TestFunction;
    if (symbolContainer.length === 0) {
        fn = functionsAndSuites.functions.find(fn => fn.name === symbolName);
    }
    else {
        // Assume single levels for now
        functionsAndSuites.suites
            .filter(s => s.name === symbolContainer)
            .forEach(s => {
                const f = s.functions.find(item => item.name === symbolName);
                if (f) {
                    fn = f;
                }
            });
    }

    if (fn) {
        return [
            new CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensRunUnitTest,
                command: constants.Commands.Tests_Run,
                arguments: [<TestsToRun>{ testFunction: [fn] }]
            }),
            new CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [<TestsToRun>{ testFunction: [fn] }]
            })
        ];
    }

    // Ok, possible we're dealing with parameterized unit tests
    // If we have [ in the name, then this is a parameterized function
    let functions = functionsAndSuites.functions.filter(fn => fn.name.startsWith(symbolName + '[') && fn.name.endsWith(']'));
    if (functions.length === 0) {
        return null;
    }
    if (functions.length === 0) {
        return [
            new CodeLens(range, {
                title: constants.Text.CodeLensRunUnitTest,
                command: constants.Commands.Tests_Run,
                arguments: [<TestsToRun>{ testFunction: functions }]
            }),
            new CodeLens(range, {
                title: constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [<TestsToRun>{ testFunction: functions }]
            })
        ];
    }

    // Find all flattened functions
    return [
        new CodeLens(range, {
            title: getTestStatusIcons(functions) + constants.Text.CodeLensRunUnitTest + ' (Multiple)',
            command: constants.Commands.Tests_Picker_UI,
            arguments: [filePath, functions]
        }),
        new CodeLens(range, {
            title: getTestStatusIcons(functions) + constants.Text.CodeLensDebugUnitTest + ' (Multiple)',
            command: constants.Commands.Tests_Picker_UI_Debug,
            arguments: [filePath, functions]
        })
    ];
}

function getAllTestSuitesAndFunctionsPerFile(testFile: TestFile): FunctionsAndSuites {
    const all = { functions: testFile.functions, suites: [] };
    testFile.suites.forEach(suite => {
        all.suites.push(suite);

        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}
function getAllTestSuitesAndFunctions(testSuite: TestSuite): FunctionsAndSuites {
    const all = { functions: [], suites: [] };
    testSuite.functions.forEach(fn => {
        all.functions.push(fn);
    });
    testSuite.suites.forEach(suite => {
        all.suites.push(suite);

        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}