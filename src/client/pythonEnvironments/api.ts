// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import {
    GetRefreshEnvironmentsOptions,
    IDiscoveryAPI,
    ProgressNotificationEvent,
    ProgressReportStage,
    PythonLocatorQuery,
    TriggerRefreshOptions,
} from './base/locator';

export type GetLocatorFunc = () => IDiscoveryAPI;

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
class PythonEnvironments implements IDiscoveryAPI {
    private locator!: IDiscoveryAPI;

    constructor(
        // These are factories for the sub-components the full component is composed of:
        private readonly getLocator: GetLocatorFunc,
    ) {
        this.locator = this.getLocator();
    }

    public get onProgress(): Event<ProgressNotificationEvent> {
        return this.locator.onProgress;
    }

    public get refreshState(): ProgressReportStage {
        return this.locator.refreshState;
    }

    public getRefreshPromise(options?: GetRefreshEnvironmentsOptions) {
        return this.locator.getRefreshPromise(options);
    }

    public get onChanged() {
        return this.locator.onChanged;
    }

    public getEnvs(query?: PythonLocatorQuery) {
        return this.locator.getEnvs(query);
    }

    public async resolveEnv(env: string) {
        return this.locator.resolveEnv(env);
    }

    public async triggerRefresh(query?: PythonLocatorQuery, options?: TriggerRefreshOptions) {
        return this.locator.triggerRefresh(query, options);
    }
}

export function createPythonEnvironments(getLocator: GetLocatorFunc): IDiscoveryAPI {
    return new PythonEnvironments(getLocator);
}
