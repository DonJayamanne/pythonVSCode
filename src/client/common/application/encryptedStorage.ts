// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { env } from 'vscode';
import { IApplicationEnvironment, IAuthenticationService, IEncryptedStorage } from './types';

import type * as keytarType from 'keytar';

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;
function getNodeModule<T>(moduleName: string): T | undefined {
    const r = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
    try {
        return r(`${env.appRoot}/node_modules.asar/${moduleName}`);
    } catch (err) {
        // Not in ASAR.
    }
    try {
        return r(`${env.appRoot}/node_modules/${moduleName}`);
    } catch (err) {
        // Not available.
    }
    return undefined;
}

// Use it
const keytar = getNodeModule<typeof keytarType>('keytar');

/**
 * Class that wraps keytar and authentication to provide a way to write out and save a string
 * This class MUST run inside of VS code though
 */
@injectable()
export class EncryptedStorage implements IEncryptedStorage {
    constructor(
        @inject(IApplicationEnvironment) private readonly appEnv: IApplicationEnvironment,
        @inject(IAuthenticationService) private readonly authenService: IAuthenticationService
    ) {}

    public async store(service: string, key: string, value: string | undefined): Promise<void> {
        // When not in insiders, use keytar
        if (this.appEnv.channel !== 'insiders') {
            if (!value) {
                await keytar?.deletePassword(service, key);
            } else {
                return keytar?.setPassword(service, key, value);
            }
        } else {
            if (!value) {
                await this.authenService.deletePassword(`${service}.${key}`);
            } else {
                await this.authenService.setPassword(`${service}.${key}`, value);
            }
        }
    }
    public async retrieve(service: string, key: string): Promise<string | undefined> {
        // When not in insiders, use keytar
        if (this.appEnv.channel !== 'insiders') {
            const val = await keytar?.getPassword(service, key);
            return val ? val : undefined;
        } else {
            // tslint:disable-next-line: no-unnecessary-local-variable
            const val = await this.authenService.getPassword(`${service}.${key}`);
            return val;
        }
    }
}
