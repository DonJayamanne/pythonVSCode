'use strict';
import { InterpreterVersionService } from './interpreterVersion';
import { VirtualEnv } from './virtualEnvs/virtualEnv';
import { VEnv } from './virtualEnvs/venv';
import { Disposable, window, StatusBarAlignment, workspace } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { InterpreterDisplay } from './display';
import { PythonInterpreterLocatorService } from './locators';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
import { IS_WINDOWS } from '../common/utils';
import * as path from 'path';

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
        settings.addListener('change', this.onConfigChanged.bind(this));
        this.display.refresh();

        this.disposables.push(statusBar);
        this.disposables.push(this.display);
    }
    public getInterpreters() {
        return this.interpreterProvider.getInterpreters();
    }
    public async autoSetInterpreter() {
        if (!this.shouldAutoSetInterpreter()) {
            return;
        }
        const interpreters = await this.interpreterProvider.getInterpreters();
        const rootPath = workspace.rootPath!.toUpperCase();
        const interpretersInWorkspace = interpreters.filter(interpreter => interpreter.path.toUpperCase().startsWith(rootPath));
        if (interpretersInWorkspace.length !== 1) {
            return;
        }

        // Ensure this new environment is at the same level as the current workspace.
        // In windows the interpreter is under scripts/python.exe on linux it is under bin/python.
        // Meaning the sub directory must be either scripts, bin or other (but only one level deep).
        const pythonPath = interpretersInWorkspace[0].path;
        const relativePath = path.dirname(pythonPath).substring(workspace.rootPath!.length);
        if (relativePath.split(path.sep).filter(l => l.length > 0).length === 2) {
            this.setPythonPath(pythonPath);
        }
    }

    public setPythonPath(pythonPath: string) {
        pythonPath = IS_WINDOWS ? pythonPath.replace(/\\/g, "/") : pythonPath;
        if (pythonPath.startsWith(workspace.rootPath!)) {
            pythonPath = path.join('${workspaceRoot}', path.relative(workspace.rootPath!, pythonPath));
        }
        const pythonConfig = workspace.getConfiguration('python');
        var configurationTarget = null;
        if (typeof workspace.rootPath !== 'string') {
            configurationTarget = true; 
        }
        pythonConfig.update('pythonPath', pythonPath, configurationTarget).then(() => {
            //Done
        }, reason => {
            window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${reason.message}`);
            console.error(reason);
        });
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.display = null;
    }
    private shouldAutoSetInterpreter() {
        if (!workspace.rootPath) {
            return false;
        }
        const pythonConfig = workspace.getConfiguration('python');
        const pythonPathInConfig = pythonConfig.get('pythonPath', 'python');
        return pythonPathInConfig.toUpperCase() === 'PYTHON';
    }
    private onConfigChanged() {
        if (this.display) {
            this.display.refresh();
        }
    }
}