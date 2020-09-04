import { SpawnOptions } from 'child_process';
import { inject, injectable } from 'inversify';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import { IExtensions, Resource } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { noop } from '../common/utils/misc';
import {
    IEnvironmentActivationService,
    IInterpreterService,
    PythonApi,
    PythonEnvironment,
    PythonExecutionInfo
} from './types';

@injectable()
export class PythonApiService implements IInterpreterService, IEnvironmentActivationService {
    private _onDidChangeInterpreter = new EventEmitter<Resource>();

    public get onDidChangeInterpreter(): Event<Resource> {
        return this._onDidChangeInterpreter.event;
    }

    private realService?: Deferred<PythonApi>;

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) {}
    public async getExecutionDetails(
        options:
            | {
                  args: string[];
                  moduleName: string;
                  options: SpawnOptions;
              }
            | {
                  args: string[];
                  fileName: string;
                  options: SpawnOptions;
              }
            | {
                  args: string[];
                  code?: string;
                  options: SpawnOptions;
              }
    ): Promise<PythonExecutionInfo> {
        await this.initialize();
        const svc = await this.realService!.promise;
        // eslint-disable-next-line consistent-return
        return svc.getExecutionDetails(options);
    }

    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment
    ): Promise<NodeJS.ProcessEnv | undefined> {
        await this.initialize();
        interpreter = interpreter || (await this.getActiveInterpreter(resource));
        if (!interpreter) {
            return;
        }
        const svc = await this.realService!.promise;
        // eslint-disable-next-line consistent-return
        return svc.getActivatedEnvironmentVariables({ pythonPath: interpreter.path, resource });
    }

    public registerRealService(realService: PythonApi): void {
        this.realService = this.realService || createDeferred<PythonApi>();
        this.realService!.resolve(realService);
    }

    public async getInterpreters(resource: Resource): Promise<PythonEnvironment[]> {
        await this.initialize();
        return this.realService!.promise.then((svc) => svc.getInterpreters(resource));
    }

    public async getActiveInterpreter(resource: Resource): Promise<PythonEnvironment | undefined> {
        await this.initialize();
        return this.realService!.promise.then((svc) => svc.getActiveInterpreter(resource));
    }

    public async getInterpreterDetails(pythonPath: string): Promise<PythonEnvironment | undefined> {
        await this.initialize();
        return this.realService!.promise.then((svc) => svc.getInterpreterDetails(pythonPath));
    }

    private async initialize() {
        if (this.realService) {
            return this.realService.promise;
        }
        this.realService = createDeferred<PythonApi>();
        const pythonExtension = this.extensions.getExtension<{ jupyter: { registerHooks(): void } }>(
            'ms-python.python'
        );
        if (!pythonExtension) {
            // tslint:disable-next-line: messages-must-be-localized
            this.appShell.showErrorMessage('Install Python Extension').then(noop, noop);
            return;
        }
        if (!pythonExtension.isActive) {
            await pythonExtension.activate();
        }
        pythonExtension.exports.jupyter.registerHooks();
        await this.realService!.promise;
    }
}
