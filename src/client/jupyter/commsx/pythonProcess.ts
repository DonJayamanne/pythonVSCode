"use strict";

import * as net from "net";
import { EventEmitter } from "events";
import { Commands } from "./commands";
import { SocketStream } from "../../common/comms/SocketStream";

export class PythonProcess extends EventEmitter {
    private stream: SocketStream = null;
    constructor() {
        super();
    }

    public Kill() {
        if (this.pid && typeof this.pid === "number") {
            try {
                let kill = require("tree-kill");
                kill(this.pid);
                this.pid = null;
            }
            catch (ex) { }
        }
    }

    public Terminate() {
        this.stream.Write(Commands.ExitCommandBytes);
    }

    public Detach() {
        this.stream.Write(Commands.DetachCommandBytes);
    }

    private pid: number;
    private pidRead: boolean;
    private handshakeDone: boolean;
    public Connect(buffer: Buffer, socket: net.Socket): boolean {
        if (this.stream === null) {
            this.stream = new SocketStream(socket, buffer);
        }
        else {
            this.stream.Append(buffer);
        }
        if (!this.handshakeDone) {
            this.stream.BeginTransaction();
            let guid = this.stream.ReadString();
            if (this.stream.HasInsufficientDataForReading) {
                this.stream.RollBackTransaction();
                return false;
            }
            this.handshakeDone = true;
            this.stream.EndTransaction();
        }

        if (!this.pidRead) {
            this.stream.BeginTransaction();
            this.pid = this.stream.ReadInt32();
            if (this.stream.HasInsufficientDataForReading) {
                this.stream.RollBackTransaction();
                return false;
            }
            this.pidRead = true;
            this.stream.EndTransaction();
        }

        this.HandleIncomingDataFromStream();
        return true;
    }

    public HandleIncomingData(buffer: Buffer) {
        this.stream.Append(buffer);

        if (!this.handshakeDone) {
            this.stream.BeginTransaction();
            let guid = this.stream.ReadString();
            if (this.stream.HasInsufficientDataForReading) {
                this.stream.RollBackTransaction();
                return false;
            }
            this.handshakeDone = true;
            this.stream.EndTransaction();
        }

        if (!this.pidRead) {
            this.stream.BeginTransaction();
            this.pid = this.stream.ReadInt32();
            if (this.stream.HasInsufficientDataForReading) {
                this.stream.RollBackTransaction();
                return false;
            }
            this.pidRead = true;
            this.stream.EndTransaction();
        }

        this.HandleIncomingDataFromStream();
    }

    public Break() {
        this.stream.Write(Commands.BreakAllCommandBytes);
    }

    public HandleIncomingDataFromStream() {
        if (this.stream.Length === 0) {
            return;
        }
        this.stream.BeginTransaction();

        let cmd = this.stream.ReadAsciiString(4);
        if (this.stream.HasInsufficientDataForReading) {
            return;
        }

        switch (cmd) {
            case "MODL": this.HandleModuleLoad(); break;
            case "PONG": this.HandleModuleLoad(); break;
            default: {

                this.emit("error", `Unhandled command '${cmd}'`);
            }
        }

        if (this.stream.HasInsufficientDataForReading) {
            // Most possibly due to insufficient data
            this.stream.RollBackTransaction();
            return;
        }

        this.stream.EndTransaction();
        if (this.stream.Length > 0) {
            this.HandleIncomingDataFromStream();
        }
    }

    private HandleModuleLoad() {
        this.emit("moduleLoaded");
    }

}
