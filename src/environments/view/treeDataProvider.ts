/* eslint-disable max-classes-per-file */
import { inject, injectable } from 'inversify';
import { EventEmitter, TreeDataProvider, TreeItem, Uri, workspace, WorkspaceFolder } from 'vscode';
import { FileChangeType } from '../../client/common/platform/fileSystemWatcher';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

class EnvironmentTypeWrapper {
    public readonly environments: EnvironmentWrapper[];

    constructor(public readonly type: EnvironmentType) {}
}

class Package {
    constructor(
        public readonly env: EnvironmentWrapper,
        public readonly name: string,
        public readonly version: string,
    ) {}
}
class EnvironmentWrapper {
    public get id() {
        return getEnvironmentId(this.env);
    }

    public get env() {
        return this._env;
    }

    public set env(value: PythonEnvironment) {
        this._env = value;
    }

    constructor(public readonly resource: Uri | undefined, private _env: PythonEnvironment) {}
}

function getEnvironmentId(env: PythonEnvironment) {
    return `${env.envName}:${env.path}`;
}
type Node = EnvironmentType | EnvironmentWrapper | PackagesRoot | Package;
@injectable()
export class PythonEnvironmentTreeDataProvider implements TreeDataProvider<Node> {
    private readonly workspaceFolders = new Map<string, WorkspaceFolderWrapper>();

    private readonly interpreterInfo = new Map<string, EnvironmentWrapper>();
    // private readonly workspaceFolders = new Map<string, WorkspaceFolderWrapper>();

    constructor(@inject(IInterpreterService) private readonly interpreterService: IInterpreterService) {
        workspace.onDidChangeWorkspaceFolders((e) => {
            e.removed.forEach((folder) => this.workspaceFolders.delete(folder.uri.toString()));
            e.added.forEach((folder) =>
                this.workspaceFolders.set(folder.uri.toString(), new WorkspaceFolderWrapper(folder)),
            );
            this._changeTreeData.fire();
        });
        this.interpreterService.onDidChangeInterpreters((e) => {
            if (!e.old && !e.new) {
                return;
            }
            if (e.new) {
                const key = getEnvironmentId(e.old || e.new);
                const wrapper = this.interpreterInfo.get(key);
                if (wrapper) {
                    wrapper.env = e.new;
                    this._changeTreeData.fire(wrapper);
                } else {
                    this.interpreterInfo.set(key, new EnvironmentWrapper(e.resource, e.new));
                    this._changeTreeData.fire(wrapper);
                }
            } else if (e.type === FileChangeType.Deleted) {
                const env = e.new || e.old;
                if (env) {
                    const key = getEnvironmentId(env);
                    // const wrapper = this.interpreterInfo.get(key);
                    this.interpreterInfo.delete(key);
                    this._changeTreeData.fire();
                    // if (this.workspaceFolders.has(e.resource))
                }
            }
        });
    }

    private readonly _changeTreeData = new EventEmitter<Node | void | undefined | null>();

    public readonly onDidChangeTreeData = this._changeTreeData.event;

    // eslint-disable-next-line class-methods-use-this
    async getTreeItem(element: Node): Promise<TreeItem> {
        if (element instanceof EnvironmentWrapper) {
            const tree = new TreeItem(element.env.displayName || element.env.envName || element.env.path);
            tree.tooltip = element.env.path;
            tree.description = element.env.path;
            tree.label += `\n${element.env.path}`;
            return tree;
        }
        return new TreeItem('Hello');
    }

    public async getChildren(element?: Node): Promise<Node[]> {
        if (element) {
            return [];
        }
        return Array.from(this.interpreterInfo.values());
    }

    private refreshFolders() {
        if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
            if (this.workspaceFolders.size > 0) {
                this.workspaceFolders.clear();
                this._changeTreeData.fire();
            }
            return;
        }
        for (const folder of workspace.workspaceFolders) {
        }
    }
}
