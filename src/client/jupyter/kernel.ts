// http://jupyter-client.readthedocs.io/en/latest/messaging.html#to-do

import * as vscode from 'vscode';
import { KernelspecMetadata, KernelEvents, ParsedIOMessage } from './contracts';
import * as Rx from 'rx';

export abstract class Kernel extends vscode.Disposable implements KernelEvents {
    private watchCallbacks: any[];
    constructor(public kernelSpec: KernelspecMetadata, private language: string) {
        super(() => { });
        this.watchCallbacks = [];
    }

    public dispose() {

    }

    private _onStatusChange = new vscode.EventEmitter<[KernelspecMetadata, string]>();
    get onStatusChange(): vscode.Event<[KernelspecMetadata, string]> {
        return this._onStatusChange.event;
    }
    protected raiseOnStatusChange(status: string) {
        this._onStatusChange.fire([this.kernelSpec, status]);
    }

    public addWatchCallback(watchCallback) {
        return this.watchCallbacks.push(watchCallback);
    };

    public _callWatchCallbacks() {
        return this.watchCallbacks.forEach(watchCallback => {
            watchCallback();
        });
    };

    public abstract interrupt();
    public abstract shutdown();
    public abstract execute(code: string): Rx.IObservable<ParsedIOMessage>;
}