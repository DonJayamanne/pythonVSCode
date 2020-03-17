// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Kernel, KernelMessage } from '@jupyterlab/services';
import { PromiseDelegate } from '@phosphor/coreutils';
import { DisposableDelegate } from '@phosphor/disposable';

// tslint:disable: no-use-before-declare no-any

/**
 * Implementation of a kernel future.
 */
export class KernelFutureHandler extends DisposableDelegate implements Kernel.IFuture<any, any> {
    /**
     * Get the original outgoing message.
     */
    get msg(): KernelMessage.IShellMessage {
        return this._msg;
    }

    /**
     * A promise that resolves when the future is done.
     */
    get done(): Promise<KernelMessage.IShellMessage> {
        return this._done.promise;
    }

    /**
     * Get the reply handler.
     */
    get onReply(): (msg: KernelMessage.IShellMessage) => void {
        return this._reply;
    }

    /**
     * Set the reply handler.
     */
    set onReply(cb: (msg: KernelMessage.IShellMessage) => void) {
        this._reply = cb;
    }

    /**
     * Get the iopub handler.
     */
    get onIOPub(): (msg: KernelMessage.IIOPubMessage) => void {
        return this._iopub;
    }

    /**
     * Set the iopub handler.
     */
    set onIOPub(cb: (msg: KernelMessage.IIOPubMessage) => void) {
        this._iopub = cb;
    }

    /**
     * Get the stdin handler.
     */
    get onStdin(): (msg: KernelMessage.IStdinMessage) => void {
        return this._stdin;
    }

    /**
     * Set the stdin handler.
     */
    set onStdin(cb: (msg: KernelMessage.IStdinMessage) => void) {
        this._stdin = cb;
    }

    private readonly _msg: KernelMessage.IShellMessage;
    private _status = 0;
    private _stdin: (msg: KernelMessage.IStdinMessage) => void = Private.noOp;
    private _iopub: (msg: KernelMessage.IIOPubMessage) => void = Private.noOp;
    private _reply: (msg: KernelMessage.IShellMessage) => void = Private.noOp;
    private readonly _done = new PromiseDelegate<KernelMessage.IShellMessage>();
    private _replyMsg: KernelMessage.IShellMessage;
    private readonly _hooks = new Private.HookList<KernelMessage.IIOPubMessage>();
    private readonly _disposeOnDone: boolean = true;
    private readonly _kernel: Kernel.IKernel;
    /**
     * Construct a new KernelFutureHandler.
     */
    constructor(
        cb: () => void,
        msg: KernelMessage.IShellMessage,
        expectShell: boolean,
        disposeOnDone: boolean,
        kernel: Kernel.IKernel
    ) {
        super(cb);
        this._msg = msg;
        if (!expectShell) {
            this._setFlag(Private.KernelFutureFlag.GotReply);
        }
        this._disposeOnDone = disposeOnDone;
        this._kernel = kernel;
    }

    /**
     * Register hook for IOPub messages.
     *
     * @param hook - The callback invoked for an IOPub message.
     *
     * #### Notes
     * The IOPub hook system allows you to preempt the handlers for IOPub messages handled
     * by the future. The most recently registered hook is run first.
     * If the hook returns false, any later hooks and the future's onIOPub handler will not run.
     * If a hook throws an error, the error is logged to the console and the next hook is run.
     * If a hook is registered during the hook processing, it won't run until the next message.
     * If a hook is removed during the hook processing, it will be deactivated immediately.
     */
    public registerMessageHook(hook: (msg: KernelMessage.IIOPubMessage) => boolean): void {
        this._hooks.add(hook);
    }

    /**
     * Remove a hook for IOPub messages.
     *
     * @param hook - The hook to remove.
     *
     * #### Notes
     * If a hook is removed during the hook processing, it will be deactivated immediately.
     */
    public removeMessageHook(hook: (msg: KernelMessage.IIOPubMessage) => boolean): void {
        if (this.isDisposed) {
            return;
        }
        this._hooks.remove(hook);
    }

    /**
     * Send an `input_reply` message.
     */
    public sendInputReply(content: KernelMessage.IInputReply): void {
        this._kernel.sendInputReply(content);
    }

    /**
     * Dispose and unregister the future.
     */
    public dispose(): void {
        this._stdin = Private.noOp;
        this._iopub = Private.noOp;
        this._reply = Private.noOp;
        super.dispose();
    }

