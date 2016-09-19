'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryContracts from '../common/telemetryContracts';

export class PythonCompletionItemProvider implements vscode.CompletionItemProvider {
    private jediProxyHandler: proxy.JediProxyHandler<proxy.ICompletionResult, vscode.CompletionItem[]>;

    public constructor(context: vscode.ExtensionContext) {
        this.jediProxyHandler = new proxy.JediProxyHandler(context, [], PythonCompletionItemProvider.parseData);
    }
    private static parseData(data: proxy.ICompletionResult): vscode.CompletionItem[] {
        if (data && data.items.length > 0) {
            return data.items.map(item => {
                let completionItem = new vscode.CompletionItem(item.text);
                completionItem.kind = item.type;
                completionItem.documentation = item.description;
                // ensure the built in memebers are at the bottom
                completionItem.sortText = (completionItem.label.startsWith('__') ? 'z' : (completionItem.label.startsWith('_') ? 'y' : '__')) + completionItem.label;
                return completionItem;
            });
        }
        return [];
    }
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
        return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
            const filename = document.fileName;
            if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
                return resolve([]);
            }
            if (position.character <= 0) {
                return resolve([]);
            }

            const txt = document.getText(new vscode.Range(new vscode.Position(position.line, position.character - 1), position));
            const type = proxy.CommandType.Completions;
            const columnIndex = position.character;

            const source = document.getText();
            const cmd: proxy.ICommand<proxy.ICommandResult> = {
                telemetryEvent: telemetryContracts.IDE.Completion,
                command: type,
                fileName: filename,
                columnIndex: columnIndex,
                lineIndex: position.line,
                source: source
            };

            this.jediProxyHandler.sendCommand(cmd, resolve, token);
        });
    }
}