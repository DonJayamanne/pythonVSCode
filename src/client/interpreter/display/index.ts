'use strict';
import { StatusBarItem, Disposable } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import * as path from 'path';
import { EOL } from 'os';
import { PythonPathSuggestion } from '../contracts';
import { IPythonInterpreterProvider } from '../interpreters';
import * as utils from "../../common/utils";

const settings = PythonSettings.getInstance();
export class InterpreterDisplay implements Disposable {
    private interpreters: PythonPathSuggestion[];
    constructor(private statusBar: StatusBarItem, private interpreterProvoder: IPythonInterpreterProvider) {
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
        return this.interpreters = await this.interpreterProvoder.getPythonInterpreters();
    }
    private async updateDisplay(pythonPath: string) {
        const fullPath = (utils.IS_WINDOWS ? pythonPath.replace(/\//g, "\\") : pythonPath).toUpperCase();
        const interpreters = await this.getInterpreters();
        const interpreter = interpreters.find(i => i.path.toUpperCase() === fullPath);
        this.statusBar.color = '';
        let type = '';
        if (interpreter) {
            this.statusBar.text = interpreter.name;
            type = `${EOL}${interpreter.type}`;
        }
        else {
            const interpreterExists = await utils.validatePath(pythonPath);
            const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
            this.statusBar.text = await this.getInterpreterDisplayName(pythonPath, defaultDisplayName);

            if (!interpreterExists && this.statusBar.text === defaultDisplayName && interpreters.length > 0) {
                this.statusBar.color = 'yellow';
                this.statusBar.text = '$(alert) Select Python Environment';
            }
            else {
                const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
                this.statusBar.text = await this.getInterpreterDisplayName(pythonPath, defaultDisplayName);
            }
        }
        this.statusBar.show();
        this.statusBar.tooltip = `${settings.pythonPath}${type}`;
    }
    private async  getInterpreterDisplayName(pythonPath: string, defaultValue: string) {
        return utils.execPythonFile(pythonPath, ['--version'], __dirname, true)
            .then(version => {
                version = version.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0).join('');
                return version.length > 0 ? version : defaultValue;
            })
            .catch(() => defaultValue);
    }
}

