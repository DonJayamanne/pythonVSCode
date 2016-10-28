'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryContracts from "../common/telemetryContracts";
import { extractHoverInfo} from './jediHelpers';

export class PythonHoverProvider implements vscode.HoverProvider {
    private jediProxyHandler: proxy.JediProxyHandler<proxy.ICompletionResult, vscode.Hover>;

    public constructor(context: vscode.ExtensionContext) {
        this.jediProxyHandler = new proxy.JediProxyHandler(context);
    }
    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
        var filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return Promise.resolve();
        }
        if (position.character <= 0) {
            return Promise.resolve();
        }

        var range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return Promise.resolve();
        }
        var columnIndex = range.start.character < range.end.character ? range.start.character + 2 : range.end.character;
        var cmd: proxy.ICommand<proxy.ICompletionResult> = {
            telemetryEvent: telemetryContracts.IDE.HoverDefinition,
            command: proxy.CommandType.Completions,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }

        return this.jediProxyHandler.sendCommand(cmd, token).then(data => {
            if (!data || !Array.isArray(data.items) || data.items.length === 0) {
                return;
            }
            // Find the right items
            const wordUnderCursor = document.getText(range);
            const completionItem = data.items.filter(item => item.text === wordUnderCursor);
            if (completionItem.length === 0) {
                return;
            }
            var definition = completionItem[0];
            var txt = definition.description || definition.text;
            if (typeof txt !== 'string' || txt.length === 0) {
                return;
            }
            if (wordUnderCursor === txt) {
                return;
            }

            return extractHoverInfo(definition);
        });
    }
}
