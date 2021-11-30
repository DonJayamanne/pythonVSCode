'use strict';

// eslint-disable-next-line camelcase
import * as path from 'path';
import * as fs from 'fs';
import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    Disposable,
    Event,
    EventEmitter,
    Uri,
    WorkspaceConfiguration,
} from 'vscode';
import './extensions';
import { IInterpreterAutoSelectionProxyService } from '../interpreter/autoSelection/types';
import { sendSettingTelemetry } from '../telemetry/envFileTelemetry';
import { IWorkspaceService } from './application/types';
import { WorkspaceService } from './application/workspace';
import { DEFAULT_INTERPRETER_SETTING, isTestExecution } from './constants';
import { IS_WINDOWS } from './platform/constants';
import { IInterpreterPathService, IPythonSettings, ITerminalSettings, Resource } from './types';
import { debounceSync } from './utils/decorators';
import { SystemVariables } from './variables/systemVariables';
import { getOSType, OSType } from './utils/platform';

const untildify = require('untildify');

export class PythonSettings implements IPythonSettings {
    public get onDidChange(): Event<void> {
        return this.changed.event;
    }

    public get pythonPath(): string {
        return this._pythonPath;
    }

    public set pythonPath(value: string) {
        if (this._pythonPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located.
        // E.g. virtual directory name.
        try {
            this._pythonPath = this.getPythonExecutable(value);
        } catch (ex) {
            this._pythonPath = value;
        }
    }

    public get defaultInterpreterPath(): string {
        return this._defaultInterpreterPath;
    }

    public set defaultInterpreterPath(value: string) {
        if (this._defaultInterpreterPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located.
        // E.g. virtual directory name.
        try {
            this._defaultInterpreterPath = this.getPythonExecutable(value);
        } catch (ex) {
            this._defaultInterpreterPath = value;
        }
    }

    private static pythonSettings: Map<string, PythonSettings> = new Map<string, PythonSettings>();

    public downloadLanguageServer = true;

    public envFile = '';

    public venvPath = '';

    public venvFolders: string[] = [];

    public condaPath = '';

    public pipenvPath = '';

    public poetryPath = '';

    public devOptions: string[] = [];

    public terminal!: ITerminalSettings;

    public disableInstallationChecks = false;

    public globalModuleInstallation = false;

    public autoUpdateLanguageServer = true;

    public languageServerIsDefault = true;

    protected readonly changed = new EventEmitter<void>();

    private workspaceRoot: Resource;

    private disposables: Disposable[] = [];

    private _pythonPath = 'python';

    private _defaultInterpreterPath = '';

    private readonly workspace: IWorkspaceService;

    constructor(
        workspaceFolder: Resource,
        private readonly interpreterAutoSelectionService: IInterpreterAutoSelectionProxyService,
        workspace?: IWorkspaceService,
        private readonly interpreterPathService?: IInterpreterPathService,
    ) {
        this.workspace = workspace || new WorkspaceService();
        this.workspaceRoot = workspaceFolder;
        this.initialize();
    }

    public static getInstance(
        resource: Uri | undefined,
        interpreterAutoSelectionService: IInterpreterAutoSelectionProxyService,
        workspace?: IWorkspaceService,
        interpreterPathService?: IInterpreterPathService,
    ): PythonSettings {
        workspace = workspace || new WorkspaceService();
        const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource, workspace).uri;
        const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';

        if (!PythonSettings.pythonSettings.has(workspaceFolderKey)) {
            const settings = new PythonSettings(
                workspaceFolderUri,
                interpreterAutoSelectionService,
                workspace,
                interpreterPathService,
            );
            PythonSettings.pythonSettings.set(workspaceFolderKey, settings);
        }

        return PythonSettings.pythonSettings.get(workspaceFolderKey)!;
    }

    public static getSettingsUriAndTarget(
        resource: Uri | undefined,
        workspace?: IWorkspaceService,
    ): { uri: Uri | undefined; target: ConfigurationTarget } {
        workspace = workspace || new WorkspaceService();
        const workspaceFolder = resource ? workspace.getWorkspaceFolder(resource) : undefined;
        let workspaceFolderUri: Uri | undefined = workspaceFolder ? workspaceFolder.uri : undefined;

        if (!workspaceFolderUri && Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            workspaceFolderUri = workspace.workspaceFolders[0].uri;
        }

        const target = workspaceFolderUri ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Global;
        return { uri: workspaceFolderUri, target };
    }

    public static dispose(): void {
        if (!isTestExecution()) {
            throw new Error('Dispose can only be called from unit tests');
        }

        PythonSettings.pythonSettings.forEach((item) => item && item.dispose());
        PythonSettings.pythonSettings.clear();
    }

    public static toSerializable(settings: IPythonSettings): IPythonSettings {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clone: any = {};
        const keys = Object.entries(settings);
        keys.forEach((e) => {
            const [k, v] = e;
            if (!k.includes('Manager') && !k.includes('Service') && !k.includes('onDid')) {
                clone[k] = v;
            }
        });

        return clone as IPythonSettings;
    }

    public dispose(): void {
        this.disposables.forEach((disposable) => disposable && disposable.dispose());
        this.disposables = [];
    }

    protected update(pythonSettings: WorkspaceConfiguration): void {
        const workspaceRoot = this.workspaceRoot?.fsPath;
        const systemVariables: SystemVariables = new SystemVariables(undefined, workspaceRoot, this.workspace);

        this.pythonPath = this.getPythonPath(systemVariables, workspaceRoot);

        const defaultInterpreterPath = systemVariables.resolveAny(pythonSettings.get<string>('defaultInterpreterPath'));
        this.defaultInterpreterPath = defaultInterpreterPath || DEFAULT_INTERPRETER_SETTING;
        if (this.defaultInterpreterPath === DEFAULT_INTERPRETER_SETTING) {
            const autoSelectedPythonInterpreter = this.interpreterAutoSelectionService.getAutoSelectedInterpreter(
                this.workspaceRoot,
            );
            this.defaultInterpreterPath = autoSelectedPythonInterpreter?.path ?? this.defaultInterpreterPath;
        }
        this.defaultInterpreterPath = getAbsolutePath(this.defaultInterpreterPath, workspaceRoot);

        this.venvPath = systemVariables.resolveAny(pythonSettings.get<string>('venvPath'))!;
        this.venvFolders = systemVariables.resolveAny(pythonSettings.get<string[]>('venvFolders'))!;
        const condaPath = systemVariables.resolveAny(pythonSettings.get<string>('condaPath'))!;
        this.condaPath = condaPath && condaPath.length > 0 ? getAbsolutePath(condaPath, workspaceRoot) : condaPath;
        const pipenvPath = systemVariables.resolveAny(pythonSettings.get<string>('pipenvPath'))!;
        this.pipenvPath = pipenvPath && pipenvPath.length > 0 ? getAbsolutePath(pipenvPath, workspaceRoot) : pipenvPath;
        const poetryPath = systemVariables.resolveAny(pythonSettings.get<string>('poetryPath'))!;
        this.poetryPath = poetryPath && poetryPath.length > 0 ? getAbsolutePath(poetryPath, workspaceRoot) : poetryPath;

        this.downloadLanguageServer = systemVariables.resolveAny(
            pythonSettings.get<boolean>('downloadLanguageServer', true),
        )!;
        this.autoUpdateLanguageServer = systemVariables.resolveAny(
            pythonSettings.get<boolean>('autoUpdateLanguageServer', true),
        )!;

        const envFileSetting = pythonSettings.get<string>('envFile');
        this.envFile = systemVariables.resolveAny(envFileSetting)!;
        sendSettingTelemetry(this.workspace, envFileSetting);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'))!;
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];

        this.disableInstallationChecks = pythonSettings.get<boolean>('disableInstallationCheck') === true;
        this.globalModuleInstallation = pythonSettings.get<boolean>('globalModuleInstallation') === true;
        const terminalSettings = systemVariables.resolveAny(pythonSettings.get<ITerminalSettings>('terminal'))!;
        if (this.terminal) {
            Object.assign<ITerminalSettings, ITerminalSettings>(this.terminal, terminalSettings);
        } else {
            this.terminal = terminalSettings;
            if (isTestExecution() && !this.terminal) {
                this.terminal = {} as ITerminalSettings;
            }
        }
        // Support for travis.
        this.terminal = this.terminal
            ? this.terminal
            : {
                  executeInFileDir: true,
                  launchArgs: [],
                  activateEnvironment: true,
                  activateEnvInCurrentTerminal: false,
              };
    }

