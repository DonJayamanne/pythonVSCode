// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { traceError } from '../../../common/logger';
import { ExecutionFactoryCreateWithEnvironmentOptions, ExecutionResult, IPythonExecutionFactory, SpawnOptions } from '../../../common/process/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { ITestDiscoveryService, TestDiscoveryOptions, Tests } from '../types';
import { ITestDiscoveredTestParser } from './types';

type TestContainer = {
    id: string;
    kind: 'file' | 'folder' | 'suite' | 'function';
    name: string;
    parentid: string;
};
type TestItem = {
    id: string;
    name: string;
    source: string;
    parentid: string;
};
type DiscoveredTests = {
    rootid: string;
    root: string;
    parents: TestContainer[];
    tests: TestItem[];
};

const DISCOVERY_FILE = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'testing_tools', 'run_adapter.py');

@injectable()
export class TestsDiscoveryService implements ITestDiscoveryService {
    constructor(@inject(IPythonExecutionFactory) private readonly execFactory: IPythonExecutionFactory,
        @inject(ITestDiscoveredTestParser) private readonly parser: ITestDiscoveredTestParser) { }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        const output = await this.exec(options);
        try {
            const discoveredTests = JSON.parse(output.stdout) as DiscoveredTests[];
            return this.parser.parse(options.workspaceFolder, discoveredTests);
        } catch (ex) {
            traceError(`Failed to parse discovered Test, output received = ${output.stdout}`, ex);
            throw ex;
        }
    }
    protected async exec(options: TestDiscoveryOptions): Promise<ExecutionResult<string>> {
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: options.workspaceFolder
        };
        const execService = await this.execFactory.createActivatedEnvironment(creationOptions);
        const spawnOptions: SpawnOptions = {
            token: options.token,
            cwd: options.cwd,
            throwOnStdErr: true
        };
        return execService.exec([DISCOVERY_FILE, ...options.args], spawnOptions);
    }
}
