'use strict';

import * as vscode from 'vscode';
import {CodeLensProvider, TextDocument, CancellationToken, CodeLens, SymbolInformation} from 'vscode';
import * as telemetryContracts from '../../common/telemetryContracts';
import {Tests, TestFile, TestsToRun, TestSuite, TestFunction} from '../common/contracts';
import * as constants from '../../common/constants';
import {getDiscoveredTests} from '../common/testUtils';

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

        return getCodeLenses(document.uri, token);
    }
}

function getCodeLenses(documentUri: vscode.Uri, token: vscode.CancellationToken): Thenable<CodeLens[]> {
    const tests = getDiscoveredTests();
    if (!tests) {
        return null;
    }
    const file = tests.testFiles.find(file => file.fullPath === documentUri.fsPath);
    if (!file) {
        return Promise.resolve([]);
    }

    return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', documentUri, token)
        .then((symbols: vscode.SymbolInformation[]) => {
            return symbols.filter(symbol => {
                return symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Class;
            }).map(symbol => {
                return getCodeLens(documentUri.fsPath, symbol.location.range, symbol.name, symbol.kind);
            }).filter(codeLens => codeLens !== null);
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
    const allFuncsAndSuites = getAllTestSuitesAndFunctionsPerFile(file);

    switch (symbolKind) {
        case vscode.SymbolKind.Function:
        case vscode.SymbolKind.Method: {
            return getFunctionCodeLens(file.fullPath, allFuncsAndSuites, symbolName, range)
        }
        case vscode.SymbolKind.Class: {
            const cls = allFuncsAndSuites.suites.find(cls => cls.name === symbolName);
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

function getFunctionCodeLens(filePath: string, functionsAndSuites: FunctionsAndSuites,
    symbolName: string, range: vscode.Range): vscode.CodeLens {

    const fn = functionsAndSuites.functions.find(fn => fn.name === symbolName);
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
    let functions = functionsAndSuites.functions.filter(fn => fn.name.startsWith(symbolName + '[') && fn.name.endsWith(']'));
    if (functions.length == 0) {
        return null;
    }
    if (functions.length == 0) {
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

    // Find all flattened functions
    return {
        range: range,
        isResolved: true,
        command: {
            title: constants.Text.CodeLensUnitTest + ' (Multiple)',
            command: constants.Commands.Tests_Picker_UI,
            arguments: [filePath, functions]
        }
    };
}

function getAllTestSuitesAndFunctionsPerFile(testFile: TestFile): FunctionsAndSuites {
    const all = { functions: testFile.functions, suites: testFile.suites };
    testFile.suites.forEach(suite => {
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
        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}