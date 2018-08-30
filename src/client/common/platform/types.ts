// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum RegistryHive {
    HKCU, HKLM
}

export const IRegistry = Symbol('IRegistry');
export interface IRegistry {
    getKeys(key: string, hive: RegistryHive, arch?: Architecture): Promise<string[]>;
    getValue(key: string, hive: RegistryHive, arch?: Architecture, name?: string): Promise<string | undefined | null>;
}

export const IPlatformService = Symbol('IPlatformService');
export interface IPlatformService {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    is64bit: boolean;
    pathVariableName: 'Path' | 'PATH';
    virtualEnvBinName: 'bin' | 'scripts';
}

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    directorySeparatorChar: string;
    objectExistsAsync(path: string, statCheck: (s: fs.Stats) => boolean): Promise<boolean>;
    fileExistsAsync(path: string): Promise<boolean>;
    fileExistsSync(path: string): boolean;
    directoryExistsAsync(path: string): Promise<boolean>;
    createDirectoryAsync(path: string): Promise<void>;
    getSubDirectoriesAsync(rootDir: string): Promise<string[]>;
    arePathsSame(path1: string, path2: string): boolean;
    readFile(filePath: string): Promise<string>;
    appendFileSync(filename: string, data: {}, encoding: string): void;
    appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: number; flag?: string }): void;
    // tslint:disable-next-line:unified-signatures
    appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: string; flag?: string }): void;
    getRealPathAsync(path: string): Promise<string>;
}
