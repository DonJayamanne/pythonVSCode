'use strict';

// tslint:disable:no-object-literal-type-assertion

import { CancellationToken, CancellationTokenSource, CodeLens, CodeLensProvider, Event, EventEmitter, Position, Range, SymbolInformation, SymbolKind, TextDocument, Uri, workspace } from 'vscode';
import * as constants from '../../common/constants';
import { PythonSymbolProvider } from '../../providers/symbolProvider';
import { CommandSource } from '../common/constants';
import { ITestCollectionStorageService, TestFile, TestFunction, TestStatus, TestsToRun, TestSuite } from '../common/types';

type FunctionsAndSuites = {
    functions: TestFunction[];
    suites: TestSuite[];
};

export class TestFileCodeLensProvider implements CodeLensProvider {
    // tslint:disable-next-line:variable-name
    constructor(private _onDidChange: EventEmitter<void>,
        private symbolProvider: PythonSymbolProvider,
        private testCollectionStorage: ITestCollectionStorageService) {
    }

    get onDidChangeCodeLenses(): Event<void> {
        return this._onDidChange.event;
    }

    public async provideCodeLenses(document: TextDocument, token: CancellationToken) {
        const wkspace = workspace.getWorkspaceFolder(document.uri);
        if (!wkspace) {
            return [];
        }
        const testItems = this.testCollectionStorage.getTests(wkspace.uri);
        if (!testItems || testItems.testFiles.length === 0 || testItems.testFunctions.length === 0) {
            return [];
        }

        const cancelTokenSrc = new CancellationTokenSource();
        token.onCancellationRequested(() => { cancelTokenSrc.cancel(); });

        // Strop trying to build the code lenses if unable to get a list of
        // symbols in this file afrer x time.
        setTimeout(() => {
            if (!cancelTokenSrc.token.isCancellationRequested) {
                cancelTokenSrc.cancel();
            }
        }, constants.Delays.MaxUnitTestCodeLensDelay);

        return this.getCodeLenses(document, token, this.symbolProvider);
    }

    public resolveCodeLens(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
        codeLens.command = { command: 'python.runtests', title: 'Test' };
        return Promise.resolve(codeLens);
    }

    private async getCodeLenses(document: TextDocument, token: CancellationToken, symbolProvider: PythonSymbolProvider) {
        const wkspace = workspace.getWorkspaceFolder(document.uri);
        if (!wkspace) {
            return [];
        }
        const tests = this.testCollectionStorage.getTests(wkspace.uri);
        if (!tests) {
            return [];
        }
        const file = tests.testFiles.find(item => item.fullPath === document.uri.fsPath);
        if (!file) {
            return [];
        }
        const allFuncsAndSuites = getAllTestSuitesAndFunctionsPerFile(file);

        return symbolProvider.provideDocumentSymbolsForInternalUse(document, token)
            .then((symbols: SymbolInformation[]) => {
                return symbols.filter(symbol => {
                    return symbol.kind === SymbolKind.Function ||
                        symbol.kind === SymbolKind.Method ||
                        symbol.kind === SymbolKind.Class;
                }).map(symbol => {
                    // This is bloody crucial, if the start and end columns are the same
                    // then vscode goes bonkers when ever you edit a line (start scrolling magically).
                    const range = new Range(symbol.location.range.start,
                        new Position(symbol.location.range.end.line,
                            symbol.location.range.end.character + 1));

                    return this.getCodeLens(document.uri, allFuncsAndSuites,
                        range, symbol.name, symbol.kind, symbol.containerName);
                }).reduce((previous, current) => previous.concat(current), []).filter(codeLens => codeLens !== null);
            }, reason => {
                if (token.isCancellationRequested) {
                    return [];
                }
                return Promise.reject(reason);
            });
    }

    private getCodeLens(file: Uri, allFuncsAndSuites: FunctionsAndSuites,
        range: Range, symbolName: string, symbolKind: SymbolKind, symbolContainer: string): CodeLens[] {

        switch (symbolKind) {
            case SymbolKind.Function:
            case SymbolKind.Method: {
                return getFunctionCodeLens(file, allFuncsAndSuites, symbolName, range, symbolContainer);
            }
            case SymbolKind.Class: {
                const cls = allFuncsAndSuites.suites.find(item => item.name === symbolName);
                if (!cls) {
                    return null;
                }
                return [
                    new CodeLens(range, {
                        title: getTestStatusIcon(cls.status) + constants.Text.CodeLensRunUnitTest,
                        command: constants.Commands.Tests_Run,
                        arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testSuite: [cls] }]
                    }),
                    new CodeLens(range, {
                        title: getTestStatusIcon(cls.status) + constants.Text.CodeLensDebugUnitTest,
                        command: constants.Commands.Tests_Debug,
                        arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testSuite: [cls] }]
                    })
                ];
            }
            default: {
                return [];
            }
        }
    }
}

function getTestStatusIcon(status?: TestStatus): string {
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
    const statuses: string[] = [];
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
function getFunctionCodeLens(file: Uri, functionsAndSuites: FunctionsAndSuites,
    symbolName: string, range: Range, symbolContainer: string): CodeLens[] {

    let fn: TestFunction | undefined;
    if (symbolContainer.length === 0) {
        fn = functionsAndSuites.functions.find(func => func.name === symbolName);
    } else {
        // Assume single levels for now.
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
                arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testFunction: [fn] }]
            }),
            new CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testFunction: [fn] }]
            })
        ];
    }

    // Ok, possible we're dealing with parameterized unit tests.
    // If we have [ in the name, then this is a parameterized function.
    const functions = functionsAndSuites.functions.filter(func => func.name.startsWith(`${symbolName}[`) && func.name.endsWith(']'));
    if (functions.length === 0) {
        return [];
    }
    if (functions.length === 0) {
        return [
            new CodeLens(range, {
                title: constants.Text.CodeLensRunUnitTest,
                command: constants.Commands.Tests_Run,
                arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testFunction: functions }]
            }),
            new CodeLens(range, {
                title: constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testFunction: functions }]
            })
        ];
    }

    // Find all flattened functions.
    return [
        new CodeLens(range, {
            title: `${getTestStatusIcons(functions)}${constants.Text.CodeLensRunUnitTest} (Multiple)`,
            command: constants.Commands.Tests_Picker_UI,
            arguments: [undefined, CommandSource.codelens, file, functions]
        }),
        new CodeLens(range, {
            title: `${getTestStatusIcons(functions)}${constants.Text.CodeLensDebugUnitTest} (Multiple)`,
            command: constants.Commands.Tests_Picker_UI_Debug,
            arguments: [undefined, CommandSource.codelens, file, functions]
        })
    ];
}

function getAllTestSuitesAndFunctionsPerFile(testFile: TestFile): FunctionsAndSuites {
    // tslint:disable-next-line:prefer-type-cast
    const all = { functions: testFile.functions, suites: [] as TestSuite[] };
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
