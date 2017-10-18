'use strict';
import * as path from 'path';
import { ConfigurationTarget, Disposable, StatusBarAlignment, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { IS_WINDOWS } from '../common/utils';
import { WorkspacePythonPath } from './contracts';
import { InterpreterDisplay } from './display';
import { getActiveWorkspaceUri } from './helpers';
import { InterpreterVersionService } from './interpreterVersion';
import { PythonInterpreterLocatorService } from './locators';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
import { VEnv } from './virtualEnvs/venv';
import { VirtualEnv } from './virtualEnvs/virtualEnv';

const settings = PythonSettings.getInstance();

export class InterpreterManager implements Disposable {
    private disposables: Disposable[] = [];
    private display: InterpreterDisplay | null | undefined;
    private interpreterProvider: PythonInterpreterLocatorService;
    constructor() {
        const virtualEnvMgr = new VirtualEnvironmentManager([new VEnv(), new VirtualEnv()]);
        const statusBar = window.createStatusBarItem(StatusBarAlignment.Left);
        this.interpreterProvider = new PythonInterpreterLocatorService(virtualEnvMgr);
        const versionService = new InterpreterVersionService();
        this.display = new InterpreterDisplay(statusBar, this.interpreterProvider, virtualEnvMgr, versionService);
        settings.addListener('change', () => this.onConfigChanged());

        this.disposables.push(statusBar);
        this.disposables.push(this.display);
    }
    public async refresh() {
        return this.display.refresh();
    }
    public getInterpreters(resource?: Uri) {
        return this.interpreterProvider.getInterpreters(resource);
    }
    public async autoSetInterpreter() {
        if (!this.shouldAutoSetInterpreter()) {
            return;
        }
        const activeWorkspace = getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return;
        }
        const interpreters = await this.interpreterProvider.getInterpreters(activeWorkspace.folderUri);
        const workspacePathUpper = activeWorkspace.folderUri.fsPath.toUpperCase();
        const interpretersInWorkspace = interpreters.filter(interpreter => interpreter.path.toUpperCase().startsWith(workspacePathUpper));
        if (interpretersInWorkspace.length !== 1) {
            return;
        }

        // Ensure this new environment is at the same level as the current workspace.
        // In windows the interpreter is under scripts/python.exe on linux it is under bin/python.
        // Meaning the sub directory must be either scripts, bin or other (but only one level deep).
        const pythonPath = interpretersInWorkspace[0].path;
        const relativePath = path.dirname(pythonPath).substring(activeWorkspace.folderUri.fsPath.length);
        if (relativePath.split(path.sep).filter(l => l.length > 0).length === 2) {
            await this.setPythonPath(pythonPath, activeWorkspace);
        }
    }

    /**
     * Sets the python path in the settings.
     * @param {string} pythonPath
     * @param {WorkspacePythonPath} [workspacePythonPath] If this is not passed, then user setting will be updated
     * @returns {Promise<void>}
     * @memberof InterpreterManager
     */
    public async setPythonPath(pythonPath: string, workspacePythonPath?: WorkspacePythonPath): Promise<void> {
        pythonPath = IS_WINDOWS ? pythonPath.replace(/\\/g, '/') : pythonPath;
        const isMultiRootWorkspace = Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1;
        try {
            if (!workspacePythonPath) {
                return await this.setPythonPathInUserSettings(pythonPath);
            }
            if (!isMultiRootWorkspace) {
                return await this.setPythonPathInSingleWorkspace(pythonPath);
            }
            await this.setPythonPathInWorkspace(pythonPath, workspacePythonPath.configTarget, workspacePythonPath.folderUri);
        }
        catch (reason) {
            // tslint:disable-next-line:no-unsafe-any prefer-type-cast
            const message = reason && typeof reason.message === 'string' ? reason.message as string : '';
            window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${message}`);
            console.error(reason);
        }
    }
    public dispose(): void {
        // tslint:disable-next-line:prefer-type-cast
        this.disposables.forEach(disposable => disposable.dispose() as void);
        this.display = null;
    }
    private async setPythonPathInUserSettings(pythonPath) {
        const pythonConfig = workspace.getConfiguration('python');
        return pythonConfig.update('pythonPath', pythonPath, true);
    }
    private async setPythonPathInSingleWorkspace(pythonPath: string) {
        const pythonConfig = workspace.getConfiguration('python');
        // tslint:disable-next-line:no-non-null-assertion
        const workspacePath = workspace.workspaceFolders![0].uri.fsPath;
        if (pythonPath.toUpperCase().startsWith(workspacePath.toUpperCase())) {
            // tslint:disable-next-line:no-invalid-template-strings
            pythonPath = path.join('${workspaceRoot}', path.relative(workspacePath, pythonPath));
        }
        return pythonConfig.update('pythonPath', pythonPath, false);
    }
    private async setPythonPathInWorkspace(pythonPath, configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder, resource?: Uri) {
        const pythonConfig = workspace.getConfiguration('python', resource);
        if (configTarget === ConfigurationTarget.WorkspaceFolder && resource && pythonPath.toUpperCase().startsWith(resource.fsPath.toUpperCase())) {
            // tslint:disable-next-line:no-invalid-template-strings
            pythonPath = path.join('${workspaceRoot}', path.relative(resource.fsPath, pythonPath));
        }
        return pythonConfig.update('pythonPath', pythonPath, configTarget);
    }
    private shouldAutoSetInterpreter() {
        const activeWorkspace = getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return false;
        }
        const pythonConfig = workspace.getConfiguration('python');
        const pythonPathInConfig = pythonConfig.get('pythonPath', 'python');
        return path.basename(pythonPathInConfig) === pythonPathInConfig;
    }
    private onConfigChanged() {
        if (this.display) {
            // tslint:disable-next-line:no-floating-promises
            this.display.refresh();
        }
    }
}
