// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { DocumentSelector, Event, workspace, notebooks, NotebookDocument } from 'vscode';
import { IVSCodeNotebook } from './types';
import type { NotebookConcatTextDocument } from 'vscode-proposed';

@injectable()
export class VSCodeNotebook implements IVSCodeNotebook {
    public get onDidOpenNotebookDocument(): Event<NotebookDocument> {
        return workspace.onDidOpenNotebookDocument;
    }
    public get onDidCloseNotebookDocument(): Event<NotebookDocument> {
        return workspace.onDidCloseNotebookDocument;
    }
    public get notebookDocuments(): ReadonlyArray<NotebookDocument> {
        return workspace.notebookDocuments;
    }
    public createConcatTextDocument(doc: NotebookDocument, selector?: DocumentSelector): NotebookConcatTextDocument {
        return notebooks.createConcatTextDocument(doc, selector);
    }
}
