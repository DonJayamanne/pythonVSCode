// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell } from '../../common/application/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { VSCodeNotebookProvider } from '../constants';
import { IDataScienceFileSystem, INotebookEditorProvider } from '../types';

@injectable()
export class NotebookEditorCompatibilitySupport implements IExtensionSingleActivationService {
    private ourCustomNotebookEditorProvider?: INotebookEditorProvider;
    private vscodeNotebookEditorProvider!: INotebookEditorProvider;
    private initialized?: boolean;
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,

        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer
    ) {}
    public async activate(): Promise<void> {
        this.initialize();
    }
    public canOpenWithVSCodeNotebookEditor(_uri: Uri) {
        this.initialize();
        return true;
    }
    public canOpenWithOurNotebookEditor(uri: Uri, throwException = false) {
        this.initialize();
        // If user has a VS Code notebook opened for the same document, let them know things can go wonky.
        if (
            this.vscodeNotebookEditorProvider.editors.some((editor) =>
                this.fs.areLocalPathsSame(editor.file.fsPath, uri.fsPath)
            )
        ) {
            this.showWarning(throwException);
            return false;
        }
        return true;
    }
    private initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.vscodeNotebookEditorProvider = this.serviceContainer.get<INotebookEditorProvider>(VSCodeNotebookProvider);

        if (this.ourCustomNotebookEditorProvider) {
            this.ourCustomNotebookEditorProvider.onDidOpenNotebookEditor((e) =>
                this.canOpenWithOurNotebookEditor(e.file)
            );
        }
        this.vscodeNotebookEditorProvider.onDidOpenNotebookEditor((e) => this.canOpenWithVSCodeNotebookEditor(e.file));
    }
    private showWarning(throwException: boolean) {
        if (throwException) {
            throw new Error(DataScience.usingPreviewNotebookWithOtherNotebookWarning());
        }
        this.appShell.showErrorMessage(DataScience.usingPreviewNotebookWithOtherNotebookWarning()).then(noop, noop);
    }
}
