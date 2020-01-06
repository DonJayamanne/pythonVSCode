// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { EOL } from 'os';
import { PoetryServce } from '../../../client/interpreter/locators/services/poetryService';
import { Uri, FileType } from 'vscode';
import { assert } from 'chai';
import { when, mock, anything, instance, deepEqual } from 'ts-mockito';
import { IProcessService } from '../../../client/common/process/types';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { ProcessService } from '../../../client/common/process/proc';
import { IConfigurationService } from '../../../client/common/types';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { IFileSystem } from '../../../client/common/platform/types';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { getOSType, OSType } from '../../common';

suite('Interpreters - PoetryService', () => {
    let poetryService: PoetryServce;
    let processService: IProcessService;
    let configService: IConfigurationService;
    let fs: IFileSystem;
    setup(() => {
        configService = mock(ConfigurationService);
        const processFactory = mock(ProcessServiceFactory);
        fs = mock(FileSystem);
        processService = mock(ProcessService);

        poetryService = new PoetryServce(instance(configService), [] as any, instance(fs), instance(processFactory));

        when((processService as any).then).thenReturn(undefined);
        when(processFactory.create(anything())).thenResolve(instance(processService));
    });

    [undefined, Uri.file('wow.py')].forEach(resource => {
        suite(resource ? 'Without a resource' : 'With a resource', () => {
            test('Should not be installed if process exec throws an error', async () => {
                when(processService.exec('poetry path', deepEqual(['--version']))).thenReject(new Error('Kaboom'));
                when(configService.getSettings(resource)).thenReturn({ poetryPath: 'poetry path' } as any);

                const installed = await poetryService.isInstalled(resource);

                assert.isFalse(installed);
            });
            test('Should not be installed if process exec writes to stderr', async () => {
                when(processService.exec('poetry path', deepEqual(['--version']))).thenResolve({ stdout: '', stderr: 'wow' });
                when(configService.getSettings(resource)).thenReturn({ poetryPath: 'poetry path' } as any);

                const installed = await poetryService.isInstalled(resource);

                assert.isFalse(installed);
            });
            test('Should be installed', async () => {
                when(processService.exec('poetry path', deepEqual(['--version']))).thenResolve({ stdout: 'wow', stderr: '' });
                when(configService.getSettings(resource)).thenReturn({ poetryPath: 'poetry path' } as any);

                const installed = await poetryService.isInstalled(resource);

                assert.isOk(installed);
            });
            test('Returns an empty list of environments if process exec throws an error', async () => {
                when(processService.exec('poetry path', deepEqual(['env', 'list', '--full-path']))).thenReject(new Error('Kaboom'));
                when(configService.getSettings(resource)).thenReturn({ poetryPath: 'poetry path' } as any);

                const envs = await poetryService.getEnvironments(resource);

                assert.deepEqual(envs, []);
            });
            test('Returns an list of environments', async () => {
                const dirs = ['first env dir', '', '       ', 'corrupted env dir', 'second env dir (Activated)', '    '].join(EOL);
                const executable = getOSType() === OSType.Windows ? 'python.exe' : 'python';

                when(processService.exec('poetry path', deepEqual(['env', 'list', '--full-path']))).thenResolve({ stdout: dirs });
                when(fs.listdir('corrupted env dir')).thenResolve([]);
                when(fs.directoryExists('corrupted env dir')).thenResolve(true);
                when(fs.directoryExists('first env dir')).thenResolve(true);
                when(fs.directoryExists('second env dir')).thenResolve(true);
                when(fs.listdir('first env dir')).thenResolve([
                    [path.join('first env dir', executable), FileType.File],
                    [path.join('first env dir', 'some other exec.exe'), FileType.File]
                ]);
                when(fs.listdir('second env dir')).thenResolve([
                    [path.join('second env dir', executable), FileType.File],
                    [path.join('second env dir', 'some other exec.exe'), FileType.File]
                ]);
                when(configService.getSettings(resource)).thenReturn({ poetryPath: 'poetry path' } as any);

                const envs = await poetryService.getEnvironments(resource);

                assert.deepEqual(envs, [path.join('first env dir', executable), path.join('second env dir', executable)]);
            });
        });
    });
});
