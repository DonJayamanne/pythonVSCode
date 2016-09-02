const tmp = require('tmp');

export function isNotInstalledError(error: Error): boolean {
    return typeof (error) === 'object' && error !== null && ((<any>error).code === 'ENOENT' || (<any>error).code === 127);
}

export interface Deferred<T> {
    resolve: (value?: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}

export function createDeferred<T>(): Deferred<T> {
    let resolve: (value?: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;

    let promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return {
        resolve, reject, promise
    };
}

export function createTemporaryFile(extension: string, temporaryDirectory?: string): Promise<{ filePath: string, cleanupCallback: Function }> {
    let options: any = { postfix: extension };
    if (temporaryDirectory) {
        options.dir = temporaryDirectory;
    }

    return new Promise<{ filePath: string, cleanupCallback: Function }>((resolve, reject) => {
        tmp.file(options, function _tempFileCreated(err, tmpFile, fd, cleanupCallback) {
            if (err) {
                return reject(err);
            }
            resolve({ filePath: tmpFile, cleanupCallback: cleanupCallback })
        });
    });
}