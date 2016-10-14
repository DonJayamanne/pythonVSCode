"use strict";

export class Commands {
    public static ExitCommandBytes: Buffer = new Buffer("exit");
    public static PingBytes: Buffer = new Buffer("ping");
    public static ListKernelSpecsBytes: Buffer = new Buffer("lsks");
}

export namespace ResponseCommands {
    export const Pong = 'PONG';
    export const ListKernelsSpecs = 'LSKS';
    export const Error = 'EROR';
}
