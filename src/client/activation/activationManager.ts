// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject, optional } from 'inversify';
import { TextDocument } from 'vscode';
import { IPythonExtensionChecker } from '../api/types';
import { IActiveResourceService, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PYTHON_LANGUAGE } from '../common/constants';
import { traceDecorators } from '../common/logger';
import { IDisposable, Resource } from '../common/types';
import { Deferred } from '../common/utils/async';
import { IFileSystem } from '../datascience/types';
import { IInterpreterService } from '../interpreter/contracts';
import { sendActivationTelemetry } from '../telemetry/envFileTelemetry';
import { IExtensionActivationManager, IExtensionActivationService, IExtensionSingleActivationService } from './types';

@injectable()
export class ExtensionActivationManager implements IExtensionActivationManager {
    public readonly activatedWorkspaces = new Set<string>();
    protected readonly isInterpreterSetForWorkspacePromises = new Map<string, Deferred<void>>();
    private readonly disposables: IDisposable[] = [];
    private docOpenedHandler?: IDisposable;
    constructor(
        @multiInject(IExtensionActivationService)
        @optional()
        private readonly activationServices: IExtensionActivationService[],
        @multiInject(IExtensionSingleActivationService)
        private readonly singleActivationServices: IExtensionSingleActivationService[],
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IActiveResourceService) private readonly activeResourceService: IActiveResourceService,
        @inject(IPythonExtensionChecker) private readonly extensionChecker: IPythonExtensionChecker
    ) {}

    public dispose() {
        while (this.disposables.length > 0) {
            const disposable = this.disposables.shift()!;
            disposable.dispose();
        }
        if (this.docOpenedHandler) {
            this.docOpenedHandler.dispose();
            this.docOpenedHandler = undefined;
        }
    }
    public async activate(): Promise<void> {
        await this.initialize();
        // Activate all activation services together.
        await Promise.all([
            Promise.all(this.singleActivationServices.map((item) => item.activate())),
            this.activateWorkspace(this.activeResourceService.getActiveResource())
        ]);
    }
    @traceDecorators.error('Failed to activate a workspace')
    public async activateWorkspace(resource: Resource) {
        const key = this.getWorkspaceKey(resource);
        if (this.activatedWorkspaces.has(key)) {
            return;
        }
        this.activatedWorkspaces.add(key);

        // Get latest interpreter list in the background.
        if (this.extensionChecker.isPythonExtensionInstalled) {
            this.interpreterService.getInterpreters(resource).ignoreErrors();
        }

        await sendActivationTelemetry(this.fileSystem, this.workspaceService, resource);

        if (this.activationServices) {
            await Promise.all(this.activationServices.map((item) => item.activate(resource)));
        }
    }
    public async initialize() {
        this.addHandlers();
        this.addRemoveDocOpenedHandlers();
    }
    public onDocOpened(doc: TextDocument) {
        if (doc.languageId !== PYTHON_LANGUAGE) {
            return;
        }
        const key = this.getWorkspaceKey(doc.uri);
        // If we have opened a doc that does not belong to workspace, then do nothing.
        if (key === '' && this.workspaceService.hasWorkspaceFolders) {
            return;
        }
        if (this.activatedWorkspaces.has(key)) {
            return;
        }
        const folder = this.workspaceService.getWorkspaceFolder(doc.uri);
        this.activateWorkspace(folder ? folder.uri : undefined).ignoreErrors();
    }

    protected addHandlers() {
        this.disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
    }
    protected addRemoveDocOpenedHandlers() {
        if (this.hasMultipleWorkspaces()) {
            if (!this.docOpenedHandler) {
                this.docOpenedHandler = this.documentManager.onDidOpenTextDocument(this.onDocOpened, this);
            }
            return;
        }
        if (this.docOpenedHandler) {
            this.docOpenedHandler.dispose();
            this.docOpenedHandler = undefined;
        }
    }
    protected onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspaceService.workspaceFolders!.map((workspaceFolder) =>
            this.getWorkspaceKey(workspaceFolder.uri)
        );
        const activatedWkspcKeys = Array.from(this.activatedWorkspaces.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                this.activatedWorkspaces.delete(folder);
            }
        }
        this.addRemoveDocOpenedHandlers();
    }
    protected hasMultipleWorkspaces() {
        return this.workspaceService.hasWorkspaceFolders && this.workspaceService.workspaceFolders!.length > 1;
    }
    protected getWorkspaceKey(resource: Resource) {
        return this.workspaceService.getWorkspaceFolderIdentifier(resource, '');
    }
}
