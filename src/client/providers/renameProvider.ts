'use strict';

import * as vscode from 'vscode';
import * as telemetryContracts from "../common/telemetryContracts";
import {RefactorProxy} from '../refactor/proxy';
import {getWorkspaceEditsFromPatch, getTextEdits} from '../common/editor';
import * as path from 'path';
import {PythonSettings} from '../common/configSettings';

const pythonSettings = PythonSettings.getInstance();
const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
interface RenameResponse {
    results: [{ diff: string }];
}

export class PythonRenameProvider implements vscode.RenameProvider {
    public provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Thenable<vscode.WorkspaceEdit> {
        return vscode.workspace.saveAll(false).then(() => {
            return this.doRename(document, position, newName, token);
        });
    }

    private doRename(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Thenable<vscode.WorkspaceEdit> {
        var filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return;
        }
        if (position.character <= 0) {
            return;
        }

        var source = document.getText();
        var range = document.getWordRangeAtPosition(position);
        if (range == undefined || range == null || range.isEmpty) {
            return;
        }
        const oldName = document.getText(range);
        if (oldName === newName) {
            return;
        }

        let proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, vscode.workspace.rootPath);
        return new Promise<vscode.WorkspaceEdit>(resolve => {
            proxy.rename<RenameResponse>(document, newName, document.uri.fsPath, range).then(response => {
                //return response.results[0].diff;
                const workspaceEdit = getWorkspaceEditsFromPatch(response.results.map(fileChanges => fileChanges.diff));
                resolve(workspaceEdit);
            });
        });
    }
}
