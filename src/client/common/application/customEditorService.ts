// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';

import { noop } from '../utils/misc';
import { IApplicationEnvironment, ICommandManager, ICustomEditorService, WebviewCustomEditorProvider } from './types';

@injectable()
export class CustomEditorService implements ICustomEditorService {
    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IApplicationEnvironment) private readonly appEnv: IApplicationEnvironment
    ) {}

    public registerWebviewCustomEditorProvider(
        viewType: string,
        provider: WebviewCustomEditorProvider,
        options?: vscode.WebviewPanelOptions
    ): vscode.Disposable {
        if (this.appEnv.packageJson.enableProposedApi) {
            // tslint:disable-next-line: no-any
            return (vscode.window as any).registerWebviewCustomEditorProvider(viewType, provider, options);
        } else {
            return { dispose: noop };
        }
    }

    public async openEditor(file: vscode.Uri): Promise<void> {
        if (this.appEnv.packageJson.enableProposedApi) {
            await this.commandManager.executeCommand('vscode.open', file);
        }
    }
}
