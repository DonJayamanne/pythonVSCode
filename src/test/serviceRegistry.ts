// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsextra from 'fs-extra';
import { Container } from 'inversify';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Disposable, Memento, OutputChannel, Uri } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../client/common/constants';
import { IS_WINDOWS } from '../client/common/platform/constants';
import { convertStat, FileSystem, FileSystemUtils, RawFileSystem } from '../client/common/platform/fileSystem';
import { PathUtils } from '../client/common/platform/pathUtils';
import { PlatformService } from '../client/common/platform/platformService';
import { FileStat, FileType, IFileSystem, IPlatformService } from '../client/common/platform/types';
import { BufferDecoder } from '../client/common/process/decoder';
import { ProcessService } from '../client/common/process/proc';
import { PythonExecutionFactory } from '../client/common/process/pythonExecutionFactory';
import { PythonToolExecutionService } from '../client/common/process/pythonToolService';
import { registerTypes as processRegisterTypes } from '../client/common/process/serviceRegistry';
import {
    IBufferDecoder,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonToolExecutionService
} from '../client/common/process/types';
import { registerTypes as commonRegisterTypes } from '../client/common/serviceRegistry';
import {
    GLOBAL_MEMENTO,
    ICurrentProcess,
    IDisposableRegistry,
    IMemento,
    IOutputChannel,
    IPathUtils,
    IsWindows,
    WORKSPACE_MEMENTO
} from '../client/common/types';
import { createDeferred } from '../client/common/utils/async';
import { registerTypes as variableRegisterTypes } from '../client/common/variables/serviceRegistry';
import { IEnvironmentActivationService } from '../client/interpreter/activation/types';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';
import { TEST_OUTPUT_CHANNEL } from '../client/testing/common/constants';
import { MockOutputChannel } from './mockClasses';
import { MockMemento } from './mocks/mementos';
import { MockProcessService } from './mocks/proc';
import { MockProcess } from './mocks/process';

// This is necessary for unit tests and functional tests, since they
// do not run under VS Code so they do not have access to the actual
// "vscode" namespace.
export class FakeVSCodeFileSystemAPI {
    public async readFile(uri: Uri): Promise<Uint8Array> {
        return fsextra.readFile(uri.fsPath);
    }
    public async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
        return fsextra.writeFile(uri.fsPath, Buffer.from(content));
    }
    public async delete(uri: Uri, _options?: { recursive: boolean; useTrash: boolean }): Promise<void> {
        return (
            fsextra
                // Make sure the file exists before deleting.
                .stat(uri.fsPath)
                .then(() => fsextra.remove(uri.fsPath))
        );
    }
    public async stat(uri: Uri): Promise<FileStat> {
        const filename = uri.fsPath;

        let filetype = FileType.Unknown;
        let stat = await fsextra.lstat(filename);
        if (stat.isSymbolicLink()) {
            filetype = FileType.SymbolicLink;
            stat = await fsextra.stat(filename);
        }
        if (stat.isFile()) {
            filetype |= FileType.File;
        } else if (stat.isDirectory()) {
            filetype |= FileType.Directory;
        }
        return convertStat(stat, filetype);
    }
    public async readDirectory(uri: Uri): Promise<[string, FileType][]> {
        const names: string[] = await fsextra.readdir(uri.fsPath);
        const promises = names.map((name) => {
            const filename = path.join(uri.fsPath, name);
            return (
                fsextra
                    // Get the lstat info and deal with symlinks if necessary.
                    .lstat(filename)
                    .then(async (stat) => {
                        let filetype = FileType.Unknown;
                        if (stat.isFile()) {
                            filetype = FileType.File;
                        } else if (stat.isDirectory()) {
                            filetype = FileType.Directory;
                        } else if (stat.isSymbolicLink()) {
                            filetype = FileType.SymbolicLink;
                            stat = await fsextra.stat(filename);
                            if (stat.isFile()) {
                                filetype |= FileType.File;
                            } else if (stat.isDirectory()) {
                                filetype |= FileType.Directory;
                            }
                        }
                        return [name, filetype] as [string, FileType];
                    })
                    .catch(() => [name, FileType.Unknown] as [string, FileType])
            );
        });
        return Promise.all(promises);
    }
    public async createDirectory(uri: Uri): Promise<void> {
        return fsextra.mkdirp(uri.fsPath);
    }
    public async copy(src: Uri, dest: Uri): Promise<void> {
        const deferred = createDeferred<void>();
        const rs = fsextra
            // Set an error handler on the stream.
            .createReadStream(src.fsPath)
            .on('error', (err) => {
                deferred.reject(err);
            });
        const ws = fsextra
            .createWriteStream(dest.fsPath)
            // Set an error & close handler on the stream.
            .on('error', (err) => {
                deferred.reject(err);
            })
            .on('close', () => {
                deferred.resolve();
            });
        rs.pipe(ws);
        return deferred.promise;
    }
    public async rename(src: Uri, dest: Uri): Promise<void> {
        return fsextra.rename(src.fsPath, dest.fsPath);
    }
}
export class LegacyFileSystem extends FileSystem {
    constructor() {
        super();
        const vscfs = new FakeVSCodeFileSystemAPI();
        const raw = RawFileSystem.withDefaults(undefined, vscfs);
        this.utils = FileSystemUtils.withDefaults(raw);
    }
}

