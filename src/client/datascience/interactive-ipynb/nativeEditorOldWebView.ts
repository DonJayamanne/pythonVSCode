// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import { Memento, WebviewPanel } from 'vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IMemento
} from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IInterpreterService } from '../../interpreter/contracts';
import { ProgressReporter } from '../progress/progressReporter';
import {
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataViewerProvider,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookModel,
    IStatusProvider,
    IThemeFinder
} from '../types';
import { NativeEditor } from './nativeEditor';

@injectable()
export class NativeEditorOldWebView extends NativeEditor {
    public get visible(): boolean {
        return this.viewState.visible;
    }
    public get active(): boolean {
        return this.viewState.active;
    }
    public get isUntitled(): boolean {
        const baseName = path.basename(this.file.fsPath);
        return baseName.includes(localize.DataScience.untitledNotebookFileName());
    }
    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IStatusProvider) statusProvider: IStatusProvider,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(INotebookEditorProvider) editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) importer: INotebookImporter,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento,
        @inject(ProgressReporter) progressReporter: ProgressReporter,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry
    ) {
        super(
            listeners,
            liveShare,
            applicationShell,
            documentManager,
            interpreterService,
            provider,
            disposables,
            cssGenerator,
            themeFinder,
            statusProvider,
            jupyterExecution,
            fileSystem,
            configuration,
            commandManager,
            jupyterExporter,
            workspaceService,
            editorProvider,
            dataExplorerProvider,
            jupyterVariables,
            jupyterDebugger,
            importer,
            errorHandler,
            globalStorage,
            progressReporter,
            experimentsManager,
            asyncRegistry
        );
        asyncRegistry.push(this);
    }
    public async load(model: INotebookModel, webViewPanel: WebviewPanel): Promise<void> {
        await super.load(model, webViewPanel);

        // Update our title to match
        this.setTitle(path.basename(model.file.fsPath));

        // Show ourselves
        await this.show();

        // // See if this file was stored in storage prior to shutdown
        // const dirtyContents = await model.getContent();
        // if (dirtyContents) {
        //     // This means we're dirty. Indicate dirty and load from this content
        //     return this.loadContents(dirtyContents, true);
        // } else {
        //     // Load without setting dirty
        //     return this.loadContents(contents, false);
        // }
    }

    // protected async reopen(cells: ICell[]): Promise<void> {
    //     try {
    //         // Reload the web panel too.
    //         await super.loadWebPanel(path.basename(this._file.fsPath));
    //         await this.show();

    //         // Indicate we have our identity
    //         this.loadedPromise.resolve();

    //         // Update our title to match
    //         if (this._dirty) {
    //             this._dirty = false;
    //             await this.setDirty();
    //         } else {
    //             this.setTitle(path.basename(this._file.fsPath));
    //         }

    //         // If that works, send the cells to the web view
    //         return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
    //     } catch (e) {
    //         return this.errorHandler.handleError(e);
    //     }
    // }

    //     private async askForSave(): Promise<AskForSaveResult> {
    //         const message1 = localize.DataScience.dirtyNotebookMessage1().format(`${path.basename(this.file.fsPath)}`);
    //         const message2 = localize.DataScience.dirtyNotebookMessage2();
    //         const yes = localize.DataScience.dirtyNotebookYes();
    //         const no = localize.DataScience.dirtyNotebookNo();
    //         const result = await this.applicationShell.showInformationMessage(
    //             // tslint:disable-next-line: messages-must-be-localized
    //             `${message1}\n${message2}`,
    //             { modal: true },
    //             yes,
    //             no
    //         );
    //         switch (result) {
    //             case yes:
    //                 return AskForSaveResult.Yes;

    //             case no:
    //                 return AskForSaveResult.No;

    //             default:
    //                 return AskForSaveResult.Cancel;
    //         }
    //     }

    //     private async setDirty(): Promise<void> {
    //         // Update storage if not untitled. Don't wait for results.
    //         if (!this.isUntitled) {
    //             this.generateNotebookConten; this.storeContents(c).catch(ex => traceError('Failed to generate notebook content to store in state', ex));te;', ex);
    //                     )
    //                 )
    //                 .ignoreErrors();
    //         }

    //         // Then update dirty flag.
    //         if (!this._dirty) {
    //             this._dirty = true;
    //             this.setTitle(`${path.basename(this.file.fsPath)}*`);

    //             // Tell the webview we're dirty
    //             await this.postMessage(InteractiveWindowMessages.NotebookDirty);

    //             // Tell listeners we're dirty
    //             this.modifiedEvent.fire(this);
    //         }
    //     }

    //     private async setClean(): Promise<void> {
    //         // Always update storage
    //         this.storeContents(undefined).catch(ex => traceError('Failed to clear notebook store', ex));

    //         if (this._dirty) {
    //             this._dirty = false;
    //             this.setTitle(`${path.basename(this.file.fsPath)}`);
    //             await this.postMessage(InteractiveWindowMessages.NotebookClean);
    //         }
    //     }

    //     private async viewDocument(contents: string): Promise<void> {
    //         const doc = await this.documentManager.openTextDocument({ language: 'python', content: contents });
    //         await this.documentManager.showTextDocument(doc, ViewColumn.One);
    //     }

    //     @captureTelemetry(Telemetry.Save, undefined, true)
    //     private async saveToDisk(): Promise<void> {
    //         // If we're already in the middle of prompting the user to save, then get out of here.
    //         // We could add a debounce decorator, unfortunately that slows saving (by waiting for no more save events to get sent).
    //         if (this.isPromptingToSaveToDisc && this.isUntitled) {
    //             return;
    //         }
    //         try {
    //             let fileToSaveTo: Uri | undefined = this.file;
    //             let isDirty = this._dirty;

    //             // Ask user for a save as dialog if no title
    //             if (this.isUntitled) {
    //                 this.isPromptingToSaveToDisc = true;
    //                 const filtersKey = localize.DataScience.dirtyNotebookDialogFilter();
    //                 const filtersObject: { [name: string]: string[] } = {};
    //                 filtersObject[filtersKey] = ['ipynb'];
    //                 isDirty = true;

    //                 const defaultUri =
    //                     Array.isAervice.workspaceFolders); &&
    //                     this.workspaceService.workspaceFolders.length > 0
    //                         ? this.workspaceService.workspaceFolders[0].uri
    //                         : undefined;
    //                 fileToSaveTo = await this.applicationShell.showSaveDialog({
    //                     saveLabel: localize.DataScience.dirtyNotebookDialogTitle(),
    //                     filters: filtersObject,
    //                     defaultUri
    //                 });
    //             }

    //             if (fileToSaveTo && isDirty) {
    //                 // Write out our visible cells
    //  fileToSaveTo.fsPath, await this.generateNotebookContent(this.visibleCells);bookContent(this.visibleCells);
    //                 )

    //                 // Update our file name and dirty state
    //                 this._file = fileToSaveTo;
    //                 await this.setClean();
    //                 this.savedEvent.fire(this);
    //             }
    //         } catch (e) {
    //             traceError(e);
    //         } finally {
    //             this.isPromptingToSaveToDisc = false;
    //         }
    //     }

    //     private saveAll(args: ISaveAll) {
    //         this.visibleCells = args.cells;
    //         this.saveToDisk().ignoreErrors();
    //     }

    //     private loadCellsComplete(); {
    //         if (!this.loadedAllCells) {
    //             this.loadedAllCells = true;
    //             sendTelemetryEvent(Telemetry.NotebookOpenTime, this.startupTimer.elapsedTime);
    //         }
    //     }

    //     private async; clearAllOutputs(); {
    //         this.visibleCells.forEach(cell => {
    //             cell.data.execution_count = null;
    //             cell.data.outputs = [];
    //         });

    //         await this.setDirty();
    //     }
}
