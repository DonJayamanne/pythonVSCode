// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, EventEmitter, Event, Uri } from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createDeferred, createDeferredFrom } from '../../../../common/utils/async';
import { DisposableBase, DisposableStore } from '../../../../common/utils/resourceLifecycle';
import { noop } from '../../../../common/utils/misc';
import { getConfiguration, getWorkspaceFolderPaths } from '../../../../common/vscodeApis/workspaceApis';
import { CONDAPATH_SETTING_KEY } from '../../../common/environmentManagers/conda';
import { VENVFOLDERS_SETTING_KEY, VENVPATH_SETTING_KEY } from '../lowLevel/customVirtualEnvLocator';
import { getUserHomeDir } from '../../../../common/utils/platform';
import { createLogOutputChannel } from '../../../../common/vscodeApis/windowApis';
import { NativePythonEnvironmentKind } from './nativePythonUtils';
import type { IExtensionContext } from '../../../../common/types';
import { StopWatch } from '../../../../common/utils/stopWatch';
// eslint-disable-next-line import/no-absolute-path
import * as finder from '/Users/donjayamanne/Development/vsc/python-environment-tools/crates/pet-nodejs/index.js';

const untildify = require('untildify');

export interface NativeEnvInfo {
    displayName?: string;
    name?: string;
    executable?: string;
    kind?: NativePythonEnvironmentKind;
    version?: string;
    prefix?: string;
    manager?: NativeEnvManagerInfo;
    /**
     * Path to the project directory when dealing with pipenv virtual environments.
     */
    project?: string;
    arch?: 'x64' | 'x86';
    symlinks?: string[];
}

export interface NativeEnvManagerInfo {
    tool: string;
    executable: string;
    version?: string;
}

export function isNativeEnvInfo(info: NativeEnvInfo | NativeEnvManagerInfo): info is NativeEnvInfo {
    if ((info as NativeEnvManagerInfo).tool) {
        return false;
    }
    return true;
}

export type NativeCondaInfo = {
    canSpawnConda: boolean;
    userProvidedEnvFound?: boolean;
    condaRcs: string[];
    envDirs: string[];
    environmentsTxt?: string;
    environmentsTxtExists?: boolean;
    environmentsFromTxt: string[];
};

export interface NativePythonFinder extends Disposable {
    /**
     * Refresh the list of python environments.
     * Returns an async iterable that can be used to iterate over the list of python environments.
     * Internally this will take all of the current workspace folders and search for python environments.
     *
     * If a Uri is provided, then it will search for python environments in that location (ignoring workspaces).
     * Uri can be a file or a folder.
     * If a NativePythonEnvironmentKind is provided, then it will search for python environments of that kind (ignoring workspaces).
     */
    refresh(options?: NativePythonEnvironmentKind | Uri[]): AsyncIterable<NativeEnvInfo | NativeEnvManagerInfo>;
    /**
     * Will spawn the provided Python executable and return information about the environment.
     * @param executable
     */
    resolve(executable: string): Promise<NativeEnvInfo>;
    /**
     * Used only for telemetry.
     */
    getCondaInfo(): Promise<NativeCondaInfo>;
}

