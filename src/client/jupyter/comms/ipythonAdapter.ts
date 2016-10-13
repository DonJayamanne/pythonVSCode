"use strict";

import * as net from "net";
import { SocketCallbackHandler } from "../../common/comms/socketCallbackHandler";
import { Commands, ResponseCommands } from "./commands";
import { SocketStream } from "../../Common/comms/SocketStream";
import { SocketServer } from '../../common/comms/socketServer';

export class iPythonAdapter extends SocketCallbackHandler {
    constructor(socketServer: SocketServer) {
        super(socketServer);
        this.registerCommandHandler(ResponseCommands.PONG, this.onPong.bind(this));
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
}
