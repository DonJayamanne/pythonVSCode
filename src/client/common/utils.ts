"use strict";

import * as path from "path";
import * as fs from "fs";
import * as child_process from "child_process";
import * as settings from "./configSettings";

let pythonInterpretterDirectory: string = null;
export function getPythonInterpreterDirectory(): Promise<string> {
    if (pythonInterpretterDirectory) {
        return Promise.resolve(pythonInterpretterDirectory);
    }

    return new Promise<string>(resolve => {
        let pythonFileName = settings.PythonSettings.getInstance().pythonPath;

        // Check if we have the path
        let dirName = path.dirname(pythonFileName);
        if (dirName.length === 0 || dirName === "." || dirName.length === pythonFileName.length) {
            return resolve("");
        }

        // If we can execute the python, then get the path from the fullyqualitified name
        child_process.execFile(pythonFileName, ["-c", "print(1234)"], (error, stdout, stderr) => {
            if (stdout.startsWith("1234")) {
                return resolve(path.dirname(pythonFileName));
            }
            resolve("");
        });
    }).then(value => {
        return pythonInterpretterDirectory = value;
    }).catch(() => {
        // Don't care what the error is, all we know is that this doesn't work
        return pythonInterpretterDirectory = "";
    });
}

const filesThrowingENOENTErrors: string[] = [];

export function execPythonFile(file: string, args: string[], cwd: string, includeErrorAsResponse: boolean = false): Promise<string> {
    // Whether to try executing the command without prefixing it with the python path
    let tryUsingCommandArg = false;

    let fullyQualifiedFilePromise = getPythonInterpreterDirectory().then(pyPath => {
        let pythonIntepreterPath = pyPath;
        let fullyQualifiedFile = file;

        // Qualify the command with the python path
        if (pythonIntepreterPath.length > 0 && !file.startsWith(pyPath)) {
            fullyQualifiedFile = pythonIntepreterPath + (pythonIntepreterPath.endsWith(path.sep) ? "" : path.sep) + file;

            // Check if we know whether this trow ENONE errors
            if (filesThrowingENOENTErrors.indexOf(fullyQualifiedFile) >= 0) {
                fullyQualifiedFile = file;
            }
            else {
                tryUsingCommandArg = true;
            }
        }

        return execFileInternal(fullyQualifiedFile, args, cwd, includeErrorAsResponse, true);
    });

    if (tryUsingCommandArg) {
        return fullyQualifiedFilePromise.catch(error => {
            // Re-execute the file, without the python path prefix
            return execFileInternal(file, args, cwd, includeErrorAsResponse, true);
        });
    }
    else {
        return fullyQualifiedFilePromise;
    }
}

function execFileInternal(file: string, args: string[], cwd: string, includeErrorAsResponse: boolean, rejectIfENOENTErrors: boolean = false): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        child_process.execFile(file, args, { cwd: cwd }, (error, stdout, stderr) => {
            if (includeErrorAsResponse && (stdout.length > 0 || stderr.length > 0)) {
                return resolve(stdout + "\n" + stderr);
            }
            if (error && (<any>error).code === "ENOENT" && rejectIfENOENTErrors) {
                filesThrowingENOENTErrors.push(file);
                return reject(error);
            }

            let hasErrors = (error && error.message.length > 0) || (stderr && stderr.length > 0);
            if (hasErrors && (typeof stdout !== "string" || stdout.length === 0)) {
                let errorMsg = (error && error.message) ? error.message : (stderr && stderr.length > 0 ? stderr + "" : "");
                return reject(errorMsg);
            }

            resolve(stdout + "");
        });
    });
}
