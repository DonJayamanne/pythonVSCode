// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-require-imports

import '../../common/extensions';

type CacheData = {
    value: unknown;
    expiry: number;
};
const resourceSpecificCacheStores = new Map<string, Map<string, CacheData>>();
export class DataWithExpiry {
    private readonly expiryTime: number;
    constructor(expiryDuration: number, private _data: any) {
        this.expiryTime = expiryDuration + Date.now();
    }
    public get expired() {
        const hasExpired = this.expiryTime <= Date.now();
        if (hasExpired) {
            this._data = undefined;
        }
        return hasExpired;
    }
    public get data(): any {
        if (this.expired) {
            this._data = undefined;
        }
        return this._data;
    }
}
const globalCacheStore = new Map<string, DataWithExpiry>();

/**
 * Gets a cache store to be used to store return values of methods or any other.
 *
 * @returns
 */
export function getGlobalCacheStore() {
    return globalCacheStore;
}

export function getCacheKeyFromFunctionArgs(keyPrefix: string, fnArgs: any[]): string {
    const argsKey = fnArgs.map((arg) => `${JSON.stringify(arg)}`).join('-Arg-Separator-');
    return `KeyPrefix=${keyPrefix}-Args=${argsKey}`;
}

export function clearCache() {
    globalCacheStore.clear();
    resourceSpecificCacheStores.clear();
}

export class InMemoryCache<T> {
    constructor(private readonly expiryDurationMs: number, private readonly cacheKey: string = '') {}
    public get hasData() {
        const store = globalCacheStore.get(this.cacheKey);
        return store && !store.expired ? true : false;
    }
    /**
     * Returns undefined if there is no data.
     * Uses `hasData` to determine whether any cached data exists.
     *
     * @readonly
     * @type {(T | undefined)}
     * @memberof InMemoryCache
     */
    public get data(): T | undefined {
        if (!this.hasData) {
            return;
        }
        const store = globalCacheStore.get(this.cacheKey);
        return store?.data;
    }
    public set data(value: T | undefined) {
        const store = new DataWithExpiry(this.expiryDurationMs, value);
        globalCacheStore.set(this.cacheKey, store);
    }
    public clear() {
        globalCacheStore.delete(this.cacheKey);
    }
}
