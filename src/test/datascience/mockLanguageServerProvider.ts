// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { ILanguageServer, ILanguageServerProvider } from '../../client/api/types';
import { InterpreterUri } from '../../client/common/installer/types';
import { MockLanguageServer } from './mockLanguageServer';

// tslint:disable:no-any unified-signatures
@injectable()
export class MockLanguageServerProvider implements ILanguageServerProvider {
    private mockLanguageServer = new MockLanguageServer();
    public async getLanguageServer(_resource?: InterpreterUri): Promise<ILanguageServer | undefined> {
        return this.mockLanguageServer;
    }
}
