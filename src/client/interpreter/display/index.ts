'use strict';
import { StatusBarItem, Disposable } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import * as path from 'path';
import { EOL } from 'os';
import { IInterpreterProvider, PythonInterpreter } from '../index';
import * as utils from '../../common/utils';
import { VirtualEnvironmentManager } from '../virtualEnvs/index';
import { getFirstNonEmptyLineFromMultilineString } from '../sources/helpers';
import * as child_process from 'child_process';

const settings = PythonSettings.getInstance();
export class InterpreterDisplay implements Disposable {
    constructor(private statusBar: StatusBarItem, private interpreterProvoder: IInterpreterProvider, private virtualEnvMgr: VirtualEnvironmentManager) {
        this.statusBar.command = 'python.setInterpreter';
    }
    public dispose() {
    }
    public async refresh() {
        const pythonPath = await this.getFullyQualifiedPathToInterpreter(settings.pythonPath);
        await this.updateDisplay(pythonPath);
    }
    private getInterpreters() {
        return this.interpreterProvoder.getInterpreters();
    }
    private async updateDisplay(pythonPath: string) {
        const interpreters = await this.getInterpreters();
        const interpreter = interpreters.find(i => utils.arePathsSame(i.path, pythonPath));

        this.statusBar.color = '';
        this.statusBar.tooltip = pythonPath;
        if (interpreter) {
            this.statusBar.text = interpreter.displayName;
            if (interpreter.companyDisplayName) {
                const toolTipSuffix = `${EOL}${interpreter.companyDisplayName}`;
                this.statusBar.tooltip += toolTipSuffix;
            }
        }
        else {
            const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
            const interpreterExists = utils.fsExistsAsync(pythonPath);
            const displayName = utils.getInterpreterDisplayName(pythonPath).catch(() => defaultDisplayName);
            const virtualEnvName = this.getVirtualEnvironmentName(pythonPath);
            await Promise.all([interpreterExists, displayName, virtualEnvName])
                .then(([interpreterExists, displayName, virtualEnvName]) => {
                    const dislayNameSuffix = virtualEnvName.length > 0 ? ` (${virtualEnvName})` : '';
                    this.statusBar.text = `${displayName}${dislayNameSuffix}`;;

                    if (!interpreterExists && displayName === defaultDisplayName && interpreters.length > 0) {
                        this.statusBar.color = 'yellow';
                        this.statusBar.text = '$(alert) Select Python Environment';
                    }
                });
        }
        this.statusBar.show();
    }
    private async getVirtualEnvironmentName(pythonPath: string) {
        return this.virtualEnvMgr
            .detect(pythonPath)
            .then(env => env ? env.name : '');
    }
    private getFullyQualifiedPathToInterpreter(pythonPath: string) {
        return new Promise<string>(resolve => {
            child_process.execFile(pythonPath, ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        })
            .then(value => value.length === 0 ? pythonPath : value);
    }
}

