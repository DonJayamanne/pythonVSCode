// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { window } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { NotebookEditorSupport } from '../../common/experiments/groups';
import { IDisposableRegistry, IExperimentsManager } from '../../common/types';
import { KernelsView } from './kernelView';
import { NotebookMetadataView } from './notebookMetadataView';
import { SessionsView } from './sessionsView';
import { VariablesView } from './variablesView';

@injectable()
export class JupyterViewIntegration implements IExtensionSingleActivationService {
    constructor(
        @inject(NotebookMetadataView) private readonly metadataView: NotebookMetadataView,
        @inject(KernelsView) private readonly kernelsView: KernelsView,
        @inject(VariablesView) private readonly variablesView: VariablesView,
        @inject(SessionsView) private readonly sessionView: SessionsView,
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        // This condition is temporary.
        // If user belongs to the experiment, then make the necessary changes to package.json.
        // Once the API is final, we won't need to modify the package.json.
        if (!this.experiment.inExperiment(NotebookEditorSupport.nativeNotebookExperiment)) {
            return;
        }
        this.disposables.push(window.registerTreeDataProvider('metadata', this.metadataView));
        this.disposables.push(window.registerTreeDataProvider('kernels', this.kernelsView));
        this.disposables.push(window.registerTreeDataProvider('variables', this.variablesView));
        this.disposables.push(window.registerTreeDataProvider('session', this.sessionView));
    }
}
