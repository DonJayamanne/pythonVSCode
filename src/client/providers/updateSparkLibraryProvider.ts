"use strict";
import { Commands } from '../common/constants';
import * as vscode from "vscode";
import * as path from 'path';

export function activateUpdateSparkLibraryProvider(): vscode.Disposable {
    return vscode.commands.registerCommand(Commands.Update_SparkLibrary, updateSparkLibrary);
}

function updateSparkLibrary() {
    const pythonConfig = vscode.workspace.getConfiguration('python');
    const extraLibPath = 'autoComplete.extraPaths';
    let sparkHomePath = '${env.SPARK_HOME}';
    pythonConfig.update(extraLibPath, [path.join(sparkHomePath, 'python'),
    path.join(sparkHomePath, 'python/pyspark')]).then(() => {
        //Done
    }, reason => {
        vscode.window.showErrorMessage(`Failed to update ${extraLibPath}. Error: ${reason.message}`);
        console.error(reason);
    });    
    vscode.window.showInformationMessage(`Make sure you have SPARK_HOME environment variable set to the root path of the local spark installation!`);
}