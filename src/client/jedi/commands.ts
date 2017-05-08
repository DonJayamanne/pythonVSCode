"use strict";

export class RequestCommands {
    public static Exit: Buffer = new Buffer("exit");
    public static Ping: Buffer = new Buffer("ping");
    public static Arguments = new Buffer("args");
    public static Completions = new Buffer("comp");
    public static Definitions = new Buffer("defs");
    public static Hover = new Buffer("hovr");
    public static Usages = new Buffer("usag");
    public static Names = new Buffer("name");
}

export namespace ResponseCommands {
    export const Pong = 'pong';
    export const TraceLog = 'tlog';
    export const Error = 'eror';
    export const Signature = "args";
    export const Completions = "comp";
    export const Definitions = "defs";
    export const Hover = "hovr";
    export const References = "usag";
    export const DocumentSymbols = "name";
}