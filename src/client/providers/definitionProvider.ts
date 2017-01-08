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
            var definitionResource = vscode.Uri.file(data.definition.fileName);
            var range = new vscode.Range(data.definition.lineIndex, data.definition.columnIndex, data.definition.lineIndex, data.definition.columnIndex);

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
