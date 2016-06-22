"use strict";

import * as path from "path";
import * as fs from "fs";
import * as child_process from "child_process";
import * as settings from "./configSettings";

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

export function execPythonFile(file: string, args: string[], cwd: string, includeErrorAsResponse: boolean = false): Promise<string> {
    return getPythonInterpreterDirectory().then(pyPath => {
        let options: any = { cwd: cwd };

        // If we have a fully qualitified path to the python executable directory, then we can use that
        // as the base path for all other executables
        if (pyPath.length > 0) {
            options.env = mergeEnvVariables({ PATH: pyPath + path.delimiter + process.env.PATH });
        }

        return execFileInternal(file, args, options, includeErrorAsResponse);
    });
}

function execFileInternal(file: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        child_process.execFile(file, args, options, (error, stdout, stderr) => {
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