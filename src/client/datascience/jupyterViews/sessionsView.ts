import { Session } from '@jupyterlab/services';
import { inject, injectable } from 'inversify';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
import {
    IJupyterKernel,
    IJupyterNotebookProvider,
    IJupyterSessionManagerFactory,
    INotebookEditorProvider
} from '../types';

class SessionItem extends TreeItem {
    constructor(
        label: string,
        description?: string | number,
        private readonly kernels: IJupyterKernel[] = [],
        private readonly sessions: Session.IModel[] = []
    ) {
        super(label, TreeItemCollapsibleState.Expanded);
        this.description = `${description || ''}`;
    }
    public get children(): TreeItem[] {
        if (this.kernels.length) {
            return this.kernels.map((item) => {
                const treeItem = new TreeItem(item.name, TreeItemCollapsibleState.None);
                treeItem.description = `Last activity time: ${item.lastActivityTime}, # connections ${item.numberOfConnections}`;
                return treeItem;
            });
        } else {
            return this.sessions.map((item) => {
                const treeItem = new TreeItem(item.name, TreeItemCollapsibleState.None);
                treeItem.description = `Type: ${item.type}, path ${item.path}`;
                return treeItem;
            });
        }
    }
}
@injectable()
export class SessionsView implements TreeDataProvider<SessionItem> {
    private readonly _onDidChangeTreeData = new EventEmitter<void>();
    public get onDidChangeTreeData(): Event<void> {
        return this._onDidChangeTreeData.event;
    }

    constructor(
        @inject(IJupyterSessionManagerFactory) private readonly sessionManagerFactory: IJupyterSessionManagerFactory,
        @inject(IJupyterNotebookProvider) private readonly jupyterNotebookProvider: IJupyterNotebookProvider,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        this.notebookEditorProvider.onDidChangeActiveNotebookEditor(
            () => this._onDidChangeTreeData.fire(),
            this,
            disposables
        );
    }
    public getTreeItem(item: SessionItem): TreeItem {
        return item;
    }
    public async getChildren(element?: SessionItem | undefined): Promise<SessionItem[]> {
        if (element) {
            return [];
        }
        const connection = await this.jupyterNotebookProvider.connect({
            disableUI: true,
            getOnly: true,
            localOnly: true
        });
        if (!connection) {
            return [];
        }

        const session = await this.sessionManagerFactory.create(connection);
        const kernels = await session.getRunningKernels();
        const sessions = await session.getRunningSessions();

        return [new SessionItem('Sessions', '', [], sessions), new SessionItem('Kernels', '', kernels)];
    }
}
