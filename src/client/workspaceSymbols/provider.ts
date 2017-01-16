import * as vscode from 'vscode';
import { Generator } from './generator';
import { PythonSettings } from '../common/configSettings';
import { parseTags } from './parser';
import { fsExistsAsync } from '../common/utils';
import { createDeferred } from '../common/helpers';
import { Commands } from '../common/constants';
const pythonSettings = PythonSettings.getInstance();

export class WorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    public constructor(private tagGenerator: Generator, private outputChannel: vscode.OutputChannel) {
    }

    async provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
        if (!pythonSettings.workspaceSymbols.enabled) {
            return [];
        }
        // check whether tag file needs to be built
        const tagFileExists = await fsExistsAsync(pythonSettings.workspaceSymbols.tagFilePath);
        if (!tagFileExists) {
            await vscode.commands.executeCommand(Commands.Build_Workspace_Symbols, false, token);
        }
        // load tags
        const items = await parseTags(query, token);
        if (!Array.isArray(items)) {
            return [];
        }
        return items.map(item => new vscode.SymbolInformation(
            item.symbolName, item.symbolKind, '',
            new vscode.Location(vscode.Uri.file(item.fileName), item.position)
        ));
    }
}
