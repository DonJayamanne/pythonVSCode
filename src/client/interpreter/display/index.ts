'use strict';
import { StatusBarItem, Disposable } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import * as path from 'path';
import { EOL } from 'os';
import { IInterpreterProvider, PythonInterpreter } from '../index';
import * as utils from "../../common/utils";
import { VirtualEnvironmentManager } from '../virtualEnvs/index';

const settings = PythonSettings.getInstance();
export class InterpreterDisplay implements Disposable {
    private interpreters: PythonInterpreter[];
    constructor(private statusBar: StatusBarItem, private interpreterProvoder: IInterpreterProvider, private virtualEnvMgr: VirtualEnvironmentManager) {
        this.statusBar.command = 'python.setInterpreter';
    }
    public dispose() {
    }
    public async refresh() {
        await this.updateDisplay(settings.pythonPath);
    }
    private async getInterpreters() {
        if (Array.isArray(this.interpreters) && this.interpreters.length > 0) {
            return this.interpreters;
        }
        return this.interpreters = await this.interpreterProvoder.getInterpreters();
    }
    private async updateDisplay(pythonPath: string) {
        const interpreters = await this.getInterpreters();
        const interpreter = interpreters.find(i => utils.arePathsSame(i.path, pythonPath));
        const virtualEnvName = await this.getVirtualEnvironmentName();
        const dislayNameSuffix = virtualEnvName.length > 0 ? ` (${virtualEnvName})` : '';

        this.statusBar.color = '';
        let toolTipSuffix = '';
        if (interpreter) {
            this.statusBar.text = `${interpreter.displayName}${dislayNameSuffix}`;
            toolTipSuffix = `${EOL}${interpreter.companyDisplayName}`;
        }
        else {
            const interpreterExists = await utils.fsExistsAsync(pythonPath);
            const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
            const displayName = await this.getInterpreterDisplayName(pythonPath, defaultDisplayName);
            this.statusBar.text = `${displayName}${dislayNameSuffix}`;;

            if (!interpreterExists && displayName === defaultDisplayName && interpreters.length > 0) {
                this.statusBar.color = 'yellow';
                this.statusBar.text = '$(alert) Select Python Environment';
            }
        }
        this.statusBar.show();
        this.statusBar.tooltip = `${settings.pythonPath}${toolTipSuffix}`;
    }
    private async  getInterpreterDisplayName(pythonPath: string, defaultValue: string) {
        return utils.execPythonFile(pythonPath, ['--version'], __dirname, true)
            .then(version => {
                version = version.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0).join('');
                return version.length > 0 ? version : defaultValue;
            })
            .catch(() => defaultValue);
    }
    private async getVirtualEnvironmentName() {
        return this.virtualEnvMgr
            .detect(settings.pythonPath)
            .then(env => env ? env.name : '');
    }
}

