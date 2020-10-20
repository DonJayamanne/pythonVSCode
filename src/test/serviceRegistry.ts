// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsextra from 'fs-extra';
import { Container } from 'inversify';
import * as path from 'path';
import { Disposable, Memento, OutputChannel, Uri } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../client/common/constants';
import { convertStat } from '../client/common/platform/fileSystemUtils';
import { FileStat, FileType } from '../client/common/platform/types';
import {
    GLOBAL_MEMENTO,
    IDisposableRegistry,
    IMemento,
    IOutputChannel,
    WORKSPACE_MEMENTO
} from '../client/common/types';
import { createDeferred } from '../client/common/utils/async';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';
import { MockOutputChannel } from './mockClasses';
import { MockMemento } from './mocks/mementos';

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
}