const kindMapping = new Map<finder.PythonEnvironmentKind, NativePythonEnvironmentKind>([
    [finder.PythonEnvironmentKind.Conda, NativePythonEnvironmentKind.Conda],
    [finder.PythonEnvironmentKind.Poetry, NativePythonEnvironmentKind.Poetry],
    [finder.PythonEnvironmentKind.GlobalPaths, NativePythonEnvironmentKind.GlobalPaths],
    [finder.PythonEnvironmentKind.LinuxGlobal, NativePythonEnvironmentKind.LinuxGlobal],
    [finder.PythonEnvironmentKind.Homebrew, NativePythonEnvironmentKind.Homebrew],
    [finder.PythonEnvironmentKind.MacCommandLineTools, NativePythonEnvironmentKind.MacCommandLineTools],
    [finder.PythonEnvironmentKind.MacPythonOrg, NativePythonEnvironmentKind.MacPythonOrg],
    [finder.PythonEnvironmentKind.MacXCode, NativePythonEnvironmentKind.MacXCode],
    [finder.PythonEnvironmentKind.Pipenv, NativePythonEnvironmentKind.Pipenv],
    [finder.PythonEnvironmentKind.Pyenv, NativePythonEnvironmentKind.Pyenv],
    [finder.PythonEnvironmentKind.PyenvVirtualEnv, NativePythonEnvironmentKind.PyenvVirtualEnv],
    [finder.PythonEnvironmentKind.Venv, NativePythonEnvironmentKind.Venv],
    [finder.PythonEnvironmentKind.VirtualEnv, NativePythonEnvironmentKind.VirtualEnv],
    [finder.PythonEnvironmentKind.VirtualEnvWrapper, NativePythonEnvironmentKind.VirtualEnvWrapper],
    [finder.PythonEnvironmentKind.WindowsRegistry, NativePythonEnvironmentKind.WindowsRegistry],
    [finder.PythonEnvironmentKind.WindowsStore, NativePythonEnvironmentKind.WindowsStore],
]);
function kindToNativeKind(kind?: finder.PythonEnvironmentKind): NativePythonEnvironmentKind | undefined {
    return kind ? kindMapping.get(kind) : undefined;
}
function archToNativeArch(arch?: finder.Architecture): 'x64' | 'x86' | undefined {
    switch (arch) {
        case finder.Architecture.X64:
            return 'x64';
        case finder.Architecture.X86:
            return 'x86';
        default:
            return undefined;
    }
}
function managerKindToNativeTool(tool: finder.ManagerType): string {
    if (tool === finder.ManagerType.Conda) {
        return 'Conda';
    }
    if (tool === finder.ManagerType.Poetry) {
        return 'Poetry';
    }
    if (tool === finder.ManagerType.Pyenv) {
        return 'Pyenv';
    }
    return '';
}
function managerToNativeManager(manager: finder.Manager): NativeEnvManagerInfo {
    return {
        tool: managerKindToNativeTool(manager.tool),
        executable: manager.executable,
        version: manager.version,
    };
}
function envToNativeEnvInfo(env: finder.PythonEnvironment): NativeEnvInfo {
    return {
        displayName: env.displayName,
        executable: env.executable,
        kind: kindToNativeKind(env.kind),
        name: env.name,
        prefix: env.prefix,
        version: env.version,
        arch: archToNativeArch(env.arch),
        manager: env.manager ? managerToNativeManager(env.manager) : undefined,
        project: env.project,
        symlinks: env.symlinks,
    };
}

class NativePythonFinderImpl extends DisposableBase implements NativePythonFinder {
    private firstRefreshResults: undefined | (() => AsyncGenerator<NativeEnvInfo, void, unknown>);

    private readonly outputChannel = this._register(createLogOutputChannel('Python Locator', { log: true }));

    private initialRefreshMetrics = {
        timeToSpawn: 0,
        timeToConfigure: 0,
        timeToRefresh: 0,
    };

    private _finder: finder.Finder;

    private get finder(): finder.Finder {
        const options = this.createOptions();
        if (JSON.stringify(options) === JSON.stringify(this.lastOptions)) {
            return this._finder;
        }
        this._finder = new finder.Finder(options);
        this.lastOptions = options;
        return this._finder;
    }

    private lastOptions: finder.Options;