export class IocContainer {
    // This may be set (before any registration happens) to indicate
    // whether or not IOC should depend on the VS Code API (e.g. the
    // "vscode" module).  So in "functional" tests, this should be set
    // to "false".
    public useVSCodeAPI = true;

    public readonly serviceManager: IServiceManager;
    public readonly serviceContainer: IServiceContainer;

    private disposables: Disposable[] = [];

    constructor() {
        const cont = new Container();
        this.serviceManager = new ServiceManager(cont);
        this.serviceContainer = new ServiceContainer(cont);

        this.serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, this.serviceContainer);
        this.serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, this.disposables);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, GLOBAL_MEMENTO);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, WORKSPACE_MEMENTO);

        const stdOutputChannel = new MockOutputChannel('Python');
        this.disposables.push(stdOutputChannel);
        this.serviceManager.addSingletonInstance<OutputChannel>(
            IOutputChannel,
            stdOutputChannel,
            STANDARD_OUTPUT_CHANNEL
        );
        const testOutputChannel = new MockOutputChannel('Python Test - UnitTests');
        this.disposables.push(testOutputChannel);
        this.serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, testOutputChannel, TEST_OUTPUT_CHANNEL);
    }
    public async dispose(): Promise<void> {
        for (const disposable of this.disposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
        this.disposables = [];
        this.serviceManager.dispose();
    }

    public registerCommonTypes(registerFileSystem: boolean = true) {
        commonRegisterTypes(this.serviceManager);
        if (registerFileSystem) {
            this.registerFileSystemTypes();
        }
    }
    public registerFileSystemTypes() {
        this.serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
        this.serviceManager.addSingleton<IFileSystem>(
            IFileSystem,
            // Maybe use fake vscode.workspace.filesystem API:
            this.useVSCodeAPI ? FileSystem : LegacyFileSystem
        );
    }
    public registerProcessTypes() {
        processRegisterTypes(this.serviceManager);
        const mockEnvironmentActivationService = mock<IEnvironmentActivationService>();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenResolve();
        when(
            mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything(), anything())
        ).thenResolve();
        this.serviceManager.addSingletonInstance<IEnvironmentActivationService>(
            IEnvironmentActivationService,
            instance(mockEnvironmentActivationService)
        );
    }
    public registerVariableTypes() {
        variableRegisterTypes(this.serviceManager);
    }
    public registerInterpreterTypes() {
        // This method registers all interpreter types except `IInterpreterAutoSeletionProxyService` & `IEnvironmentActivationService`, as it's already registered in the constructor & registerMockProcessTypes() respectively
        // registerInterpreterTypes(this.serviceManager);
    }
    public registerMockProcessTypes() {
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        // tslint:disable-next-line:no-any
        const processService = new MockProcessService(new ProcessService(new BufferDecoder(), process.env as any));
        processServiceFactory.setup((f) => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService));
        this.serviceManager.addSingletonInstance<IProcessServiceFactory>(
            IProcessServiceFactory,
            processServiceFactory.object
        );
        this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
        this.serviceManager.addSingleton<IPythonToolExecutionService>(
            IPythonToolExecutionService,
            PythonToolExecutionService
        );
        const mockEnvironmentActivationService = mock<IEnvironmentActivationService>();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenResolve();
        when(
            mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything(), anything(), anything())
        ).thenResolve();
        this.serviceManager.rebindInstance<IEnvironmentActivationService>(
            IEnvironmentActivationService,
            instance(mockEnvironmentActivationService)
        );
    }

    public registerMockProcess() {
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, MockProcess);
    }
}