    // eslint-disable-next-line class-methods-use-this
    protected getPythonExecutable(pythonPath: string): string {
        return getPythonExecutable(pythonPath);
    }

    protected onWorkspaceFoldersChanged(): void {
        // If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspace.workspaceFolders!.map((workspaceFolder) => workspaceFolder.uri.fsPath);
        const activatedWkspcKeys = Array.from(PythonSettings.pythonSettings.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                PythonSettings.pythonSettings.delete(folder);
            }
        }
    }

    public initialize(): void {
        const onDidChange = () => {
            const currentConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
            this.update(currentConfig);

            // If workspace config changes, then we could have a cascading effect of on change events.
            // Let's defer the change notification.
            this.debounceChangeNotification();
        };
        this.disposables.push(this.workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        this.disposables.push(
            this.interpreterAutoSelectionService.onDidChangeAutoSelectedInterpreter(onDidChange.bind(this)),
        );
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('python')) {
                    onDidChange();
                }
            }),
        );
        if (this.interpreterPathService) {
            this.disposables.push(this.interpreterPathService.onDidChange(onDidChange.bind(this)));
        }

        const initialConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
        if (initialConfig) {
            this.update(initialConfig);
        }
    }

    @debounceSync(1)
    protected debounceChangeNotification(): void {
        this.changed.fire();
    }

    private getPythonPath(
        pythonSettings: WorkspaceConfiguration,
        systemVariables: SystemVariables,
        workspaceRoot: string | undefined,
    ) {
        /**
         * Note that while calling `IExperimentsManager.inExperiment()`, we assume `IExperimentsManager.activate()` is already called.
         * That's not true here, as this method is often called in the constructor,which runs before `.activate()` methods.
         * But we can still use it here for this particular experiment. Reason being that this experiment only changes
         * `pythonPath` setting, and I've checked that `pythonPath` setting is not accessed anywhere in the constructor.
         */
        // DON: Experiment
        const inExperimentDeprecatePythonPath = true;
        // Use the interpreter path service if in the experiment otherwise use the normal settings
        this.pythonPath = systemVariables.resolveAny(
            inExperimentDeprecatePythonPath && this.interpreterPathService
                ? this.interpreterPathService.get(this.workspaceRoot)
                : pythonSettings.get<string>('pythonPath'),
        )!;
        if (
            !process.env.CI_DISABLE_AUTO_SELECTION &&
            (this.pythonPath.length === 0 || this.pythonPath === 'python') &&
            this.interpreterAutoSelectionService
        ) {
            const autoSelectedPythonInterpreter = this.interpreterAutoSelectionService.getAutoSelectedInterpreter(
                this.workspaceRoot,
            );
            if (autoSelectedPythonInterpreter) {
                this.pythonPath = autoSelectedPythonInterpreter.path;
                if (this.workspaceRoot) {
                    this.interpreterAutoSelectionService
                        .setWorkspaceInterpreter(this.workspaceRoot, autoSelectedPythonInterpreter)
                        .ignoreErrors();
                }
            }
        }
        return getAbsolutePath(this.pythonPath, workspaceRoot);
    }
}

