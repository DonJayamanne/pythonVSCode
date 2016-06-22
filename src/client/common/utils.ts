"use strict";

import * as path from "path";
import * as fs from "fs";
import * as child_process from "child_process";
import * as settings from "./configSettings";

const PathValidity: Map<string, boolean> = new Map<string, boolean>();
export function validatePath(filePath: string): Promise<string> {
    if (filePath.length === 0) {
        return Promise.resolve("");
    }
    if (PathValidity.has(filePath)) {
        return Promise.resolve(PathValidity.get(filePath) ? filePath : "");
    }
    return new Promise<string>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists ? filePath : "");
        });
    });
}

let pythonInterpretterDirectory: string = null;
let previouslyIdentifiedPythonPath: string = null;

export function getPythonInterpreterDirectory(): Promise<string> {
    // If we already have it and the python path hasn't changed, yay
    if (pythonInterpretterDirectory && previouslyIdentifiedPythonPath === settings.PythonSettings.getInstance().pythonPath) {
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
            // Yes this is a valid python path
            if (stdout.startsWith("1234")) {
                return resolve(path.dirname(pythonFileName));
            }
            // No idea, didn't work, hence don't reject, but return empty path
            resolve("");
        });
    }).then(value => {
        // Cache and return
        previouslyIdentifiedPythonPath = settings.PythonSettings.getInstance().pythonPath;
        return pythonInterpretterDirectory = value;
    }).catch(() => {
        // Don't care what the error is, all we know is that this doesn't work
        return pythonInterpretterDirectory = "";
    });
}

const IN_VALID_FILE_PATHS: Map<string, boolean> = new Map<string, boolean>();
export function execPythonFile(file: string, args: string[], cwd: string, includeErrorAsResponse: boolean = false): Promise<string> {
    // Whether to try executing the command without prefixing it with the python path
    let tryUsingCommandArg = false;
    if (file === settings.PythonSettings.getInstance().pythonPath) {
        return execFileInternal(file, args, cwd, includeErrorAsResponse);
    }

    let fullyQualifiedFilePromise = getPythonInterpreterDirectory().then(pyPath => {
        let pythonIntepreterPath = pyPath;
        let fullyQualifiedFile = file;
        if (pythonIntepreterPath.length === 0 || file.startsWith(pyPath)) {
            return execFileInternal(fullyQualifiedFile, args, cwd, includeErrorAsResponse);
        }

        // Qualify the command with the python path
        fullyQualifiedFile = path.join(pythonIntepreterPath, file);

        // Check if we know whether this trow ENONE errors
        if (IN_VALID_FILE_PATHS.has(fullyQualifiedFile)) {
            return execFileInternal(file, args, cwd, includeErrorAsResponse);
        }

        // It is possible this file doesn't exist, hence we initialize tryUsingCommandArg = true
        tryUsingCommandArg = true;

        if (PathValidity.has(fullyQualifiedFile)) {
            // If the file exists, then don't try again
            // If PathValidity value = false, that means we don't really know
            // Cuz we could have some command args suffixed in the file path (hopefully this will be fixed in a later build)
            if (PathValidity.get(fullyQualifiedFile)) {
                tryUsingCommandArg = false;
            }
            return execFileInternal(fullyQualifiedFile, args, cwd, includeErrorAsResponse, tryUsingCommandArg);
        }

        return validatePath(fullyQualifiedFile).then(f => {
            // If the file exists, then don't bother trying again
            if (f.length > 0) {
                tryUsingCommandArg = false;
            }
            return execFileInternal(fullyQualifiedFile, args, cwd, includeErrorAsResponse, true);
        });
    });

    return fullyQualifiedFilePromise.catch(error => {
        if (error && (<any>error).code === "ENOENT" && tryUsingCommandArg) {
            // Re-execute the file, without the python path prefix
            // Only if we know that the previous one failed with ENOENT
            return execFileInternal(file, args, cwd, includeErrorAsResponse);
        }
        // return what ever error we got from the previous process
        return Promise.reject(error);
    });
}

function handleResponse(error: Error, stdout: string, stderr: string, file: string, includeErrorAsResponse: boolean, rejectIfENOENTErrors: boolean = false): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if (error && ((<any>error).code === "ENOENT") || (<any>error).code === 127) {
            if (!IN_VALID_FILE_PATHS.has(file)) {
                IN_VALID_FILE_PATHS.set(file, true);
            }
            return reject(error);
        }

        // pylint:
        //      In the case of pylint we have some messages (such as config file not found and using default etc...) being returned in stderr
        //      These error messages are useless when using pylint   
        if (includeErrorAsResponse && (stdout.length > 0 || stderr.length > 0)) {
            return resolve(stdout + "\n" + stderr);
        }

        let hasErrors = (error && error.message.length > 0) || (stderr && stderr.length > 0);
        if (hasErrors && (typeof stdout !== "string" || stdout.length === 0)) {
            let errorMsg = (error && error.message) ? error.message : (stderr && stderr.length > 0 ? stderr + "" : "");
            return reject(errorMsg);
        }

        resolve(stdout + "");
    });
}
function execFileInternal(file: string, args: string[], cwd: string, includeErrorAsResponse: boolean, useExectFile: boolean = false): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if (useExectFile) {
            child_process.execFile(file, args, { cwd: cwd }, (error, stdout, stderr) => {
                handleResponse(error, stdout, stderr, file, includeErrorAsResponse, useExectFile).then(resolve, reject);
            });
        }
        else {
            child_process.exec(file + " " + args.join(" "), { cwd: cwd }, (error, stdout, stderr) => {
                handleResponse(error, stdout, stderr, file, includeErrorAsResponse, useExectFile).then(resolve, reject);
            });
        }
    });
}

export function mergeEnvVariables(newVariables: { [key: string]: string }): any {
    for (let setting in process.env) {
        if (!newVariables[setting]) {
            newVariables[setting] = process.env[setting];
        }
    }

    return newVariables;
}