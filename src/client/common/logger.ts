import * as vscode from "vscode";
import * as settings from "./configSettings";

let outChannel: vscode.OutputChannel;

class Logger {
    public static IsDebug: boolean;
    static initializeChannel() {
        if (settings.PythonSettings.getInstance().devOptions.indexOf("DEBUG") >= 0) {
            Logger.IsDebug = true;
            outChannel = vscode.window.createOutputChannel("PythonExtLog");
        }
    }

    static write(category: string = "log", title: string = "", message: any) {
        Logger.initializeChannel();
        if (title.length > 0) {
            Logger.writeLine(category, "---------------------------");
            Logger.writeLine(category, title);
        }

        Logger.writeLine(category, message);
    }
    static writeLine(category: string = "log", line: any) {
        if (process.env['VSC_PYTHON_CI_TEST'] !== '1') {
            console[category](line);
        }
        if (outChannel) {
            outChannel.appendLine(line);
        }
    }
}
export function error(title: string = "", message: any) {
    Logger.write.apply(Logger, ["error", title, message]);
}
export function warn(title: string = "", message: any) {
    Logger.write.apply(Logger, ["warn", title, message]);
}
export function log(title: string = "", message: any) {
    if (!Logger.IsDebug) return;
    Logger.write.apply(Logger, ["log", title, message]);
}
