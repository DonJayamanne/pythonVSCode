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
    IExperiments,
    ILoggingSettings,
    InteractiveWindowMode,
    IVariableQuery,
    IWatchableJupyterSettings,
    LoggingLevelSettingType,
    Resource,
    WidgetCDNs
} from './types';
import { debounceSync } from './utils/decorators';
import { SystemVariables } from './variables/systemVariables';

// tslint:disable:no-require-imports no-var-requires

// tslint:disable-next-line:completed-docs
export class JupyterSettings implements IWatchableJupyterSettings {
    public get onDidChange(): Event<void> {
        return this._changeEmitter.event;
    }

    private static jupyterSettings: Map<string, JupyterSettings> = new Map<string, JupyterSettings>();
    public experiments!: IExperiments;
    public logging: ILoggingSettings = { level: LogLevel.Error };
    public insidersChannel: ExtensionChannels = 'off';
    public allowImportFromNotebook: boolean = false;
    public allowUnauthorizedRemoteConnection: boolean = false;
    public alwaysTrustNotebooks: boolean = false;
    public jupyterInterruptTimeout: number = 10_000;
    public jupyterLaunchTimeout: number = 60_000;
    public jupyterLaunchRetries: number = 3;
    public jupyterServerURI: string = 'local';
    public notebookFileRoot: string = '';
    public changeDirOnImportExport: boolean = false;
    public useDefaultConfigForJupyter: boolean = false;
    public searchForJupyter: boolean = false;
    public allowInput: boolean = false;
    public showCellInputCode: boolean = false;
    public collapseCellInputCodeByDefault: boolean = false;
    public maxOutputSize: number = -1;
    public enableScrollingForCellOutputs: boolean = false;
    public gatherToScript: boolean = false;
    public gatherSpecPath: string = '';
    public sendSelectionToInteractiveWindow: boolean = false;
    public markdownRegularExpression: string = '';
    public codeRegularExpression: string = '';
    public allowLiveShare: boolean = false;
    public errorBackgroundColor: string = '';
    public ignoreVscodeTheme: boolean = false;
    public variableExplorerExclude: string = '';
    public liveShareConnectionTimeout: number = 0;
    public decorateCells: boolean = false;
    public enableCellCodeLens: boolean = false;
    public askForLargeDataFrames: boolean = false;
    public enableAutoMoveToNextCell: boolean = false;
    public askForKernelRestart: boolean = false;
    public enablePlotViewer: boolean = false;
    public codeLenses: string = '';
    public debugCodeLenses: string = '';
    public debugpyDistPath: string = '';
    public stopOnFirstLineWhileDebugging: boolean = false;
    public textOutputLimit: number = 0;
    public magicCommandsAsComments: boolean = false;
    public stopOnError: boolean = false;
    public remoteDebuggerPort: number = 0;
    public colorizeInputBox: boolean = false;
    public addGotoCodeLenses: boolean = false;
    public useNotebookEditor: boolean = false;
    public runMagicCommands: string = '';
    public runStartupCommands: string | string[] = [];
    public debugJustMyCode: boolean = false;
    public defaultCellMarker: string = '';
    public verboseLogging: boolean = false;
    public themeMatplotlibPlots: boolean = false;
    public useWebViewServer: boolean = false;
    public variableQueries: IVariableQuery[] = [];
    public disableJupyterAutoStart: boolean = false;
    public jupyterCommandLineArguments: string[] = [];
    public widgetScriptSources: WidgetCDNs[] = [];
    public alwaysScrollOnNewCell: boolean = false;
    public showKernelSelectionOnInteractiveWindow: boolean = false;
    public interactiveWindowMode: InteractiveWindowMode = 'multiple';
    // Privates should start with _ so that they are not read from the settings.json
    private _changeEmitter = new EventEmitter<void>();
    private _workspaceRoot: Resource;
    private _disposables: Disposable[] = [];
    private readonly _workspace: IWorkspaceService;

