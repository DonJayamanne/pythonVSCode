'use strict';

import * as vscode from 'vscode';
import {CodeLensProvider, TextDocument, CancellationToken, CodeLens, SymbolInformation} from 'vscode';
import * as telemetryContracts from '../../common/telemetryContracts';
import {Tests, TestsToRun} from '../common/contracts';
import * as constants from '../../common/constants';
import {getDiscoveredTests} from '../common/testUtils';

interface CodeLensData {
    symbolKind: vscode.SymbolKind;
    symbolName: string;
    fileName: string;
}

export class TestFileCodeLensProvider implements CodeLensProvider {
    private codeLensInfo: Map<number, CodeLensData>;
    constructor() {
        this.codeLensInfo = new Map<number, CodeLensData>();
    }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): Thenable<CodeLens[]> {
        let testItems = getDiscoveredTests();
        if (!testItems || testItems.testFiles.length === 0 || testItems.testFunctions.length === 0) {
            return Promise.resolve([]);
        }

        let cancelTokenSrc = new vscode.CancellationTokenSource();
        token.onCancellationRequested(() => { cancelTokenSrc.cancel(); });

        // If we're unable to get a list of the methods in this file, then stop trying to build the code lenses
        setTimeout(() => {
            if (!cancelTokenSrc.token.isCancellationRequested) {
                cancelTokenSrc.cancel();
            }
        }, constants.Delays.MaxUnitTestCodeLensDelay);

        return getCodeLenses(document.uri, token, this.codeLensInfo);
    }

}

function getCodeLenses(documentUri: vscode.Uri, token: vscode.CancellationToken, codeLensInfo: Map<number, CodeLensData>) {
    return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', documentUri, token).then((symbols: vscode.SymbolInformation[]) => {
        let codeLenses = [];
        symbols.filter(symbol => {
            return symbol.kind === vscode.SymbolKind.Function ||
                symbol.kind === vscode.SymbolKind.Method ||
                symbol.kind === vscode.SymbolKind.Class;
        }).map(symbol => {

            const item = getCodeLens(documentUri.fsPath, symbol.location.range, symbol.name, symbol.kind);
            if (item) {
                codeLenses.push(item);
            }
        });

        return codeLenses;
    }, reason => {
        if (token.isCancellationRequested) {
            return [];
        }
        return Promise.reject(reason);
    });
}

// Move all of this rubbis into a separate file // too long
const testParametirizedFunction = /.*\[.*\]/g;

function getCodeLens(fileName: string, range: vscode.Range, symbolName: string, symbolKind: vscode.SymbolKind): vscode.CodeLens {
    const tests = getDiscoveredTests();
    if (!tests) {
        return null;
    }

    const file = tests.testFiles.find(file => file.fullPath === fileName);
    if (!file) {
        return null;
    }

    switch (symbolKind) {
        case vscode.SymbolKind.Function:
        case vscode.SymbolKind.Method: {
            // Clean this mess
            // Also remember to look at the test suites and nested test suites
            const fn = file.functions.find(fn => fn.name === symbolName);
            if (fn) {
                return {
                    range: range,
                    isResolved: true,
                    command: {
                        title: constants.Text.CodeLensUnitTest,
                        command: constants.Commands.Tests_Run,
                        arguments: [{ testFunction: [fn] }]
                    }
                };
            }

            // Ok, possible we're dealing with parameterized unit tests
            // If we have [ in the name, then this is a parameterized function
            let functions = file.functions.filter(fn => fn.name.startsWith(symbolName + '[') && fn.name.endsWith(']'));

            switch (functions.length) {
                case 0: {
                    return null;
                }
                case 1: {
                    return {
                        range: range,
                        isResolved: true,
                        command: {
                            title: constants.Text.CodeLensUnitTest,
                            command: constants.Commands.Tests_Run,
                            arguments: [{ testFunction: functions }]
                        }
                    };
                }
                default: {
                    // Find all flattened functions
                    return {
                        range: range,
                        isResolved: true,
                        command: {
                            title: constants.Text.CodeLensUnitTest + ' (Multiple)',
                            command: constants.Commands.Tests_Picker_UI,
                            arguments: [fileName, functions]
                        }
                    };
                }
            }
        }
        case vscode.SymbolKind.Class: {
            const cls = file.suites.find(cls => cls.name === symbolName);
            if (!cls) {
                return null;
            }
            return {
                range: range,
                isResolved: true,
                command: {
                    title: constants.Text.CodeLensUnitTest,
                    command: constants.Commands.Tests_Run,
                    arguments: [{ testSuite: [cls] }]
                }
            };
        }
    }

    return null;
}