    constructor(private readonly cacheDirectory?: Uri) {
        super();
        this.lastOptions = {
            searchPaths: getWorkspaceFolderPaths(),
            // We do not want to mix this with `search_paths`
            environmentDirectories: getCustomVirtualEnvDirs(),
            condaExecutable: getPythonSettingAndUntildify<string>(CONDAPATH_SETTING_KEY),
            poetryExecutable: getPythonSettingAndUntildify<string>('poetryPath'),
            cacheDirectory: this.cacheDirectory?.fsPath,
        };
        const cb = (_: unknown, entry: finder.LogEntry) => {
            switch (entry.level) {
                case finder.LogLevel.Debug:
                    this.outputChannel.debug(entry.message);
                    break;
                case finder.LogLevel.Info:
                    this.outputChannel.info(entry.message);
                    break;
                case finder.LogLevel.Warning:
                    this.outputChannel.warn(entry.message);
                    break;
                case finder.LogLevel.Error:
                    this.outputChannel.error(entry.message);
                    break;
                default:
                    this.outputChannel.error(entry.message);
                    break;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logger = new finder.Logger(cb as any);
        logger.level = finder.LogLevel.Info;
        this._finder = new finder.Finder(this.lastOptions);
        this.firstRefreshResults = this.refreshFirstTime();
    }

    private createOptions() {
        const options: finder.Options = {
            searchPaths: getWorkspaceFolderPaths(),
            // We do not want to mix this with `search_paths`
            environmentDirectories: getCustomVirtualEnvDirs(),
            condaExecutable: getPythonSettingAndUntildify<string>(CONDAPATH_SETTING_KEY),
            poetryExecutable: getPythonSettingAndUntildify<string>('poetryPath'),
            cacheDirectory: this.cacheDirectory?.fsPath,
        };
        return options;
    }

    public async resolve(executable: string): Promise<NativeEnvInfo> {
        const environment = await this.finder.resolve(executable);

        this.outputChannel.info(`Resolved Python Environment ${environment.executable}`);
        return envToNativeEnvInfo(environment);
    }

    async *refresh(options?: NativePythonEnvironmentKind | Uri[]): AsyncIterable<NativeEnvInfo> {
        if (this.firstRefreshResults) {
            // If this is the first time we are refreshing,
            // Then get the results from the first refresh.
            // Those would have started earlier and cached in memory.
            const results = this.firstRefreshResults();
            this.firstRefreshResults = undefined;
            yield* results;
        } else {
            const result = this.doRefresh(options);
            let completed = false;
            void result.completed.finally(() => {
                completed = true;
            });
            const envs: (NativeEnvInfo | NativeEnvManagerInfo)[] = [];
            let discovered = createDeferred();
            const disposable = result.discovered((data) => {
                envs.push(data);
                discovered.resolve();
            });
            do {
                if (!envs.length) {
                    await Promise.race([result.completed, discovered.promise]);
                }
                if (envs.length) {
                    const dataToSend = [...envs];
                    envs.length = 0;
                    for (const data of dataToSend) {
                        yield data;
                    }
                }
                if (!completed) {
                    discovered = createDeferred();
                }
            } while (!completed);
            disposable.dispose();
        }
    }

    refreshFirstTime() {
        // eslint-disable-next-line no-useless-catch
        try {
            const result = this.doRefresh();
            const completed = createDeferredFrom(result.completed);
            const envs: NativeEnvInfo[] = [];
            let discovered = createDeferred();
            const disposable = result.discovered((data) => {
                envs.push(data);
                discovered.resolve();
            });

            const iterable = async function* () {
                do {
                    if (!envs.length) {
                        await Promise.race([completed.promise, discovered.promise]);
                    }
                    if (envs.length) {
                        const dataToSend = [...envs];
                        envs.length = 0;
                        for (const data of dataToSend) {
                            yield data;
                        }
                    }
                    if (!completed.completed) {
                        discovered = createDeferred();
                    }
                } while (!completed.completed);
                disposable.dispose();
            };

            return iterable.bind(this);
        } catch (ex) {
            throw ex;
        }
    }

    private doRefresh(
        _options?: NativePythonEnvironmentKind | Uri[],
    ): { completed: Promise<void>; discovered: Event<NativeEnvInfo | NativeEnvManagerInfo> } {
        const disposable = this._register(new DisposableStore());
        const discovered = disposable.add(new EventEmitter<NativeEnvInfo | NativeEnvManagerInfo>());
        const completed = createDeferred<void>();
        const pendingPromises: Promise<unknown>[] = [];
        const stopWatch = new StopWatch();

        const notifyUponCompletion = () => {
            const initialCount = pendingPromises.length;
            Promise.all(pendingPromises)
                .then(() => {
                    if (initialCount === pendingPromises.length) {
                        completed.resolve();
                    } else {
                        setTimeout(notifyUponCompletion, 0);
                    }
                })
                .catch(noop);
        };
        const trackPromiseAndNotifyOnCompletion = (promise: Promise<unknown>) => {
            pendingPromises.push(promise);
            notifyUponCompletion();
        };

        const onFoundEnv = (_: unknown, env: finder.PythonEnvironment) => {
            const data = envToNativeEnvInfo(env);
            this.outputChannel.info(`Discovered env: ${data.executable || data.prefix}`);
            // We know that in the Python extension if either Version of Prefix is not provided by locator
            // Then we end up resolving the information.
            // Lets do that here,
            // This is a hack, as the other part of the code that resolves the version information
            // doesn't work as expected, as its still a WIP.
            if (data.executable && (!data.version || !data.prefix)) {
                // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                const resolvePromise = this.finder
                    .resolve(data.executable)
                    .then((e) => {
                        const environment = envToNativeEnvInfo(e);
                        this.outputChannel.info(`Resolved ${environment.executable}`);
                        discovered.fire(environment);
                    })
                    .catch((ex) => this.outputChannel.error(`Error in Resolving ${JSON.stringify(data)}`, ex));
                trackPromiseAndNotifyOnCompletion(resolvePromise);
            } else {
                discovered.fire(data);
            }
            discovered.fire(envToNativeEnvInfo(env));
            return undefined;
        };
        const onFoundMgr = (_: unknown, manager: finder.Manager) => {
            const data = managerToNativeManager(manager);
            this.outputChannel.info(`Discovered manager: (${data.tool}) ${data.executable}`);
            discovered.fire(data);
            return undefined;
        };
        const done = createDeferred<void>();
        const onDone = () => {
            console.log('found mgr');
            done.resolve();
        };
        trackPromiseAndNotifyOnCompletion(done.promise);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promise = this.finder.find(onFoundEnv as any, onFoundMgr as any, onDone as any);
        // (env) => {
        //     const data = envToNativeEnvInfo(env);
        //     this.outputChannel.info(`Discovered env: ${data.executable || data.prefix}`);
        //     // We know that in the Python extension if either Version of Prefix is not provided by locator
        //     // Then we end up resolving the information.
        //     // Lets do that here,
        //     // This is a hack, as the other part of the code that resolves the version information
        //     // doesn't work as expected, as its still a WIP.
        //     if (data.executable && (!data.version || !data.prefix)) {
        //         // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
        //         // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
        //         // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
        //         // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
        //         const resolvePromise = this.finder
        //             .resolve(data.executable)
        //             .then((e) => {
        //                 const environment = envToNativeEnvInfo(e);
        //                 this.outputChannel.info(`Resolved ${environment.executable}`);
        //                 discovered.fire(environment);
        //             })
        //             .catch((ex) => this.outputChannel.error(`Error in Resolving ${JSON.stringify(data)}`, ex));
        //         trackPromiseAndNotifyOnCompletion(resolvePromise);
        //     } else {
        //         discovered.fire(data);
        //     }

        //     discovered.fire(envToNativeEnvInfo(env));
        //     return undefined;
        // },
        // (manager) => {
        //     const data = managerToNativeManager(manager);
        //     this.outputChannel.info(`Discovered manager: (${data.tool}) ${data.executable}`);
        //     discovered.fire(data);
        //     return undefined;
        // },
        promise.catch((ex) => {
            console.error('Error in refreshing', ex);
        });
        promise.then((summary) => {
            this.outputChannel.info(`Refresh completed in ${summary.total}ms`);
            this.initialRefreshMetrics.timeToRefresh = stopWatch.elapsedTime;
        });
        trackPromiseAndNotifyOnCompletion(promise);

        completed.promise.finally(() => disposable.dispose());
        return {
            completed: completed.promise,
            discovered: discovered.event,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    async getCondaInfo(): Promise<NativeCondaInfo> {
        throw new Error('1234');
        // return this.connection.sendRequest<NativeCondaInfo>('condaInfo');
    }
}

/**
 * Gets all custom virtual environment locations to look for environments.
 */
function getCustomVirtualEnvDirs(): string[] {
    const venvDirs: string[] = [];
    const venvPath = getPythonSettingAndUntildify<string>(VENVPATH_SETTING_KEY);
    if (venvPath) {
        venvDirs.push(untildify(venvPath));
    }
    const venvFolders = getPythonSettingAndUntildify<string[]>(VENVFOLDERS_SETTING_KEY) ?? [];
    const homeDir = getUserHomeDir();
    if (homeDir) {
        venvFolders.map((item) => path.join(homeDir, item)).forEach((d) => venvDirs.push(d));
    }
    return Array.from(new Set(venvDirs));
}

function getPythonSettingAndUntildify<T>(name: string, scope?: Uri): T | undefined {
    const value = getConfiguration('python', scope).get<T>(name);
    if (typeof value === 'string') {
        return value ? ((untildify(value as string) as unknown) as T) : undefined;
    }
    return value;
}

let _finder: NativePythonFinder | undefined;
export function getNativePythonFinder(context?: IExtensionContext): NativePythonFinder {
    if (!_finder) {
        const cacheDirectory = context ? getCacheDirectory(context) : undefined;
        _finder = new NativePythonFinderImpl(cacheDirectory);
    }
    return _finder;
}

export function getCacheDirectory(context: IExtensionContext): Uri {
    return Uri.joinPath(context.globalStorageUri, 'pythonLocator');
}

export async function clearCacheDirectory(context: IExtensionContext): Promise<void> {
    const cacheDirectory = getCacheDirectory(context);
    await fs.emptyDir(cacheDirectory.fsPath).catch(noop);
}
