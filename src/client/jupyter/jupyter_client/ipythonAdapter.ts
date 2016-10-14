"use strict";

import * as net from "net";
import { SocketCallbackHandler } from "../../common/comms/socketCallbackHandler";
import { Commands, ResponseCommands } from "./commands";
import { SocketStream } from "../../Common/comms/SocketStream";
import { SocketServer } from '../../common/comms/socketServer';
import { IdDispenser } from '../../common/idDispenser';
import { createDeferred, Deferred } from '../../common/helpers';
import {KernelCommand} from './contracts';

export class iPythonAdapter extends SocketCallbackHandler {
    private idDispenser: IdDispenser;
    constructor(socketServer: SocketServer) {
        super(socketServer);
        this.registerCommandHandler(ResponseCommands.Pong, this.onPong.bind(this));
        this.registerCommandHandler(ResponseCommands.ListKernelsSpecs, this.onKernelsListed.bind(this));
        this.registerCommandHandler(ResponseCommands.Error, this.onError.bind(this));
        this.registerCommandHandler(ResponseCommands.KernelStarted, this.onKernelStarted.bind(this));
        this.registerCommandHandler(ResponseCommands.KernelInterrupted, this.onKernelCommandComplete.bind(this));
        this.registerCommandHandler(ResponseCommands.KernelRestarted, this.onKernelCommandComplete.bind(this));
        this.registerCommandHandler(ResponseCommands.KernelShutdown, this.onKernelCommandComplete.bind(this));
        this.idDispenser = new IdDispenser();
    }

    private pid: number;
    private guid: string;

    protected handleHandshake(): boolean {
        if (!this.guid) {
            this.guid = this.stream.readStringInTransaction();
            if (this.guid == undefined) {
                return false;
            }
        }

        if (!this.pid) {
            this.pid = this.stream.readInt32InTransaction();
            if (this.pid == undefined) {
                return false;
            }
        }

        this.emit('handshake');
        return true;
    }

    private pendingCommands = new Map<string, Deferred<any>>();

    private createId<T>(): [Deferred<T>, string] {
        const def = createDeferred<T>()
        const id = this.idDispenser.Allocate().toString();
        this.pendingCommands.set(id, def);
        return [def, id];
    }
    private releaseId(id: string) {
        this.pendingCommands.delete(id);
        this.idDispenser.Free(parseInt(id));
    }

    public listKernelSpecs(): Promise<any> {
        const [def, id] = this.createId<any>();
        this.SendRawCommand(Commands.ListKernelSpecsBytes);
        this.stream.WriteString(id);
        return def.promise;
    }

    private onKernelsListed() {
        const id = this.stream.readStringInTransaction();
        const kernels = this.stream.readStringInTransaction();
        if (kernels == undefined) {
            return;
        }

        const def = this.pendingCommands.get(id);
        this.releaseId(id);

        let kernelList: any;
        try {
            kernelList = JSON.parse(kernels)
        }
        catch (ex) {
            def.reject(ex);
            return;
        }

        def.resolve(kernelList);
    }

    public startKernel(kernelName: string): Promise<[string, any, string]> {
        const [def, id] = this.createId<any>();
        this.SendRawCommand(Commands.StartKernelBytes);
        this.stream.WriteString(id);
        this.stream.WriteString(kernelName);
        return def.promise;
    }
    public onKernelStarted() {
        const id = this.stream.readStringInTransaction();
        const kernelUUID = this.stream.readStringInTransaction();
        const configStr = this.stream.readStringInTransaction();
        const connectionFile = this.stream.readStringInTransaction();
        if (connectionFile == undefined) {
            return;
        }
        const def = this.pendingCommands.get(id);
        let config = {};
        try {
            config = JSON.parse(configStr)
        }
        catch (ex) {
            def.reject(ex);
            return;
        }
        this.releaseId(id);
        def.resolve([kernelUUID, config, connectionFile]);
    }
    public sendKernelCommand(kernelUUID: string, command:KernelCommand): Promise<any> {
        const [def, id] = this.createId<any>();
        let commandBytes:Buffer;
        switch(command){
            case KernelCommand.interrupt:{
                commandBytes = Commands.InterruptKernelBytes;
                break;
            }
            case KernelCommand.restart:{
                commandBytes = Commands.RestartKernelBytes;
                break;
            }
            case KernelCommand.shutdown:{
                commandBytes = Commands.ShutdownKernelBytes;
                break;
            }
            default:{
                throw new Error('Unrecognized Kernel Command');
            }
        }
        this.SendRawCommand(commandBytes);
        this.stream.WriteString(id);
        this.stream.WriteString(kernelUUID);
        return def.promise;
    }
    public onKernelCommandComplete() {
        const id = this.stream.readStringInTransaction();
        if (id == undefined) {
            return;
        }
        const def = this.pendingCommands.get(id);
        this.releaseId(id);
        def.resolve();
    }
    public ping(message: string) {
        const [def, id] = this.createId<string[]>();
        this.SendRawCommand(Commands.PingBytes);
        this.stream.WriteString(id);
        this.stream.WriteString(message)
        return def.promise;
    }

    private onPong() {
        const id = this.stream.readStringInTransaction();
        const message = this.stream.readStringInTransaction();
        if (message == undefined) {
            return;
        }
        const def = this.pendingCommands.get(id);
        this.releaseId(id);
        def.resolve(message);
    }

    private onError() {
        const cmd = this.stream.readStringInTransaction();
        const id = this.stream.readStringInTransaction();
        const trace = this.stream.readStringInTransaction();
        if (trace == undefined) {
            return;
        }
        if (id.length > 0 && this.pendingCommands.has(id)) {
            const def = this.pendingCommands.get(id);
            this.pendingCommands.delete(id);
            def.reject(new Error(`Command: ${cmd}, Id: ${id}, Python Trace: ${trace}`));
            return;
        }
        this.emit("error", { command: cmd, id: id, trace: trace });
    }
}
