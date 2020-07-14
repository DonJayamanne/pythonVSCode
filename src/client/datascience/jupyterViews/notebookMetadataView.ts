import { inject, injectable } from 'inversify';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
import { INotebookEditorProvider } from '../types';

class NotebookMetadata extends TreeItem {
    private readonly _children: Record<string, string>;
    constructor(label: string, description?: string | number, children: Record<string, string> = {}) {
        super(
            label,
            Object.keys(children).length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded
        );
        this.description = `${description || ''}`;
        this._children = children;
    }
    public get children() {
        const items: NotebookMetadata[] = [];
        for (const [name, value] of Object.entries(this._children)) {
            const isComplex = typeof value === 'object' && value !== null && value !== undefined;
            const description = isComplex ? '' : value ?? '';
            items.push(new NotebookMetadata(name, description, isComplex ? ((value as unknown) as {}) : {}));
        }
        return items;
    }
}

@injectable()
export class NotebookMetadataView implements TreeDataProvider<NotebookMetadata> {
    private readonly _onDidChangeTreeData = new EventEmitter<void>();
    public get onDidChangeTreeData(): Event<void> {
        return this._onDidChangeTreeData.event;
    }

    constructor(
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        this.notebookEditorProvider.onDidChangeActiveNotebookEditor(
            () => this._onDidChangeTreeData.fire(),
            this,
            disposables
        );
    }
    public getTreeItem(item: NotebookMetadata): TreeItem {
        return item;
    }
    public getChildren(element?: NotebookMetadata | undefined): NotebookMetadata[] {
        if (element) {
            return element.children;
        }
        const model = this.notebookEditorProvider.activeEditor?.model;
        if (!model) {
            return [];
        }

        return [
            new NotebookMetadata('language_info', '', ((model.metadata?.language_info as unknown) as {}) || {}),
            new NotebookMetadata('Kernel Spec', '', ((model.metadata?.kernelspec as unknown) as {}) || {})
        ];
    }
}