    constructor(workspaceFolder: Resource, workspace?: IWorkspaceService) {
        this._workspace = workspace || new WorkspaceService();
        this._workspaceRoot = workspaceFolder;
        this.initialize();
    }
    // tslint:disable-next-line:function-name
    public static getInstance(resource: Uri | undefined, workspace?: IWorkspaceService): JupyterSettings {
        workspace = workspace || new WorkspaceService();
        const workspaceFolderUri = JupyterSettings.getSettingsUriAndTarget(resource, workspace).uri;
        const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';

        if (!JupyterSettings.jupyterSettings.has(workspaceFolderKey)) {
            const settings = new JupyterSettings(workspaceFolderUri, workspace);
            JupyterSettings.jupyterSettings.set(workspaceFolderKey, settings);
        }
        // tslint:disable-next-line:no-non-null-assertion
        return JupyterSettings.jupyterSettings.get(workspaceFolderKey)!;
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
        JupyterSettings.jupyterSettings.forEach((item) => item && item.dispose());
        JupyterSettings.jupyterSettings.clear();
    }
    public dispose() {
        // tslint:disable-next-line:no-unsafe-any
        this._disposables.forEach((disposable) => disposable && disposable.dispose());
        this._disposables = [];
    }

    public toJSON() {
        // Override this so settings can be turned into JSON without a circular problem

        // tslint:disable-next-line: no-any
        const result: any = {};
        const allowedKeys = this.getSerializableKeys();
        // tslint:disable-next-line: no-any
        allowedKeys.forEach((k) => (result[k] = (<any>this)[k]));
        return result;
    }
    // tslint:disable-next-line:cyclomatic-complexity max-func-body-length
    protected update(jupyterConfig: WorkspaceConfiguration) {
        const workspaceRoot = this._workspaceRoot?.fsPath;
        const systemVariables: SystemVariables = new SystemVariables(undefined, workspaceRoot, this._workspace);

        // tslint:disable-next-line: no-any
        const loggingSettings = systemVariables.resolveAny(jupyterConfig.get<any>('logging'))!;
        if (loggingSettings) {
            loggingSettings.level = convertSettingTypeToLogLevel(loggingSettings.level);
            if (this.logging) {
                Object.assign<ILoggingSettings, ILoggingSettings>(this.logging, loggingSettings);
            } else {
                this.logging = loggingSettings;
            }
        }

        const experiments = systemVariables.resolveAny(jupyterConfig.get<IExperiments>('experiments'))!;
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

        // The rest are all the same.
        const keys = this.getSerializableKeys().filter((f) => f !== 'experiments' && f !== 'logging');
        keys.forEach((k) => {
            // Replace variables with their actual value.
            const val = systemVariables.resolveAny(jupyterConfig.get(k));
            // tslint:disable-next-line: no-any
            (<any>this)[k] = val;
        });
    }

    protected onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, delete its key
        const workspaceKeys = this._workspace.workspaceFolders!.map((workspaceFolder) => workspaceFolder.uri.fsPath);
        const activatedWkspcKeys = Array.from(JupyterSettings.jupyterSettings.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                JupyterSettings.jupyterSettings.delete(folder);
            }
        }
    }
    protected initialize(): void {
        const onDidChange = () => {
            const currentConfig = this._workspace.getConfiguration('jupyter', this._workspaceRoot);
            this.update(currentConfig);

            // If workspace config changes, then we could have a cascading effect of on change events.
            // Let's defer the change notification.
            this.debounceChangeNotification();
        };
        this._disposables.push(this._workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        this._disposables.push(
            this._workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('jupyter')) {
                    onDidChange();
                }
            })
        );

        const initialConfig = this._workspace.getConfiguration('jupyter', this._workspaceRoot);
        if (initialConfig) {
            this.update(initialConfig);
        }
    }
    @debounceSync(1)
    protected debounceChangeNotification() {
        this._changeEmitter.fire();
    }

    protected fireChangeNotification() {
        this._changeEmitter.fire();
    }

    private getSerializableKeys() {
        // Get the keys that are allowed.
        return Object.getOwnPropertyNames(this).filter((f) => !f.startsWith('_'));
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
