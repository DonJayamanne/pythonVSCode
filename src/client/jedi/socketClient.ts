"use strict";

import { SocketCallbackHandler } from "../common/comms/socketCallbackHandler";
import { Commands, ResponseCommands } from "./commands";
import { SocketServer } from '../common/comms/socketServer';
import { IdDispenser } from '../common/idDispenser';
import { createDeferred, Deferred } from '../common/helpers';
import { OutputChannel, CancellationToken } from 'vscode';

/*
    public static Exit: Buffer = new Buffer("exit");
    public static Ping: Buffer = new Buffer("ping");
    public static Arguments = new Buffer("args");
    public static Completions = new Buffer("comp");
    public static Definitions = new Buffer("defs");
    public static Hover = new Buffer("hovr");
    public static Usages = new Buffer("usag");
    public static Names = new Buffer("name");
*/

export enum Command {
    Signature,
    Completions,
    HoverDefinition,
    Usages,
    Definitions,
    Symbols
}

const commandMapping = new Map<Command, Buffer>();
commandMapping.set(Command.Signature, Commands.Arguments);
commandMapping.set(Command.Completions, Commands.Completions);
commandMapping.set(Command.Definitions, Commands.Definitions);
commandMapping.set(Command.HoverDefinition, Commands.Hover);
commandMapping.set(Command.Usages, Commands.Usages);
commandMapping.set(Command.Symbols, Commands.Names);

export class SocketClient extends SocketCallbackHandler {
    constructor(socketServer: SocketServer, private outputChannel: OutputChannel) {
        super(socketServer);
        this.registerCommandHandler(ResponseCommands.Pong, this.onPong.bind(this));
        this.registerCommandHandler(ResponseCommands.Error, this.onError.bind(this));

        this.registerCommandHandler(ResponseCommands.Arguments, this.onResponseReceived.bind(this));
        this.registerCommandHandler(ResponseCommands.Completions, this.onResponseReceived.bind(this));
        this.registerCommandHandler(ResponseCommands.Definitions, this.onResponseReceived.bind(this));
        this.registerCommandHandler(ResponseCommands.Hover, this.onResponseReceived.bind(this));
        this.registerCommandHandler(ResponseCommands.Names, this.onResponseReceived.bind(this));
        this.registerCommandHandler(ResponseCommands.Usages, this.onResponseReceived.bind(this));

        this.idDispenser = new IdDispenser();
    }
    public getResult<T>(command: Command, token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<T> {
        const cmd = commandMapping.get(command);

        const [def, id] = this.createId<T>(token);
        this.SendRawCommand(cmd);
        this.stream.WriteString(id);

        this.stream.WriteString(fileName);
        this.stream.WriteInt32(columnIndex);
        this.stream.WriteInt32(lineIndex);
        this.stream.WriteString(source || '');

        return def.promise;
    }
    private idDispenser: IdDispenser;
    private pid: number;
    private writeToDebugLog(message: string) {
        this.outputChannel.appendLine(message);
    }
    public dispose() {
        super.dispose();
    }
    protected handleHandshake(): boolean {
        if (typeof this.pid !== 'number') {
            this.pid = this.stream.readInt32InTransaction();
            if (typeof this.pid !== 'number') {
                return false;
            }
        }

        this.emit('handshake');
        return true;
    }

    private pendingCommands = new Map<string, Deferred<any>>();

    private createId<T>(token?: CancellationToken): [Deferred<T>, string] {
        const def = createDeferred<T>();
        const id = this.idDispenser.Allocate().toString();
        this.pendingCommands.set(id, def);
        if (token) {
            token.onCancellationRequested(() => {
                this.releaseId(id);
            });
        }
        return [def, id];
    }
    private releaseId(id: string) {
        this.pendingCommands.delete(id);
        this.idDispenser.Free(parseInt(id));
    }
    private onResponseReceived() {
        const id = this.stream.readStringInTransaction();
        const responseStr = this.stream.readStringInTransaction();
        if (typeof responseStr !== 'string') {
            return;
        }

        if (!this.pendingCommands.has(id)) {
            return;
        }
        const def = this.pendingCommands.get(id);
        this.releaseId(id);

        let jsonResponse: {};
        try {
            jsonResponse = JSON.parse(responseStr);
        }
        catch (ex) {
            def.reject(ex);
            return;
        }

        def.resolve(jsonResponse);
    }
    public ping(message: string) {
        const [def, id] = this.createId<string>(null);
        this.SendRawCommand(Commands.Ping);
        this.stream.WriteString(id);
        this.stream.WriteString(message);
        return def.promise;
    }

    private onPong() {
        const id = this.stream.readStringInTransaction();
        const message = this.stream.readStringInTransaction();
        if (typeof message !== 'string') {
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
        if (typeof trace !== 'string') {
            return;
        }
        if (cmd === 'exit') {
            return;
        }
        if (id.length > 0 && this.pendingCommands.has(id)) {
            const def = this.pendingCommands.get(id);
            this.pendingCommands.delete(id);
            def.reject(new Error(`Command: ${cmd}, Id: ${id}, Python Trace: ${trace}`));
            return;
        }
        this.emit("commanderror", { command: cmd, id: id, trace: trace });
    }
}
