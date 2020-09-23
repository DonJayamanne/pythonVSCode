// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento, Uri } from 'vscode';
import { PYTHON_LANGUAGE } from '../common/constants';
import { IDisposableRegistry, IMemento, WORKSPACE_MEMENTO } from '../common/types';
import { getKernelConnectionLanguage } from './jupyter/kernels/helpers';
import { INotebook, INotebookCreationTracker, INotebookProvider } from './types';

const LastPythonNotebookCreatedKey = 'last-python-notebook-created';
const LastNotebookCreatedKey = 'last-notebook-created';

@injectable()
export class NotebookCreationTracker implements INotebookCreationTracker {
    public get lastPythonNotebookCreated() {
        const time = this.mementoStorage.get<number | undefined>(LastPythonNotebookCreatedKey);
        return time ? new Date(time) : undefined;
    }
    public get lastNotebookCreated() {
        const time = this.mementoStorage.get<number | undefined>(LastNotebookCreatedKey);
        return time ? new Date(time) : undefined;
    }
    constructor(
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private mementoStorage: Memento,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async startTracking(): Promise<void> {
        this.disposables.push(this.notebookProvider.onNotebookCreated(this.notebookCreated, this));
    }

    // Callback for when a notebook is created by the notebook provider
    // Note the time as well as an extra time for python specific notebooks
    private notebookCreated(evt: { identity: Uri; notebook: INotebook }) {
        const language = getKernelConnectionLanguage(evt.notebook.getKernelConnection());

        this.mementoStorage.update(LastNotebookCreatedKey, Date.now());

        if (language === PYTHON_LANGUAGE) {
            this.mementoStorage.update(LastPythonNotebookCreatedKey, Date.now());
        }
    }
}
