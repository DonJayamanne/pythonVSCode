import * as vscode from 'vscode';
import { dirname, join } from 'path';

export function activateSingleFileDebug() {
    return vscode.commands.registerCommand('python.python-debug.startSession', config => {

        if (!config.request) { // if 'request' is missing interpret this as a missing launch.json        
            config.type = 'python';
            config.name = 'Launch';
            config.request = 'launch';
            config.pythonPath = "python";
            config.debugOptions = [
                "WaitOnAbnormalExit",
                "WaitOnNormalExit",
                "RedirectOutput"
            ];
            config.stopOnEntry = true;
            config.module = '';
            config.args = [];
            config.console = "none";
            config.exceptionHandling = [];
            config.env = null;

            if (vscode.workspace.rootPath) {
                config.cwd = vscode.workspace.rootPath;
            }

            if (!config.program) {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'python') {
                    config.program = editor.document.fileName;
                }
            }

            if (!config.cwd && config.program) {
                // fall back if 'cwd' not known: derive it from 'program'
                config.cwd = dirname(config.program);
            }
            if (vscode.workspace && vscode.workspace.rootPath) {
                config.envFile = join(vscode.workspace.rootPath, '.env');
            }
            if (!config.envFile && typeof config.cwd === 'string' && config.cwd.lengths > 0){
                config.envFile = join(config.cwd, '.env');
            }
            
        }

        vscode.commands.executeCommand('vscode.startDebug', config);
    });
}