"use strict";

export class Commands {
    public static ExitCommandBytes: Buffer = new Buffer("exit");
    public static PingBytes: Buffer = new Buffer("ping");
    public static ListKernelSpecsBytes: Buffer = new Buffer("lsks");
    public static StartKernelBytes: Buffer = new Buffer("strk");
    public static ShutdownKernelBytes: Buffer = new Buffer("stpk");
    public static RestartKernelBytes: Buffer = new Buffer("rstk");
    public static InterruptKernelBytes: Buffer = new Buffer("itpk");
    public static RunCodeBytes: Buffer = new Buffer("run ");
}

export namespace ResponseCommands {
    export const Pong = 'PONG';
    export const ListKernelsSpecs = 'LSKS';
    export const Error = 'EROR';
    export const KernelStarted = 'STRK';
    export const KernelShutdown = 'STPK';
    export const KernelRestarted = 'RSTK';
    export const KernelInterrupted = 'ITPK';
    export const RunCode = 'RUN ';
    export const ShellResult = 'SHEL';
    export const IOPUBMessage = 'IOPB';
}
