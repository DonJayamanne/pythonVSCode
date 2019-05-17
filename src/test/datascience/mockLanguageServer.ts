// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient';

import { ILanguageServer } from '../../client/activation/types';
import { MockLanguageClient } from './mockLanguageClient';

// tslint:disable:no-any unified-signatures
@injectable()
export class MockLanguageServer implements ILanguageServer {
    private mockLanguageClient: MockLanguageClient | undefined;

    public get languageClient(): LanguageClient | undefined {
        if (!this.mockLanguageClient) {
            this.mockLanguageClient = new MockLanguageClient('mockLanguageClient', { module: 'dummy' }, {});
        }
        return this.mockLanguageClient;
    }

    public start(_resource: Uri | undefined, _options: LanguageClientOptions): Promise<void> {
        if (!this.mockLanguageClient) {
            this.mockLanguageClient = new MockLanguageClient('mockLanguageClient', { module: 'dummy' }, {});
        }
        return Promise.resolve();
    }
    public loadExtension(_args?: {} | undefined): void {
        throw new Error('Method not implemented.');
    }
    public dispose(): void | undefined {
        this.mockLanguageClient = undefined;
    }

}
