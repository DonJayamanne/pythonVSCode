'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryHelper from '../common/telemetry';
import * as telemetryContracts from '../common/telemetryContracts';
import { extractSignatureAndDocumentation } from './jediHelpers';
import { EOL } from 'os';
import { PythonSettings } from '../common/configSettings';
import { SnippetString } from 'vscode';

const pythonSettings = PythonSettings.getInstance();

export class PythonCompletionItemProvider implements vscode.CompletionItemProvider {
    private jediProxyHandler: proxy.JediProxyHandler<proxy.ICompletionResult>;

    public constructor(context: vscode.ExtensionContext, jediProxy: proxy.JediProxy = null) {
        this.jediProxyHandler = new proxy.JediProxyHandler(context, jediProxy);
    }
    private static parseData(data: proxy.ICompletionResult): vscode.CompletionItem[] {
        if (data && data.items.length > 0) {
            return data.items.map(item => {
                const sigAndDocs = extractSignatureAndDocumentation(item);
                let completionItem = new vscode.CompletionItem(item.text);
                completionItem.kind = item.type;
                completionItem.documentation = sigAndDocs[1].length === 0 ? item.description : sigAndDocs[1];
                completionItem.detail = sigAndDocs[0].split(/\r?\n/).join('');
                if (pythonSettings.autoComplete.addBrackets === true &&
                    (item.kind === vscode.SymbolKind.Function || item.kind === vscode.SymbolKind.Method)) {
                    completionItem.insertText = new SnippetString(item.text).appendText("(").appendTabstop().appendText(")");
                }

                // ensure the built in memebers are at the bottom
                completionItem.sortText = (completionItem.label.startsWith('__') ? 'z' : (completionItem.label.startsWith('_') ? 'y' : '__')) + completionItem.label;
                return completionItem;
            });
        }
        return [];
    }
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
        if (position.character <= 0) {
            return Promise.resolve([]);
        }
        const filename = document.fileName;
        const lineText = document.lineAt(position.line).text;
        if (lineText.match(/^\s*\/\//)) {
            return Promise.resolve([]);
        }
        // If starts with a comment, then return
        if (lineText.trim().startsWith('#')) {
            return Promise.resolve([]);
        }
        // If starts with a """ (possible doc string), then return
        if (lineText.trim().startsWith('"""')) {
            return Promise.resolve([]);
        }
        const type = proxy.CommandType.Completions;
        const columnIndex = position.character;

        const source = document.getText();
        const cmd: proxy.ICommand<proxy.ICommandResult> = {
            command: type,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line,
            source: source
        };

        const timer = new telemetryHelper.Delays();
        return this.jediProxyHandler.sendCommand(cmd, token).then(data => {
            timer.stop();
            telemetryHelper.sendTelemetryEvent(telemetryContracts.IDE.Completion, {}, timer.toMeasures());
            const completions = PythonCompletionItemProvider.parseData(data);
            return completions;
        });
    }
}