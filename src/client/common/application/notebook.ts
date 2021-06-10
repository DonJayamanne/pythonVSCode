// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { DocumentSelector, Event, EventEmitter, workspace } from 'vscode';
import type { notebook, NotebookConcatTextDocument, NotebookDocument } from 'vscode-proposed';
import { UseProposedApi } from '../constants';
import { traceError } from '../logger';
import { IApplicationEnvironment, IVSCodeNotebook } from './types';

@injectable()
export class VSCodeNotebook implements IVSCodeNotebook {
    public get onDidOpenNotebookDocument(): Event<NotebookDocument> {
        try {
            const onDidOpenNotebookDocument =
                this.notebook.onDidOpenNotebookDocument ?? (workspace as any).onDidOpenNotebookDocument;
            return this.canUseNotebookApi ? onDidOpenNotebookDocument : new EventEmitter<NotebookDocument>().event;
        } catch (ex) {
            traceError(`Failed to get event handler onDidOpenNotebookDocument`, ex);
            return new EventEmitter<NotebookDocument>().event;
        }
    }
    public get onDidCloseNotebookDocument(): Event<NotebookDocument> {
        try {
            const onDidCloseNotebookDocument =
                this.notebook.onDidCloseNotebookDocument ?? (workspace as any).onDidCloseNotebookDocument;
            return this.canUseNotebookApi ? onDidCloseNotebookDocument : new EventEmitter<NotebookDocument>().event;
        } catch (ex) {
            traceError(`Failed to get event handler onDidOpenNotebookDocument`, ex);
            return new EventEmitter<NotebookDocument>().event;
        }
    }
    public get notebookDocuments(): ReadonlyArray<NotebookDocument> {
        try {
            const notebookDocuments = this.notebook.notebookDocuments ?? (workspace as any).notebookDocuments;
            return this.canUseNotebookApi ? notebookDocuments : [];
        } catch (ex) {
            traceError(`Failed to get event handler onDidOpenNotebookDocument`, ex);
            return [];
        }
    }
    private get notebook() {
        if (!this._notebook) {
            this._notebook = require('vscode').notebook ?? require('vscode').notebooks;
        }
        return this._notebook!;
    }
    private _notebook?: typeof notebook;
    private readonly canUseNotebookApi?: boolean;
    constructor(
        @inject(UseProposedApi) private readonly useProposedApi: boolean,
        @inject(IApplicationEnvironment) readonly env: IApplicationEnvironment,
    ) {
        if (this.useProposedApi) {
            this.canUseNotebookApi = true;
        }
    }
    public createConcatTextDocument(doc: NotebookDocument, selector?: DocumentSelector): NotebookConcatTextDocument {
        if (this.useProposedApi) {
            return this.notebook.createConcatTextDocument(doc, selector) as any; // Types of Position are different for some reason. Fix this later.
        }
        throw new Error('createConcatDocument not supported');
    }
}
