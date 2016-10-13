"use strict";

import * as net from "net";
import { SocketCallbackHandler } from "../../common/comms/socketCallbackHandler";
import { Commands, ResponseCommands } from "./commands";
import { SocketStream } from "../../Common/comms/SocketStream";
import { SocketServer } from '../../common/comms/socketServer';
import { IdDispenser } from '../../debugger/Common/Utils';
import { createDeferred, Deferred } from '../../common/helpers';

export class iPythonAdapter extends SocketCallbackHandler {
    private idDispenser: IdDispenser;
    constructor(socketServer: SocketServer) {
        super(socketServer);
        this.registerCommandHandler(ResponseCommands.Pong, this.onPong.bind(this));
        this.registerCommandHandler(ResponseCommands.ListKernels, this.onKernelsListed.bind(this));
        this.registerCommandHandler(ResponseCommands.ListKernels, this.onKernelsListed.bind(this));
        this.registerCommandHandler(ResponseCommands.Error, this.onError.bind(this));
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

        return true;
    }

    private pendingCommands = new Map<string, Deferred<any>>();

    public listKernels(): Promise<string[]> {
        const def = createDeferred<string[]>()
        const id = this.idDispenser.Allocate().toString();
        this.pendingCommands.set(id, def);
        this.SendRawCommand(Commands.ListKernelsBytes);
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
        this.pendingCommands.delete(id);

        let kernelList: string[];
        try {
            kernelList = JSON.parse(kernels)
        }
        catch (ex) {
            def.reject(ex);
            return;
        }

        def.resolve(kernelList);
    }

    public ping() {
        this.SendRawCommand(Commands.PingBytes);
        this.stream.WriteString('Hello world from Type Script - Функция проверки ИНН и КПП - 长城!')
    }

    private onPong() {
        const message = this.stream.readStringInTransaction();
        if (message == undefined) {
            return;
        }
        this.emit("pong", message);
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
            def.reject(trace);
        }
        this.emit("onerror", { command: cmd, id: id, trace: trace });
    }
}
