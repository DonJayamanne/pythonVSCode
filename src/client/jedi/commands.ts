"use strict";

export class Commands {
    public static Exit: Buffer = new Buffer("exit");
    public static Ping: Buffer = new Buffer("ping");
    public static Arguments = new Buffer("args");
    public static Completions = new Buffer("comp");
    public static Definitions = new Buffer("defs");
    public static Hover = new Buffer("hovr");
    public static Usages = new Buffer("usaaag");
    public static Names = new Buffer("name");
}

export namespace ResponseCommands {
    export const Pong = 'pong';
    export const Error = 'eror';
    export const Arguments = "args";
    export const Completions = "comp";
    export const Definitions = "defs";
    export const Hover = "hovr";
    export const Usages = "usag";
    export const Names = "name";
}

/*
commandNames.set(CommandType.Arguments, "arguments");
commandNames.set(CommandType.Completions, "completions");
commandNames.set(CommandType.Definitions, "definitions");
commandNames.set(CommandType.Hover, "tooltip");
commandNames.set(CommandType.Usages, "usages");
commandNames.set(CommandType.Symbols, "names");
*/