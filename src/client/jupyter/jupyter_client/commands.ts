"use strict";

export class Commands {
    public static ExitCommandBytes: Buffer = new Buffer("exit");
    public static PingBytes: Buffer = new Buffer("ping");
    public static ListKernelsBytes: Buffer = new Buffer("lstk");
}

export namespace ResponseCommands {
    export const Pong = 'PONG';
    export const ListKernels = 'LSTK';
    export const Error = 'EROR';
}
