/* eslint-disable max-classes-per-file */
import { inject, injectable } from 'inversify';
import { flatten } from 'lodash';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
    EventEmitter,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Uri,
    workspace,
    WorkspaceFolder,
} from 'vscode';
import { IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { CondaInfo } from '../../client/pythonEnvironments/common/environmentManagers/conda';
import { EnvironmentType, PythonEnvironment } from '../../client/pythonEnvironments/info';
import { getCondaVersion, getPackages, getPyEnvVersion, PackageInfo } from '../condaHelper';
import { getDisplayPath, getEnvironmentId, getEnvironmentTypeName } from '../helpers';
import { noop } from '../../client/common/utils/misc';

class Package {
    constructor(public readonly pkg: PackageInfo) {}
}
class EnvironmentTypeWrapper {
    public readonly environments = new Set<string>();

    constructor(public readonly type: EnvironmentType) {}
}
class EnvironmentWrapper {
    public get id() {
        return getEnvironmentId(this.env);
    }

    constructor(public env: PythonEnvironment) {}
}

class EnvironmentInfo {
    constructor(public readonly label: string, public value: string) {}
}
class EnviornmentInformationWrapper {
    public readonly info: EnvironmentInfo[] = [];

    constructor(public readonly env: PythonEnvironment) {
        if (env.envName) {
            this.info.push(new EnvironmentInfo('Name', env.envName));
        }
        if (env.version?.raw) {
            this.info.push(new EnvironmentInfo('Version', env.version.raw));
        }
        if (env.architecture !== Architecture.Unknown) {
            this.info.push(
                new EnvironmentInfo('Archictecture', env.architecture === Architecture.x64 ? '64-bit' : '32-bit'),
            );
        }
        if (env.path) {
            this.info.push(new EnvironmentInfo('Executable', getDisplayPath(env.path)));
        }
        if (env.sysPrefix) {
            this.info.push(new EnvironmentInfo('SysPrefix', getDisplayPath(env.sysPrefix)));
        }
        if (env.pipEnvWorkspaceFolder) {
            this.info.push(new EnvironmentInfo('Folder', getDisplayPath(env.pipEnvWorkspaceFolder)));
        }
        this.info.push(new EnvironmentInfo('Environment Type', getEnvironmentTypeName(env.envType)));
    }
}
class PackageWrapper {
    constructor(public readonly env: PythonEnvironment) {}
}
type Node =
    | EnvironmentType
    | EnvironmentWrapper
    | EnviornmentInformationWrapper
    | EnvironmentInfo
    | Package
    | PackageWrapper;

const EnvironmentsCacheMementoKey = 'PYTHON:PACKAGE_MANAGER:ENVS_CACHE';
@injectable()
export class PythonEnvironmentTreeDataProvider implements TreeDataProvider<Node> {
    // private readonly workspaceFolders = new Map<string, WorkspaceFolderWrapper>();

    private readonly interpreterInfo = new Map<string, EnvironmentWrapper>();

    private condaInfo?: CondaInfo;

    private pyEnvVersion?: string;

    private readonly environmentTypes = new Map<EnvironmentType, EnvironmentTypeWrapper>();

    private readonly globalVirtualEnvState: IPersistentState<PythonEnvironment[]>;

    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
    ) {
        this.globalVirtualEnvState = this.persistentStateFactory.createGlobalPersistentState<PythonEnvironment[]>(
            EnvironmentsCacheMementoKey,
            [],
        );
        this.refreshInternal();
    }

    private readonly _changeTreeData = new EventEmitter<Node | void | undefined | null>();

    public readonly onDidChangeTreeData = this._changeTreeData.event;

    // eslint-disable-next-line class-methods-use-this
    async getTreeItem(element: Node): Promise<TreeItem> {
        if (element instanceof EnvironmentWrapper) {
            const version = element.env.version?.raw || '';
            const label =
                element.env.envName ||
                element.env.version?.raw ||
                getDisplayPath(element.env.envPath) ||
                getDisplayPath(element.env.path);
            const tree = new TreeItem(label + (version ? ` (${version})` : ''), TreeItemCollapsibleState.Collapsed);
            tree.tooltip = [version, getDisplayPath(element.env.path)].filter((item) => !!item).join('\n');
            tree.description = getDisplayPath(element.env.path);
            tree.contextValue = 'env';
            tree.iconPath = Uri.file(path.join(EXTENSION_ROOT_DIR, 'resources/logo.svg'));
            return tree;
        }
        if (element instanceof EnviornmentInformationWrapper) {
            const tree = new TreeItem('Info', TreeItemCollapsibleState.Collapsed);
            tree.contextValue = 'envInfo';
            tree.iconPath = new ThemeIcon('info');
            return tree;
        }
        if (element instanceof Package) {
            const tree = new TreeItem(element.pkg.name);
            tree.contextValue = 'package';
            tree.description = element.pkg.version;
            if ('channel' in element.pkg) {
                tree.tooltip = [element.pkg.channel || '', element.pkg.base_url || '']
                    .filter((item) => item.trim().length)
                    .join(': ');
            }
            tree.iconPath = new ThemeIcon('library');
            return tree;
        }
        if (element instanceof PackageWrapper) {
            const tree = new TreeItem('Packages', TreeItemCollapsibleState.Collapsed);
            tree.contextValue = 'packageContainer';
            tree.iconPath = new ThemeIcon('package');
            return tree;
        }
        if (element instanceof EnvironmentInfo) {
            const tree = new TreeItem(element.label);
            tree.description = element.value;
            tree.contextValue = 'info';
            return tree;
        }
        const tree = new TreeItem(getEnvironmentTypeName(element), TreeItemCollapsibleState.Collapsed);
        tree.contextValue = 'envType';
        if (element === EnvironmentType.Conda && this.condaInfo) {
            tree.description = this.condaInfo.conda_version;
        } else if (element === EnvironmentType.Pyenv && this.pyEnvVersion) {
            tree.description = this.pyEnvVersion;
        }
        tree.iconPath = new ThemeIcon('folder-library');
        return tree;
    }

    public async getChildren(element?: Node): Promise<Node[]> {
        if (!element) {
            return Array.from(this.environmentTypes.keys()).sort();
        }
        if (element instanceof Package) {
            return [];
        }
        if (element instanceof EnviornmentInformationWrapper) {
            return element.info;
        }
        if (element instanceof EnvironmentInfo) {
            return [];
        }
        if (element instanceof EnvironmentWrapper) {
            return [new EnviornmentInformationWrapper(element.env), new PackageWrapper(element.env)];
        }
        if (element instanceof PackageWrapper) {
            return getPackages(element.env).then((pkgs) => pkgs.map((pkg) => new Package(pkg)));
        }
        const envType = this.environmentTypes.get(element);
        return envType
            ? Array.from(envType.environments)
                  .map((key) => this.interpreterInfo.get(key)!)
                  .sort()
            : [];
    }

    public refresh() {
        this.interpreterService.triggerRefresh().then(() => this.refreshInternal());
    }

    private refreshInternal() {
        this.refreshToolVersions();
        this.refreshEnvironments().then((environments) => this.buildEnvironments(environments));
    }

    private async refreshToolVersions() {
        void getCondaVersion().then((info) => {
            if (info) {
                this.condaInfo = info;
                if (this.environmentTypes.has(EnvironmentType.Conda)) {
                    this._changeTreeData.fire(EnvironmentType.Conda);
                }
            }
        });
        void getPyEnvVersion().then((version) => {
            if (version) {
                this.pyEnvVersion = version;
                if (this.environmentTypes.has(EnvironmentType.Pyenv)) {
                    this._changeTreeData.fire(EnvironmentType.Pyenv);
                }
            }
        });
    }

    private buildEnvironments(environments: PythonEnvironment[]) {
        const updatedEnvironments = new Set<string>();
        let updated = false;
        const latestEnvTypes = new Set<EnvironmentType>();
        const latestEnvironments = new Set<string>();
        environments.forEach((environment) => {
            const key = getEnvironmentId(environment);
            latestEnvTypes.add(environment.envType);
            latestEnvironments.add(key);

            const existing = this.interpreterInfo.get(key);
            if (existing) {
                if (JSON.stringify(existing.env) !== JSON.stringify(environment)) {
                    existing.env = environment;
                    updatedEnvironments.add(key);
                }
            } else {
                updated = true;
                updatedEnvironments.add(key);
                this.interpreterInfo.set(key, new EnvironmentWrapper(environment));
            }
            const type = environment.envType;
            let typeWrapper = this.environmentTypes.get(type);
            if (!typeWrapper) {
                updated = true;
                typeWrapper = new EnvironmentTypeWrapper(type);
                typeWrapper.environments.add(key);
                this.environmentTypes.set(type, typeWrapper);
            } else if (!typeWrapper.environments.has(key)) {
                updated = true;
                typeWrapper.environments.add(key);
            }
        });
        if (latestEnvTypes.size !== this.environmentTypes.size) {
            Array.from(this.environmentTypes.keys())
                .filter((envType) => !latestEnvTypes.has(envType))
                .forEach((envType) => {
                    this.environmentTypes.delete(envType);
                    updated = true;
                });
        }
        // Ensure we remove old environments that are no longer valid.
        this.environmentTypes.forEach((envType) => {
            Array.from(envType.environments)
                .filter((envId) => !latestEnvironments.has(envId))
                .forEach((envId) => {
                    envType.environments.delete(envId);
                    updated = true;
                });
        });

        if (updated) {
            this._changeTreeData.fire();
        }
    }

    private async refreshEnvironments() {
        const cachedEnvironments: PythonEnvironment[] = [];
        const cachedEnvsPromise = Promise.all(
            this.globalVirtualEnvState.value.map(async (environment) => {
                if (await fs.pathExists(environment.path)) {
                    cachedEnvironments.push(environment);
                }
            }),
        );
        const interpreters = await Promise.all([
            ...(workspace.workspaceFolders || ([] as WorkspaceFolder[])).map(async (folder) =>
                this.interpreterService.getAllInterpreters(folder.uri),
            ),

            this.interpreterService.getAllInterpreters(undefined),
        ]);
        await cachedEnvsPromise.catch(noop);
        // Remove duplicates.
        const uniqueInterpreters = new Map<string, PythonEnvironment>();

        // Include virtual environments from other workspace folders.
        cachedEnvironments.forEach((environment) => uniqueInterpreters.set(getEnvironmentId(environment), environment));
        flatten(interpreters).forEach((environment) =>
            uniqueInterpreters.set(getEnvironmentId(environment), environment),
        );

        const environments = Array.from(uniqueInterpreters.values());
        // This way we can view virtual environments (or any other environment) across other folders.
        void this.globalVirtualEnvState.updateValue(environments);
        return environments;
    }
}
