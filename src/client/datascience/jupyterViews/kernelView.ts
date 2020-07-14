import { inject, injectable } from 'inversify';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { INotebookEditorProvider } from '../types';

class KernelItem extends TreeItem {
    constructor(label: string, description?: string | number) {
        super(label, TreeItemCollapsibleState.None);
        this.description = `${description || ''}`;
    }
}

@injectable()
export class KernelsView implements TreeDataProvider<KernelItem> {
    private readonly _onDidChangeTreeData = new EventEmitter<void>();
    public get onDidChangeTreeData(): Event<void> {
        return this._onDidChangeTreeData.event;
    }

    constructor(
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        this.notebookEditorProvider.onDidChangeActiveNotebookEditor(
            () => this._onDidChangeTreeData.fire(),
            this,
            disposables
        );
    }
    public getTreeItem(item: KernelItem): TreeItem {
        return item;
    }
    public async getChildren(element?: KernelItem | undefined): Promise<KernelItem[]> {
        if (element) {
            return [];
        }
        const [jupyterKernels, rawKernels] = await Promise.all([
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(undefined, 'jupyter'),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(undefined, 'raw')
        ]);

        return rawKernels
            .map((kernel) => new KernelItem(kernel.label, kernel.description || kernel.detail))
            .concat(jupyterKernels.map((kernel) => new KernelItem(kernel.label, kernel.description || kernel.detail)));
    }
}
