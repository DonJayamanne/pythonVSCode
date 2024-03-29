// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { IExtensionApi } from '../client/apiTypes';
import { ProposedExtensionAPI } from '../client/proposedApiTypes';
import { initialize } from './initialize';

suite('Python API tests', () => {
    let api: IExtensionApi & ProposedExtensionAPI;
    suiteSetup(async () => {
        api = await initialize();
    });
    test('Active environment is defined', async () => {
        const environmentPath = api.environments.getActiveEnvironmentPath();
        const environment = await api.environments.resolveEnvironment(environmentPath);
        expect(environment).to.not.equal(
            undefined,
            `Active environment is not defined, envPath: ${JSON.stringify(environmentPath)}, env: ${JSON.stringify(
                environment,
            )}`,
        );
    });
});
