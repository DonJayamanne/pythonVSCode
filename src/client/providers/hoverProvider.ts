'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryContracts from "../common/telemetryContracts";
import { EOL } from 'os';

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

function extractHoverInfo(definition: proxy.IAutoCompleteItem): vscode.Hover {
    // Somtimes the signature of the function, class (whatever) is broken into multiple lines
    // Here's an example
    // ```python
    // def __init__(self, group=None, target=None, name=None,
    //              args=(), kwargs=None, verbose=None):
    //     """This constructor should always be called with keyword arguments. Arguments are:

    //     *group* should be None; reserved for future extension when a ThreadGroup
    //     class is implemented.
    ///    """
    /// ```
    const txt = definition.description || definition.text;
    const rawDocString = typeof definition.raw_docstring === 'string' ? definition.raw_docstring.trim() : '';
    const firstLineOfRawDocString = rawDocString.length > 0 ? rawDocString.split(EOL)[0] : '';
    const lines = txt.split(EOL);
    const startIndexOfDocString = firstLineOfRawDocString === '' ? -1 : lines.findIndex(line => line.indexOf(firstLineOfRawDocString) === 0);

    let signatureLines = startIndexOfDocString === -1 ? [lines.shift()] : lines.splice(0, startIndexOfDocString);
    let signature = signatureLines.filter(line => line.trim().length > 0).join(EOL);

    switch (definition.type) {
        case vscode.CompletionItemKind.Constructor:
        case vscode.CompletionItemKind.Function:
        case vscode.CompletionItemKind.Method: {
            signature = 'def ' + signature;
            break;
        }
        case vscode.CompletionItemKind.Class: {
            signature = 'class ' + signature;
            break;
        }
    }
    const hoverInfo: vscode.MarkedString[] = [{ language: 'python', value: signature }];
    if (lines.some(line => line.trim().length > 0)) {
        hoverInfo.push(lines.join(EOL).trim().replace(/^\s+|\s+$/g, '').trim());
    }
    return new vscode.Hover(hoverInfo);
}