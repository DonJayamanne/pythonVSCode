
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