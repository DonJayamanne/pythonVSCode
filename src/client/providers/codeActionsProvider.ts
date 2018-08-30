// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';

export class PythonCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeAction[]> {
        const sortImports = new vscode.CodeAction(
            'Sort imports on save',
            vscode.CodeActionKind.SourceOrganizeImports
        );
        sortImports.command = {
            title: 'Sort imports',
            command: 'python.sortImports'
        };

        return [sortImports];
    }
}
