// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { CancellationToken, Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import * as localize from '../../common/utils/localize';
import { INotebookEditor } from '../../datascience/types';
import {
    CustomDocument,
    CustomDocumentBackup,
    CustomDocumentBackupContext,
    CustomDocumentEditEvent,
    CustomDocumentOpenContext,
    CustomEditorProvider
} from './types';

export class InvalidCustomEditor implements CustomEditorProvider {
    public get onDidChangeActiveNotebookEditor(): Event<INotebookEditor | undefined> {
        return this._onDidChangeActiveNotebookEditor.event;
    }
    public get onDidCloseNotebookEditor(): Event<INotebookEditor> {
        return this._onDidCloseNotebookEditor.event;
    }
    public get onDidOpenNotebookEditor(): Event<INotebookEditor> {
        return this._onDidOpenNotebookEditor.event;
    }
    public get activeEditor(): INotebookEditor | undefined {
        return this.editors.find((e) => e.visible && e.active);
    }
    public get onDidChangeCustomDocument(): Event<CustomDocumentEditEvent> {
        return this._onDidEdit.event;
    }
    public get editors(): INotebookEditor[] {
        return [...this.openedEditors];
    }
    protected readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    protected readonly _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    protected readonly _onDidEdit = new EventEmitter<CustomDocumentEditEvent>();
    protected customDocuments = new Map<string, CustomDocument>();
    private readonly _onDidCloseNotebookEditor = new EventEmitter<INotebookEditor>();
    private openedEditors: Set<INotebookEditor> = new Set<INotebookEditor>();

    public async openCustomDocument(
        _uri: Uri,
        _context: CustomDocumentOpenContext, // This has info about backups. right now we use our own data.
        _cancellation: CancellationToken
    ): Promise<CustomDocument> {
        // Show an error to the user. Custom Editor is not supported.
        throw new Error(localize.DataScience.invalidCustomEditor());
    }
    public async saveCustomDocument(_document: CustomDocument, _cancellation: CancellationToken): Promise<void> {
        throw new Error('Not Implemented');
    }
    public async saveCustomDocumentAs(_document: CustomDocument, _targetResource: Uri): Promise<void> {
        throw new Error('Not Implemented');
    }
    public async revertCustomDocument(_document: CustomDocument, _cancellation: CancellationToken): Promise<void> {
        throw new Error('Not Implemented');
    }
    public async backupCustomDocument(
        _document: CustomDocument,
        _context: CustomDocumentBackupContext,
        _cancellation: CancellationToken
    ): Promise<CustomDocumentBackup> {
        throw new Error('Not Implemented');
    }

    public async resolveCustomEditor(_document: CustomDocument, _panel: WebviewPanel) {
        throw new Error('Not Implemented');
    }

    public async resolveCustomDocument(_document: CustomDocument): Promise<void> {
        throw new Error('Not Implemented');
    }
}
