'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryContracts from "../common/telemetryContracts";

export class PythonDefinitionProvider implements vscode.DefinitionProvider {
    private jediProxyHandler: proxy.JediProxyHandler<proxy.IDefinitionResult, vscode.Definition>;
    public get JediProxy(): proxy.JediProxy {
        return this.jediProxyHandler.JediProxy;
    }

    public constructor(context: vscode.ExtensionContext) {
        this.jediProxyHandler = new proxy.JediProxyHandler(context);
    }
    private static parseData(data: proxy.IDefinitionResult): vscode.Definition {
        if (data && data.definition) {
            const definition = data.definition;
            const definitionResource = vscode.Uri.file(definition.fileName);
            const range = new vscode.Range(
                definition.range.startLine, definition.range.startColumn,
                definition.range.endLine, definition.range.endColumn);
            return new vscode.Location(definitionResource, range);
        }
        return null;
    }
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Definition> {
        var filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return Promise.resolve(null);
        }
        if (position.character <= 0) {
            return Promise.resolve(null);
        }

        var range = document.getWordRangeAtPosition(position);
        var columnIndex = range.isEmpty ? position.character : range.end.character;
        var cmd: proxy.ICommand<proxy.IDefinitionResult> = {
            command: proxy.CommandType.Definitions,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        return this.jediProxyHandler.sendCommand(cmd, token).then(data => {
            return PythonDefinitionProvider.parseData(data);
        });
    }
}