function getAbsolutePath(pathToCheck: string, rootDir: string | undefined): string {
    if (!rootDir) {
        rootDir = __dirname;
    }

    pathToCheck = untildify(pathToCheck) as string;
    if (isTestExecution() && !pathToCheck) {
        return rootDir;
    }
    if (pathToCheck.indexOf(path.sep) === -1) {
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}

function getPythonExecutable(pythonPath: string): string {
    pythonPath = untildify(pythonPath) as string;

    // If only 'python'.
    if (
        pythonPath === 'python' ||
        pythonPath.indexOf(path.sep) === -1 ||
        path.basename(pythonPath) === path.dirname(pythonPath)
    ) {
        return pythonPath;
    }

    if (isValidPythonPath(pythonPath)) {
        return pythonPath;
    }
    // Keep python right on top, for backwards compatibility.

    const KnownPythonExecutables = [
        'python',
        'python4',
        'python3.6',
        'python3.5',
        'python3',
        'python2.7',
        'python2',
        'python3.7',
        'python3.8',
        'python3.9',
    ];

    for (let executableName of KnownPythonExecutables) {
        // Suffix with 'python' for linux and 'osx', and 'python.exe' for 'windows'.
        if (IS_WINDOWS) {
            executableName = `${executableName}.exe`;
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'Scripts', executableName))) {
                return path.join(pythonPath, 'Scripts', executableName);
            }
        } else {
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'bin', executableName))) {
                return path.join(pythonPath, 'bin', executableName);
            }
        }
    }

    return pythonPath;
}

function isValidPythonPath(pythonPath: string): boolean {
    return (
        fs.existsSync(pythonPath) &&
        path.basename(getOSType() === OSType.Windows ? pythonPath.toLowerCase() : pythonPath).startsWith('python')
    );
}
