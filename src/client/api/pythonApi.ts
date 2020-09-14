// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable comma-dangle */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable max-classes-per-file */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable class-methods-use-this */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable consistent-return */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import { InterpreterUri } from '../common/installer/types';
import { IExtensions, InstallerResponse, Product, Resource } from '../common/types';
import { createDeferred } from '../common/utils/async';
import { noop } from '../common/utils/misc';
import { IEnvironmentActivationService } from '../interpreter/activation/types';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../interpreter/configuration/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IWindowsStoreInterpreter } from '../interpreter/locators/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { IPythonInstaller, PythonApi } from './types';

@injectable()
export class PythonApiProvider {
    private readonly api = createDeferred<PythonApi>();

    private initialized?: boolean;

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) {}

    public getApi(): Promise<PythonApi> {
        this.init().catch(noop);
        return this.api.promise;
    }

    public setApi(api: PythonApi): void {
        if (this.api.resolved) {
            return;
        }
        this.api.resolve(api);
    }

    private async init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
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
    }
}

@injectable()
export class WindowsStoreInterpreter implements IWindowsStoreInterpreter {
    constructor(@inject(PythonApiProvider) private readonly api: PythonApiProvider) {}

    public isWindowsStoreInterpreter(pythonPath: string): Promise<boolean> {
        return this.api.getApi().then((api) => api.isWindowsStoreInterpreter(pythonPath));
    }
}

@injectable()
export class PythonInstaller implements IPythonInstaller {
    constructor(@inject(PythonApiProvider) private readonly api: PythonApiProvider) {}

    public install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        return this.api.getApi().then((api) => api.install(product, resource, cancel));
    }
}

// tslint:disable-next-line: max-classes-per-file
@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService {
    constructor(@inject(PythonApiProvider) private readonly api: PythonApiProvider) {}

    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment
    ): Promise<NodeJS.ProcessEnv | undefined> {
        return this.api.getApi().then((api) => api.getActivatedEnvironmentVariables(resource, interpreter, true));
    }
}

// tslint:disable-next-line: max-classes-per-file
@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    constructor(@inject(PythonApiProvider) private readonly api: PythonApiProvider) {}

    public async getSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]> {
        return this.api.getApi().then((api) => api.getSuggestions(resource));
    }
}
// tslint:disable-next-line: max-classes-per-file
@injectable()
export class InterpreterService implements IInterpreterService {
    private readonly didChangeInterpreter = new EventEmitter<void>();

    constructor(@inject(PythonApiProvider) private readonly api: PythonApiProvider) {}

    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreter.event;
    }

    public getInterpreters(resource?: Uri): Promise<PythonEnvironment[]> {
        return this.api.getApi().then((api) => api.getInterpreters(resource));
    }

    public getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined> {
        return this.api.getApi().then((api) => api.getActiveInterpreter(resource));
    }

    public getInterpreterDetails(pythonPath: string, resource?: Uri): Promise<undefined | PythonEnvironment> {
        return this.api.getApi().then((api) => api.getInterpreterDetails(pythonPath, resource));
    }

    public initialize(): void {
        // Noop.
    }
}
