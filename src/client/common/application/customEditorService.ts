// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';

import { ICommandManager, ICustomEditorService, WebviewCustomEditorProvider } from './types';

@injectable()
export class CustomEditorService implements ICustomEditorService {
    constructor(@inject(ICommandManager) private commandManager: ICommandManager) {}

    public registerWebviewCustomEditorProvider(
        viewType: string,
        provider: WebviewCustomEditorProvider,
        options?: vscode.WebviewPanelOptions
    ): vscode.Disposable {
        // tslint:disable-next-line: no-any
        return (vscode.window as any).registerWebviewCustomEditorProvider(viewType, provider, options);
    }

    public async openEditor(file: vscode.Uri): Promise<void> {
        await this.commandManager.executeCommand('vscode.open', file);
    }
}
