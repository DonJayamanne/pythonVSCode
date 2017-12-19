// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, FileSystemWatcher, Uri, workspace } from 'vscode';
import { PythonSettings } from '../configSettings';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from '../platform/constants';
import { ICurrentProcess, IDisposableRegistry, IsWindows } from '../types';
import { EnvironmentVariables, IEnvironmentVariablesProvider, IEnvironmentVariablesService } from './types';

@injectable()
export class EnvironmentVariablesProvider implements IEnvironmentVariablesProvider, Disposable {
    private cache = new Map<string, EnvironmentVariables>();
    private fileWatchers = new Map<string, FileSystemWatcher>();
    private disposables: Disposable[] = [];

    constructor( @inject(IEnvironmentVariablesService) private envVarsService: IEnvironmentVariablesService,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[], @inject(IsWindows) private isWidows: boolean,
        @inject(ICurrentProcess) private process: ICurrentProcess) {
        disposableRegistry.push(this);
    }

    public dispose() {
        this.fileWatchers.forEach(watcher => {
            watcher.dispose();
        });
    }
    public async getEnvironmentVariables(resource?: Uri): Promise<EnvironmentVariables> {
        const settings = PythonSettings.getInstance(resource);
        if (!this.cache.has(settings.envFile)) {
            this.createFileWatcher(settings.envFile);
            let mergedVars = await this.envVarsService.parseFile(settings.envFile);
            if (!mergedVars) {
                mergedVars = {};
            }
            this.envVarsService.mergeVariables(this.process.env, mergedVars!);
            const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
            this.envVarsService.appendPath(mergedVars!, this.process.env[pathVariable]);
            this.envVarsService.appendPythonPath(mergedVars!, this.process.env.PYTHONPATH);
            this.cache.set(settings.envFile, mergedVars);
        }
        return this.cache.get(settings.envFile)!;
    }
    private createFileWatcher(envFile: string) {
        if (this.fileWatchers.has(envFile)) {
            return;
        }
        const envFileWatcher = workspace.createFileSystemWatcher(envFile);
        this.fileWatchers.set(envFile, envFileWatcher);
        this.disposables.push(envFileWatcher.onDidChange(() => this.cache.delete(envFile)));
        this.disposables.push(envFileWatcher.onDidCreate(() => this.cache.delete(envFile)));
        this.disposables.push(envFileWatcher.onDidDelete(() => this.cache.delete(envFile)));
    }
}
