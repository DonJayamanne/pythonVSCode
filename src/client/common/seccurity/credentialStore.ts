// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IPasswordStore } from './types';

export class PasswordStore implements IPasswordStore {
    public get(service: string, account: string): Promise<string> {
        throw new Error('Method not implemented.');
    }
    public update(service: string, account: string, password: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public remove(service: string, account: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
