'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryContracts from "../common/telemetryContracts";
import { highlightCode } from './jediHelpers';

export class PythonHoverProvider implements vscode.HoverProvider {
    private jediProxyHandler: proxy.JediProxyHandler<proxy.IHoverResult>;

    public constructor(context: vscode.ExtensionContext, jediProxy: proxy.JediProxy = null) {
        this.jediProxyHandler = new proxy.JediProxyHandler(context, jediProxy);
    }
    private static parseData(data: proxy.IHoverResult): vscode.Hover {
        let results = [];
        data.items.forEach(item => {
            let { description, signature } = item;
            switch (item.kind) {
                case vscode.SymbolKind.Constructor:
                case vscode.SymbolKind.Function:
                case vscode.SymbolKind.Method: {
                    signature = 'def ' + signature;
                    break;
                }
                case vscode.SymbolKind.Class: {
                    signature = 'class ' + signature;
                    break;
                }
            }
            results.push({ language: 'python', value: signature });
            if (item.description) {
                var descriptionWithHighlightedCode = highlightCode(item.description);
                results.push(descriptionWithHighlightedCode);
            }
        });
        return new vscode.Hover(results);
    }
    public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
        var filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return null;
        }
        if (position.character <= 0) {
            return null;
        }

        var range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return null;
        }

        var cmd: proxy.ICommand<proxy.IDefinitionResult> = {
            command: proxy.CommandType.Hover,
            fileName: filename,
            columnIndex: range.end.character,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }

        const data = await this.jediProxyHandler.sendCommand(cmd, token);
        if (!data || !data.items.length) {
            return;
        }

        return PythonHoverProvider.parseData(data);
    }
}
