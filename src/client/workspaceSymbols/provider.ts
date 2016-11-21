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

    provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        if (!pythonSettings.workspaceSymbols.enabled) {
            return Promise.resolve([]);
        }
        return fsExistsAsync(pythonSettings.workspaceSymbols.tagFilePath).then(exits => {
            let def = createDeferred<any>();
            if (exits) {
                def.resolve();
            }
            else {
                vscode.commands.executeCommand(Commands.Build_Workspace_Symbols, false, token).then(() => def.resolve(), reason => def.reject(reason));
            }

            return def.promise
                .then(() => parseTags(query, token))
                .then(items => {
                    if (!Array.isArray(items)) {
                        return [];
                    }
                    return items.map(item => new vscode.SymbolInformation(item.symbolName,
                        item.symbolKind, '',
                        new vscode.Location(vscode.Uri.file(item.fileName), item.position)));
                });
        });
    }
}
