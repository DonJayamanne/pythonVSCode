'use strict';

import * as vscode from 'vscode';
import {CodeLensProvider, TextDocument, CancellationToken, CodeLens, SymbolInformation} from 'vscode';
import * as telemetryContracts from '../common/telemetryContracts';

export class TestResultsCodeLensProvider implements CodeLensProvider {
    constructor(private symbolProvider: vscode.DocumentSymbolProvider) {
        // The command has been defined in the package.json file
        // Now provide the implementation of the command with  registerCommand
        // The commandId parameter must match the command field in package.json
        vscode.commands.registerCommand('extension.sayHello', () => {
            // The code you place here will be executed every time your command is executed

            // Display a message box to the user
            vscode.window.showInformationMessage('Hello World!');
            vscode.commands.executeCommand('vscode.executeCodeLensProvider', vscode.window.activeTextEditor.document.uri)
        });

    }


    public provideCodeLenses(document: TextDocument, token: CancellationToken): Thenable<CodeLens[]> {
        let promise = this.symbolProvider.provideDocumentSymbols(document, token) as PromiseLike<SymbolInformation[]>;
        return promise.then(symbols => {
            return symbols.filter(symbol => {
                return symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Class;
            }).map(symbol => {
                let lens = new CodeLens(symbol.location.range);//, { command: 'python.sortImports', title: 'Wow, 1, 2, 3', arguments: [] });
                return lens;
                // return <CodeLens>{ range: symbol.location.range, isResolved: false } as CodeLens;
            });
        });
    }

    public resolveCodeLens(codeLens: CodeLens, token: CancellationToken): Thenable<CodeLens> {
        return new Promise<CodeLens>(resolve => {
            codeLens.isResolved = true;
            codeLens.command = { command: 'extension.sayHello', title: 'Wow, 1, 2, 3', arguments: [] };
            resolve(codeLens);
        });
        // return codeLens;
    }
}
