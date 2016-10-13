"use strict";

export class Commands {
    public static ExitCommandBytes: Buffer = new Buffer("exit");
    public static PingBytes: Buffer = new Buffer("ping");
}

export namespace ResponseCommands {
    export const PONG = 'PONG';
}
