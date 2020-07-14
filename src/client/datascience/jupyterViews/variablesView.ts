import { inject, injectable, named } from 'inversify';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
import { Identifiers } from '../constants';
import { ICell, IJupyterVariables, INotebook, INotebookEditorProvider, INotebookProvider } from '../types';

class VariableItem extends TreeItem {
    constructor(label: string, description?: string | number) {
        super(label, TreeItemCollapsibleState.None);
        this.description = `${description || ''}`;
    }
}

@injectable()
export class VariablesView implements TreeDataProvider<VariableItem> {
    private readonly _onDidChangeTreeData = new EventEmitter<void>();
    private readonly trackedNotebooks = new WeakSet<INotebook>();
    public get onDidChangeTreeData(): Event<void> {
        return this._onDidChangeTreeData.event;
    }

    constructor(
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(IJupyterVariables)
        @named(Identifiers.ALL_VARIABLES)
        private readonly variableProvider: IJupyterVariables,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {
        this.notebookEditorProvider.onDidChangeActiveNotebookEditor(
            () => this._onDidChangeTreeData.fire(),
            this,
            disposables
        );
    }
    public getTreeItem(item: VariableItem): TreeItem {
        return item;
    }
    public async getChildren(element?: VariableItem | undefined): Promise<VariableItem[]> {
        if (element) {
            return [];
        }
        if (!this.notebookEditorProvider.activeEditor) {
            return [];
        }
        const model = this.notebookEditorProvider.activeEditor.model;
        if (!model) {
            return [];
        }

        const notebooks = await Promise.all(this.notebookProvider.activeNotebooks);
        if (notebooks.length === 0) {
            return [];
        }
        const notebook = notebooks.find((item) => item.identity.fsPath === model.file.fsPath);
        if (!notebook) {
            return [];
        }
        if (!this.trackedNotebooks.has(notebook)) {
            this.trackedNotebooks.add(notebook);
            notebook.onSessionStatusChanged(() => this._onDidChangeTreeData.fire(), this, this.disposables);
        }
        const maxExecutionCount = model.cells.reduce<number>((execCount: number, cell: ICell) => {
            const value = parseInt(`${cell.data.execution_count}` ?? '0', 10);
            return Math.max(isNaN(value) ? 0 : value, execCount);
        }, 0);
        const variables = await this.variableProvider.getVariables(notebook, {
            executionCount: maxExecutionCount,
            pageSize: 100,
            refreshCount: 1,
            sortAscending: true,
            sortColumn: 'name',
            startIndex: 0
        });

        return variables.pageResponse.map((item) => new VariableItem(item.name, item.value));
    }
}
