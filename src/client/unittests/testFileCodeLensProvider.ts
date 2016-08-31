'use strict';

import * as vscode from 'vscode';
import {CodeLensProvider, TextDocument, CancellationToken, CodeLens, SymbolInformation} from 'vscode';
import * as telemetryContracts from '../common/telemetryContracts';
import {Tests} from './common/contracts';
import {getDiscoveredTests} from './common/testUtils';

export class TestFileCodeLensProvider implements CodeLensProvider {
    constructor(private context: vscode.ExtensionContext) {
        // The command has been defined in the package.json file
        // Now provide the implementation of the command with  registerCommand
        // The commandId parameter must match the command field in package.json
        vscode.commands.registerCommand('extension.sayHello', () => {
            // The code you place here will be executed every time your command is executed

            // Display a message box to the user
            vscode.window.showInformationMessage('Hello World!');
            vscode.commands.executeCommand('vscode.executeCodeLensProvider', vscode.window.activeTextEditor.document.uri);
        });

    }

    // private _onDidChange = new vscode.EventEmitter<CodeLensProvider>();
    // get onDidChange(): vscode.Event<CodeLensProvider> {
    //     return this._onDidChange.event;
    // }

    // public update() {
    //     this._onDidChange.fire(this);
    // }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): Thenable<CodeLens[]> {
        let testItems = getDiscoveredTests();
        if (!testItems) {
            return Promise.resolve([]);
        }

        let items: CodeLens[] = [];
        return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri).then((symbols: vscode.SymbolInformation[]) => {
            return symbols.filter(symbol => {
                return symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Class;
            }).map(symbol => {
                // let lens = new CodeLens(symbol.location.range);//, { command: 'python.sortImports', title: 'Wow, 1, 2, 3', arguments: [] });
                // return lens;
                return <CodeLens>{ range: symbol.location.range, isResolved: false } as CodeLens;
            });
        });
    }

    private counter = 0;
    public resolveCodeLens(codeLens: CodeLens, token: CancellationToken): Thenable<CodeLens> {
        return new Promise<CodeLens>(resolve => {
            codeLens.isResolved = true;
            codeLens.command = { command: 'extension.sayHello', title: 'Wow ' + this.counter++, arguments: [] };
            resolve(codeLens);
        });
        // return codeLens;
    }
}
