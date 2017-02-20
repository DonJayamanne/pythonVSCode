
'use strict';
// TODO: Cleanup this place
// Add options for execPythonFile
import * as path from 'path';
import * as fs from 'fs';

export const IS_WINDOWS = /^win/.test(process.platform);
export const PATH_VARIABLE_NAME = IS_WINDOWS ? 'Path' : 'PATH';

const PathValidity: Map<string, boolean> = new Map<string, boolean>();
export function validatePath(filePath: string): Promise<string> {
    if (filePath.length === 0) {
        return Promise.resolve('');
    }
    if (PathValidity.has(filePath)) {
        return Promise.resolve(PathValidity.get(filePath) ? filePath : '');
    }
    return new Promise<string>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists ? filePath : '');
        });
    });
}
export function fsExistsAsync(filePath: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists);
        });
    });
}

export function formatErrorForLogging(error: Error | string): string {
    let message: string = '';
    if (typeof error === 'string') {
        message = error;
    }
    else {
        if (error.message) {
            message = `Error Message: ${error.message}`;
        }
        if (error.name && error.message.indexOf(error.name) === -1) {
            message += `, (${error.name})`;
        }
        const innerException = (error as any).innerException;
        if (innerException && (innerException.message || innerException.name)) {
            if (innerException.message) {
                message += `, Inner Error Message: ${innerException.message}`;
            }
            if (innerException.name && innerException.message.indexOf(innerException.name) === -1) {
                message += `, (${innerException.name})`;
            }
        }
    }
    return message;
}

export function getSubDirectories(rootDir: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        fs.readdir(rootDir, (error, files) => {
            if (error) {
                return resolve([]);
            }
            const subDirs = [];
            files.forEach(name => {
                const fullPath = path.join(rootDir, name);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        subDirs.push(fullPath);
                    }
                }
                catch (ex) {
                }
            });
            resolve(subDirs);
        });
    });
}