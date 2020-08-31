'use strict';

import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    Disposable,
    Event,
    EventEmitter,
    Uri,
    WorkspaceConfiguration
} from 'vscode';
import '../common/extensions';
import { LogLevel } from '../logging/levels';
import { IWorkspaceService } from './application/types';
import { WorkspaceService } from './application/workspace';
import { isTestExecution } from './constants';
import { ExtensionChannels } from './insidersBuild/types';
import {
    IDataScienceSettings,
    IExperiments,
    IInterpreterPathService,
    ILoggingSettings,
    IPythonSettings,
    LoggingLevelSettingType,
    Resource
} from './types';
import { debounceSync } from './utils/decorators';
import { SystemVariables } from './variables/systemVariables';

// tslint:disable:no-require-imports no-var-requires

// tslint:disable-next-line:completed-docs
export class PythonSettings implements IPythonSettings {
    public get onDidChange(): Event<void> {
        return this.changed.event;
    }

    private static pythonSettings: Map<string, PythonSettings> = new Map<string, PythonSettings>();
    public envFile = '';
    public datascience!: IDataScienceSettings;
    public insidersChannel!: ExtensionChannels;
    public experiments!: IExperiments;
    public logging: ILoggingSettings = { level: LogLevel.Error };

    protected readonly changed = new EventEmitter<void>();
    private workspaceRoot: Resource;
    private disposables: Disposable[] = [];
    private readonly workspace: IWorkspaceService;

    constructor(
        workspaceFolder: Resource,
        workspace?: IWorkspaceService,
        private readonly interpreterPathService?: IInterpreterPathService
    ) {
        this.workspace = workspace || new WorkspaceService();
        this.workspaceRoot = workspaceFolder;
        this.initialize();
    }
    // tslint:disable-next-line:function-name
    public static getInstance(resource: Uri | undefined, workspace?: IWorkspaceService): PythonSettings {
        workspace = workspace || new WorkspaceService();
        const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource, workspace).uri;
        const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';

        if (!PythonSettings.pythonSettings.has(workspaceFolderKey)) {
            const settings = new PythonSettings(workspaceFolderUri, workspace);
            PythonSettings.pythonSettings.set(workspaceFolderKey, settings);
        }
        // tslint:disable-next-line:no-non-null-assertion
        return PythonSettings.pythonSettings.get(workspaceFolderKey)!;
    }

    // tslint:disable-next-line:type-literal-delimiter
    public static getSettingsUriAndTarget(
        resource: Uri | undefined,
        workspace?: IWorkspaceService
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

    // tslint:disable-next-line:function-name
    public static dispose() {
        if (!isTestExecution()) {
            throw new Error('Dispose can only be called from unit tests');
        }
        // tslint:disable-next-line:no-void-expression
        PythonSettings.pythonSettings.forEach((item) => item && item.dispose());
        PythonSettings.pythonSettings.clear();
    }
    public dispose() {
        // tslint:disable-next-line:no-unsafe-any
        this.disposables.forEach((disposable) => disposable && disposable.dispose());
        this.disposables = [];
    }
    // tslint:disable-next-line:cyclomatic-complexity max-func-body-length
    protected update(pythonSettings: WorkspaceConfiguration) {
        const workspaceRoot = this.workspaceRoot?.fsPath;
        const systemVariables: SystemVariables = new SystemVariables(undefined, workspaceRoot, this.workspace);
        const envFileSetting = pythonSettings.get<string>('envFile');
        this.envFile = systemVariables.resolveAny(envFileSetting)!;

        // tslint:disable-next-line: no-any
        const loggingSettings = systemVariables.resolveAny(pythonSettings.get<any>('logging'))!;
        loggingSettings.level = convertSettingTypeToLogLevel(loggingSettings.level);
        if (this.logging) {
            Object.assign<ILoggingSettings, ILoggingSettings>(this.logging, loggingSettings);
        } else {
            this.logging = loggingSettings;
        }

        const experiments = systemVariables.resolveAny(pythonSettings.get<IExperiments>('experiments'))!;
        if (this.experiments) {
            Object.assign<IExperiments, IExperiments>(this.experiments, experiments);
        } else {
            this.experiments = experiments;
        }
        this.experiments = this.experiments
            ? this.experiments
            : {
                  enabled: true,
                  optInto: [],
                  optOutFrom: []
              };

        const dataScienceSettings = systemVariables.resolveAny(
            pythonSettings.get<IDataScienceSettings>('dataScience')
        )!;
        if (this.datascience) {
            Object.assign<IDataScienceSettings, IDataScienceSettings>(this.datascience, dataScienceSettings);
        } else {
            this.datascience = dataScienceSettings;
        }

        this.insidersChannel = pythonSettings.get<ExtensionChannels>('insidersChannel')!;
    }

    protected onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspace.workspaceFolders!.map((workspaceFolder) => workspaceFolder.uri.fsPath);
        const activatedWkspcKeys = Array.from(PythonSettings.pythonSettings.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                PythonSettings.pythonSettings.delete(folder);
            }
        }
    }
    protected initialize(): void {
        const onDidChange = () => {
            const currentConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
            this.update(currentConfig);

            // If workspace config changes, then we could have a cascading effect of on change events.
            // Let's defer the change notification.
            this.debounceChangeNotification();
        };
        this.disposables.push(this.workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('python')) {
                    onDidChange();
                }
            })
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
    protected debounceChangeNotification() {
        this.changed.fire();
    }
}

function convertSettingTypeToLogLevel(setting: LoggingLevelSettingType | undefined): LogLevel | 'off' {
    switch (setting) {
        case 'info': {
            return LogLevel.Info;
        }
        case 'warn': {
            return LogLevel.Warn;
        }
        case 'off': {
            return 'off';
        }
        case 'debug': {
            return LogLevel.Debug;
        }
        default: {
            return LogLevel.Error;
        }
    }
}