    /**
     * Handle an incoming kernel message.
     */
    public handleMsg(msg: KernelMessage.IMessage): void {
        switch (msg.channel) {
            case 'shell':
                this._handleReply(msg as KernelMessage.IShellMessage);
                break;
            case 'stdin':
                this._handleStdin(msg as KernelMessage.IStdinMessage);
                break;
            case 'iopub':
                this._handleIOPub(msg as KernelMessage.IIOPubMessage);
                break;
            default: {
                // Do nothing.s
            }
        }
    }

    private _handleReply(msg: KernelMessage.IShellMessage): void {
        const reply = this._reply;
        if (reply) {
            reply(msg);
        }
        this._replyMsg = msg;
        this._setFlag(Private.KernelFutureFlag.GotReply);
        if (this._testFlag(Private.KernelFutureFlag.GotIdle)) {
            this._handleDone();
        }
    }

    private _handleStdin(msg: KernelMessage.IStdinMessage): void {
        const stdin = this._stdin;
        if (stdin) {
            stdin(msg);
        }
    }

    private _handleIOPub(msg: KernelMessage.IIOPubMessage): void {
        const process = this._hooks.process(msg);
        const iopub = this._iopub;
        if (process && iopub) {
            iopub(msg);
        }
        if (KernelMessage.isStatusMsg(msg) && msg.content.execution_state === 'idle') {
            this._setFlag(Private.KernelFutureFlag.GotIdle);
            if (this._testFlag(Private.KernelFutureFlag.GotReply)) {
                this._handleDone();
            }
        }
    }

    private _handleDone(): void {
        if (this._testFlag(Private.KernelFutureFlag.IsDone)) {
            return;
        }
        this._setFlag(Private.KernelFutureFlag.IsDone);
        this._done.resolve(this._replyMsg);
        if (this._disposeOnDone) {
            this.dispose();
        }
    }

    /**
     * Test whether the given future flag is set.
     */
    private _testFlag(flag: Private.KernelFutureFlag): boolean {
        return (this._status & flag) !== 0;
    }

    /**
     * Set the given future flag.
     */
    private _setFlag(flag: Private.KernelFutureFlag): void {
        this._status |= flag;
    }
}

namespace Private {
    /**
     * A no-op function.
     */
    export const noOp = () => {
        /* no-op */
    };

    /**
     * A polyfill for a function to run code outside of the current execution context.
     */
    const defer = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout;

    export class HookList<T> {
        private readonly _hooks: (((msg: T) => boolean) | null)[] = [];
        private _cleanupScheduled: boolean;
        /**
         * Register a hook.
         *
         * @param hook - The callback to register.
         */
        public add(hook: (msg: T) => boolean): void {
            this.remove(hook);
            this._hooks.push(hook);
        }

        /**
         * Remove a hook.
         *
         * @param hook - The callback to remove.
         */
        public remove(hook: (msg: T) => boolean): void {
            const index = this._hooks.indexOf(hook);
            if (index >= 0) {
                this._hooks[index] = null;
                this._scheduleCompact();
            }
        }

        /**
         * Process a message through the hooks.
         *
         * #### Notes
         * The most recently registered hook is run first.
         * If the hook returns false, any later hooks will not run.
         * If a hook throws an error, the error is logged to the console and the next hook is run.
         * If a hook is registered during the hook processing, it won't run until the next message.
         * If a hook is removed during the hook processing, it will be deactivated immediately.
         */
        public process(msg: T): boolean {
            let continueHandling: boolean;
            // most recently-added hook is called first
            for (let i = this._hooks.length - 1; i >= 0; i--) {
                const hook = this._hooks[i];
                if (hook === null) {
                    continue;
                }
                try {
                    continueHandling = hook(msg);
                } catch (err) {
                    continueHandling = true;
                    console.error(err);
                }
                if (continueHandling === false) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Schedule a cleanup of the list, removing any hooks that have been nulled out.
         */
        private _scheduleCompact(): void {
            if (!this._cleanupScheduled) {
                this._cleanupScheduled = true;
                defer(() => {
                    this._cleanupScheduled = false;
                    this._compact();
                });
            }
        }

        /**
         * Compact the list, removing any nulls.
         */
        private _compact(): void {
            let numNulls = 0;
            // tslint:disable-next-line: one-variable-per-declaration
            for (let i = 0, len = this._hooks.length; i < len; i += 1) {
                const hook = this._hooks[i];
                if (this._hooks[i] === null) {
                    numNulls += 1;
                } else {
                    this._hooks[i - numNulls] = hook;
                }
            }
            this._hooks.length -= numNulls;
        }
    }

    /**
     * Bit flags for the kernel future state.
     */
    export enum KernelFutureFlag {
        GotReply = 0x1,
        GotIdle = 0x2,
        IsDone = 0x4,
        DisposeOnDone = 0x8
    }
}
