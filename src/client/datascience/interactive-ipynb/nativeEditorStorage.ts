import { nbformat } from '@jupyterlab/coreutils';
import * as fastDeepEqual from 'fast-deep-equal';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Memento, Uri } from 'vscode';
import { concatMultilineStringInput, splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell } from '../../../datascience-ui/common/cellFactory';
import { ICommandManager } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { GLOBAL_MEMENTO, ICryptoUtils, IDisposable, IDisposableRegistry, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../interpreter/contracts';
import { Commands, Identifiers } from '../constants';
import { IEditCell, IInsertCell, ISwapCells } from '../interactive-common/interactiveWindowTypes';
import { InvalidNotebookFileError } from '../jupyter/invalidNotebookFileError';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { CellState, ICell, IJupyterExecution, IJupyterKernelSpec, INotebookModel, INotebookModelChange, INotebookStorage } from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
import detectIndent = require('detect-indent');

const KeyPrefix = 'notebook-storage-';
const NotebookTransferKey = 'notebook-transfered';

interface INativeEditorStorageState {
    file: Uri;
    cells: ICell[];
    isDirty: boolean;
    notebookJson: Partial<nbformat.INotebookContent>;
}

@injectable()
export class NativeEditorStorage implements INotebookModel, INotebookStorage, IDisposable {
    public get isDirty(): boolean {
        return this._state.isDirty;
    }
    public get changed(): Event<INotebookModelChange> {
        return this._changedEmitter.event;
    }
    public get file(): Uri {
        return this._state.file;
    }

    public get isUntitled(): boolean {
        return this.file.scheme === 'untitled';
    }
    public get cells(): ICell[] {
        return this._state.cells;
    }
    private static signedUpForCommands = false;

    private static storageMap = new Map<string, NativeEditorStorage>();
    private _changedEmitter = new EventEmitter<INotebookModelChange>();
    private _state: INativeEditorStorageState = { file: Uri.file(''), isDirty: false, cells: [], notebookJson: {} };
    private _loadPromise: Promise<ICell[]> | undefined;
    private indentAmount: string = ' ';

    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(ICryptoUtils) private crypto: ICryptoUtils,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalStorage: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private localStorage: Memento,
        @inject(ICommandManager) cmdManager: ICommandManager
    ) {
        // Sign up for commands if this is the first storage created.
        if (!NativeEditorStorage.signedUpForCommands) {
            this.registerCommands(cmdManager, disposables);
        }
        disposables.push(this);
    }

    private static async getStorage(resource: Uri): Promise<NativeEditorStorage | undefined> {
        const storage = NativeEditorStorage.storageMap.get(resource.toString());
        if (storage && storage._loadPromise) {
            await storage._loadPromise;
            return storage;
        }
        return undefined;
    }

    private static async handleEdit(s: NativeEditorStorage, request: IEditCell): Promise<void> {
        // Apply the changes to the visible cell list. We won't get an update until
        // submission otherwise
        if (request.changes && request.changes.length) {
            const change = request.changes[0];
            const normalized = change.text.replace(/\r/g, '');

            // Figure out which cell we're editing.
            const index = s.cells.findIndex(c => c.id === request.id);
            if (index >= 0) {
                // This is an actual edit.
                const contents = concatMultilineStringInput(s.cells[index].data.source);
                const before = contents.substr(0, change.rangeOffset);
                const after = contents.substr(change.rangeOffset + change.rangeLength);
                const newContents = `${before}${normalized}${after}`;
                if (contents !== newContents) {
                    const newCells = [...s.cells];
                    const newCell = { ...newCells[index], data: { ...newCells[index].data, source: newContents } };
                    newCells[index] = NativeEditorStorage.asCell(newCell);
                    s.setState({ cells: newCells });
                }
            }
        }
    }

    private static async handleInsert(s: NativeEditorStorage, request: IInsertCell): Promise<void> {
        // Insert a cell into our visible list based on the index. They should be in sync
        const newCells = [...s.cells];
        newCells.splice(request.index, 0, request.cell);
        s.setState({ cells: newCells });
    }

    private static async handleRemoveCell(s: NativeEditorStorage, id: string): Promise<void> {
        // Filter our list
        const newCells = [...s.cells].filter(v => v.id !== id);
        if (newCells.length !== s.cells.length) {
            s.setState({ cells: newCells });
        }
    }

    private static async handleSwapCells(s: NativeEditorStorage, request: ISwapCells): Promise<void> {
        // Swap two cells in our list
        const first = s.cells.findIndex(v => v.id === request.firstCellId);
        const second = s.cells.findIndex(v => v.id === request.secondCellId);
        if (first >= 0 && second >= 0) {
            const newCells = [...s.cells];
            const temp = { ...newCells[first] };
            newCells[first] = NativeEditorStorage.asCell(newCells[second]);
            newCells[second] = NativeEditorStorage.asCell(temp);
            s.setState({ cells: newCells });
        }
    }

    private static async handleDeleteAllCells(s: NativeEditorStorage): Promise<void> {
        if (s.cells.length !== 0) {
            s.setState({ cells: [] });
        }
    }

    private static async handleClearAllOutputs(s: NativeEditorStorage): Promise<void> {
        const newCells = s.cells.map(c => {
            return NativeEditorStorage.asCell({ ...c, data: { ...c.data, execution_count: null, outputs: [] } });
        });

        // Do our check here to see if any changes happened. We don't want
        // to fire an unnecessary change if we can help it.
        if (!fastDeepEqual(s.cells, newCells)) {
            s.setState({ cells: newCells });
        }
    }

    private static async handleModifyCells(s: NativeEditorStorage, cells: ICell[]): Promise<void> {
        const newCells = [...s.cells];
        // Update these cells in our list
        cells.forEach(c => {
            const index = newCells.findIndex(v => v.id === c.id);
            newCells[index] = NativeEditorStorage.asCell(c);
        });

        // Indicate dirty
        if (!fastDeepEqual(newCells, s.cells)) {
            s.setState({ cells: newCells, isDirty: true });
        }
    }

    private static async handleUpdateVersionInfo(
        s: NativeEditorStorage,
        interpreter: PythonInterpreter | undefined,
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined
    ): Promise<void> {
        // Get our kernel_info and language_info from the current notebook
        if (interpreter && interpreter.version && s._state.notebookJson.metadata && s._state.notebookJson.metadata.language_info) {
            s._state.notebookJson.metadata.language_info.version = interpreter.version.raw;
        }

        if (kernelSpec && s._state.notebookJson.metadata && !s._state.notebookJson.metadata.kernelspec) {
            // Add a new spec in this case
            s._state.notebookJson.metadata.kernelspec = {
                name: kernelSpec.name || kernelSpec.display_name || '',
                display_name: kernelSpec.display_name || kernelSpec.name || ''
            };
        } else if (kernelSpec && s._state.notebookJson.metadata && s._state.notebookJson.metadata.kernelspec) {
            // Spec exists, just update name and display_name
            s._state.notebookJson.metadata.kernelspec.name = kernelSpec.name || kernelSpec.display_name || '';
            s._state.notebookJson.metadata.kernelspec.display_name = kernelSpec.display_name || kernelSpec.name || '';
        }
    }

    // tslint:disable-next-line: no-any
    private static asCell(cell: any): ICell {
        return cell as ICell;
    }

    public dispose(): void {
        NativeEditorStorage.storageMap.delete(this.file.toString());
    }

    public async load(file: Uri, possibleContents?: string): Promise<INotebookModel> {
        // Reset the load promise and reload our cells
        this._loadPromise = this.loadFromFile(file, possibleContents);
        await this._loadPromise;
        return this;
    }

    public save(): Promise<INotebookModel> {
        return this.saveAs(this.file);
    }

    public async saveAs(file: Uri): Promise<INotebookModel> {
        const contents = await this.getContent();
        await this.fileSystem.writeFile(file.fsPath, contents, 'utf-8');
        if (this.isDirty || file.fsPath !== this.file.fsPath) {
            this.setState({ isDirty: false, file });
        }
        return this;
    }

    public async getJson(): Promise<Partial<nbformat.INotebookContent>> {
        await this.ensureNotebookJson();
        return this._state.notebookJson;
    }

    public getContent(cells?: ICell[]): Promise<string> {
        return this.generateNotebookContent(cells ? cells : this.cells);
    }

    // tslint:disable-next-line: no-any
    private async commandCallback(handler: (...any: [NativeEditorStorage, ...any[]]) => Promise<any>, resource: Uri) {
        const args = Array.prototype.slice.call(arguments).slice(2);
        const storage = await NativeEditorStorage.getStorage(resource);
        if (storage) {
            return handler(storage, ...args);
        }
    }

    private registerCommands(commandManager: ICommandManager, disposableRegistry: IDisposableRegistry): void {
        NativeEditorStorage.signedUpForCommands = true;
        disposableRegistry.push({
            dispose: () => {
                NativeEditorStorage.signedUpForCommands = false;
            }
        });
        disposableRegistry.push(
            commandManager.registerCommand(Commands.NotebookStorage_ClearCellOutputs, this.commandCallback.bind(undefined, NativeEditorStorage.handleClearAllOutputs))
        );
        disposableRegistry.push(
            commandManager.registerCommand(Commands.NotebookStorage_DeleteAllCells, this.commandCallback.bind(undefined, NativeEditorStorage.handleDeleteAllCells))
        );
        disposableRegistry.push(commandManager.registerCommand(Commands.NotebookStorage_EditCell, this.commandCallback.bind(undefined, NativeEditorStorage.handleEdit)));
        disposableRegistry.push(commandManager.registerCommand(Commands.NotebookStorage_InsertCell, this.commandCallback.bind(undefined, NativeEditorStorage.handleInsert)));
        disposableRegistry.push(commandManager.registerCommand(Commands.NotebookStorage_ModifyCells, this.commandCallback.bind(undefined, NativeEditorStorage.handleModifyCells)));
        disposableRegistry.push(commandManager.registerCommand(Commands.NotebookStorage_RemoveCell, this.commandCallback.bind(undefined, NativeEditorStorage.handleRemoveCell)));
        disposableRegistry.push(commandManager.registerCommand(Commands.NotebookStorage_SwapCells, this.commandCallback.bind(undefined, NativeEditorStorage.handleSwapCells)));
        disposableRegistry.push(
            commandManager.registerCommand(Commands.NotebookStorage_UpdateVersion, this.commandCallback.bind(undefined, NativeEditorStorage.handleUpdateVersionInfo))
        );
    }

    private async loadFromFile(file: Uri, possibleContents?: string): Promise<ICell[]> {
        // Save file
        this.setState({ file });

        try {
            // Attempt to read the contents if a viable file
            const contents = file.scheme === 'untitled' ? possibleContents : await this.fileSystem.readFile(this.file.fsPath);

            // See if this file was stored in storage prior to shutdown
            const dirtyContents = await this.getStoredContents();
            if (dirtyContents) {
                // This means we're dirty. Indicate dirty and load from this content
                return this.loadContents(dirtyContents, true);
            } else {
                // Load without setting dirty
                return this.loadContents(contents, false);
            }
        } catch {
            // May not exist at this time. Should always have a single cell though
            return [this.createEmptyCell()];
        }
    }

    private createEmptyCell() {
        return {
            id: uuid(),
            line: 0,
            file: Identifiers.EmptyFileName,
            state: CellState.finished,
            data: createCodeCell()
        };
    }

    private async loadContents(contents: string | undefined, forceDirty: boolean): Promise<ICell[]> {
        // tslint:disable-next-line: no-any
        const json = contents ? (JSON.parse(contents) as Partial<nbformat.INotebookContent>) : undefined;

        // Double check json (if we have any)
        if (json && !json.cells) {
            throw new InvalidNotebookFileError(this.file.fsPath);
        }

        // Then compute indent. It's computed from the contents
        if (contents) {
            this.indentAmount = detectIndent(contents).indent;
        }

        // Then save the contents. We'll stick our cells back into this format when we save
        if (json) {
            this._state.notebookJson = json;
        }

        // Extract cells from the json
        const cells = json ? (json.cells as (nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell)[]) : [];

        // Remap the ids
        const remapped = cells.map((c, index) => {
            return {
                id: `NotebookImport#${index}`,
                file: Identifiers.EmptyFileName,
                line: 0,
                state: CellState.finished,
                data: c
            };
        });

        // Make sure at least one
        if (remapped.length === 0) {
            remapped.splice(0, 0, this.createEmptyCell());
            forceDirty = true;
        }

        // Save as our visible list
        this.setState({ cells: remapped, isDirty: forceDirty });

        return this.cells;
    }

    private async extractPythonMainVersion(notebookData: Partial<nbformat.INotebookContent>): Promise<number> {
        if (
            notebookData &&
            notebookData.metadata &&
            notebookData.metadata.language_info &&
            notebookData.metadata.language_info.codemirror_mode &&
            // tslint:disable-next-line: no-any
            typeof (notebookData.metadata.language_info.codemirror_mode as any).version === 'number'
        ) {
            // tslint:disable-next-line: no-any
            return (notebookData.metadata.language_info.codemirror_mode as any).version;
        }
        // Use the active interpreter
        const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
        return usableInterpreter && usableInterpreter.version ? usableInterpreter.version.major : 3;
    }

    private async ensureNotebookJson(): Promise<void> {
        if (!this._state.notebookJson || !this._state.notebookJson.metadata) {
            const pythonNumber = await this.extractPythonMainVersion(this._state.notebookJson);
            // Use this to build our metadata object
            // Use these as the defaults unless we have been given some in the options.
            const metadata: nbformat.INotebookMetadata = {
                language_info: {
                    name: 'python',
                    codemirror_mode: {
                        name: 'ipython',
                        version: pythonNumber
                    }
                },
                orig_nbformat: 2,
                file_extension: '.py',
                mimetype: 'text/x-python',
                name: 'python',
                npconvert_exporter: 'python',
                pygments_lexer: `ipython${pythonNumber}`,
                version: pythonNumber
            };

            // Default notebook data.
            this._state.notebookJson = {
                nbformat: 4,
                nbformat_minor: 2,
                metadata: metadata
            };
        }
    }

    private async generateNotebookContent(cells: ICell[]): Promise<string> {
        // Make sure we have some
        await this.ensureNotebookJson();

        // Reuse our original json except for the cells.
        const json = {
            ...(this._state.notebookJson as nbformat.INotebookContent),
            cells: cells.map(c => this.fixupCell(c.data))
        };
        return JSON.stringify(json, null, this.indentAmount);
    }

    private fixupCell(cell: nbformat.ICell): nbformat.ICell {
        // Source is usually a single string on input. Convert back to an array
        return ({
            ...cell,
            source: splitMultilineString(cell.source)
            // tslint:disable-next-line: no-any
        } as any) as nbformat.ICell; // nyc (code coverage) barfs on this so just trick it.
    }

    private setState(newState: Partial<INativeEditorStorageState>) {
        let changed = false;
        const change: INotebookModelChange = { model: this };
        if (newState.file) {
            change.newFile = newState.file;
            change.oldFile = this.file;
            this._state.file = change.newFile;
            NativeEditorStorage.storageMap.delete(this.file.toString());
            NativeEditorStorage.storageMap.set(newState.file.toString(), this);
            changed = true;
        }
        if (newState.cells) {
            change.oldCells = this._state.cells;
            change.newCells = newState.cells;
            this._state.cells = newState.cells;

            // Force dirty on a cell change
            this._state.isDirty = true;
            change.isDirty = true;
            changed = true;
        }
        if (newState.isDirty !== undefined && newState.isDirty !== this._state.isDirty) {
            // This should happen on save all (to put back the dirty cell change)
            change.isDirty = newState.isDirty;
            this._state.isDirty = newState.isDirty;
            changed = true;
        }
        if (changed) {
            this._changedEmitter.fire(change);
        }
    }

    private getStorageKey(): string {
        return `${KeyPrefix}${this.file.toString()}`;
    }

    /**
     * Gets any unsaved changes to the notebook file from the old locations.
     * If the file has been modified since the uncommitted changes were stored, then ignore the uncommitted changes.
     *
     * @private
     * @returns {(Promise<string | undefined>)}
     * @memberof NativeEditor
     */
    private async getStoredContents(): Promise<string | undefined> {
        const key = this.getStorageKey();

        // First look in the global storage file location
        let result = await this.getStoredContentsFromFile(key);
        if (!result) {
            result = await this.getStoredContentsFromGlobalStorage(key);
            if (!result) {
                result = await this.getStoredContentsFromLocalStorage(key);
            }
        }

        return result;
    }

    private async getStoredContentsFromFile(key: string): Promise<string | undefined> {
        const filePath = this.getHashedFileName(key);
        try {
            // Use this to read from the extension global location
            const contents = await this.fileSystem.readFile(filePath);
            const data = JSON.parse(contents);
            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && !this.isUntitled && this.file.scheme === 'file') {
                const stat = await this.fileSystem.stat(this.file.fsPath);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && !this.isUntitled && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromGlobalStorage(key: string): Promise<string | undefined> {
        try {
            const data = this.globalStorage.get<{ contents?: string; lastModifiedTimeMs?: number }>(key);

            // If we have data here, make sure we eliminate any remnants of storage
            if (data) {
                await this.transferStorage();
            }

            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && !this.isUntitled && this.file.scheme === 'file') {
                const stat = await this.fileSystem.stat(this.file.fsPath);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && !this.isUntitled && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromLocalStorage(key: string): Promise<string | undefined> {
        const workspaceData = this.localStorage.get<string>(key);
        if (workspaceData && !this.isUntitled) {
            // Make sure to clear so we don't use this again.
            this.localStorage.update(key, undefined);

            return workspaceData;
        }
    }

    // VS code recommended we use the hidden '_values' to iterate over all of the entries in
    // the global storage map and delete the ones we own.
    private async transferStorage(): Promise<void[]> {
        const promises: Thenable<void>[] = [];

        // Indicate we ran this function
        await this.globalStorage.update(NotebookTransferKey, true);

        try {
            // tslint:disable-next-line: no-any
            if ((this.globalStorage as any)._value) {
                // tslint:disable-next-line: no-any
                const keys = Object.keys((this.globalStorage as any)._value);
                [...keys].forEach((k: string) => {
                    if (k.startsWith(KeyPrefix)) {
                        // Remove from the map so that global storage does not have this anymore.
                        // Use the real API here as we don't know how the map really gets updated.
                        promises.push(this.globalStorage.update(k, undefined));
                    }
                });
            }
        } catch (e) {
            traceError('Exception eliminating global storage parts:', e);
        }

        return Promise.all(promises);
    }

    private getHashedFileName(key: string): string {
        const file = `${this.crypto.createHash(key, 'string')}.ipynb`;
        return path.join(this.context.globalStoragePath, file);
    }
}
