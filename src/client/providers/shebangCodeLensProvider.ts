"use strict";
import { IS_WINDOWS } from '../common/utils';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as settings from '../common/configSettings';
import { TextDocument, CodeLens, CancellationToken } from 'vscode';
import { getFirstNonEmptyLineFromMultilineString } from '../interpreter/helpers';
export class ShebangCodeLensProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses: vscode.Event<void> = vscode.workspace.onDidChangeConfiguration;

    public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
        const codeLenses = await this.createShebangCodeLens(document);
        return Promise.resolve(codeLenses);
    }

    private async createShebangCodeLens(document: TextDocument) {
        const shebang = await ShebangCodeLensProvider.detectShebang(document);
        if (!shebang || shebang === settings.PythonSettings.getInstance(document.uri).pythonPath) {
            return [];
        }

        const firstLine = document.lineAt(0);
        const startOfShebang = new vscode.Position(0, 0);
        const endOfShebang = new vscode.Position(0, firstLine.text.length - 1);
        const shebangRange = new vscode.Range(startOfShebang, endOfShebang);

        const cmd: vscode.Command = {
            command: 'python.setShebangInterpreter',
            title: 'Set as interpreter'
        };

        const codeLenses = [(new CodeLens(shebangRange, cmd))];
        return codeLenses;
    }

    public static async detectShebang(document: TextDocument): Promise<string | undefined> {
        let firstLine = document.lineAt(0);
        if (firstLine.isEmptyOrWhitespace) {
            return;
        }

        if (!firstLine.text.startsWith('#!')) {
            return;
        }

        const shebang = firstLine.text.substr(2).trim();
        const pythonPath = await ShebangCodeLensProvider.getFullyQualifiedPathToInterpreter(shebang);
        return typeof pythonPath === 'string' && pythonPath.length > 0 ? pythonPath : undefined;
    }
    private static async getFullyQualifiedPathToInterpreter(pythonPath: string) {
        if (pythonPath.indexOf('bin/env ') >= 0 && !IS_WINDOWS) {
            // In case we have pythonPath as '/usr/bin/env python'            
            return new Promise<string>(resolve => {
                const command = child_process.exec(`${pythonPath} -c 'import sys;print(sys.executable)'`);
                let result = '';
                command.stdout.on('data', (data) => {
                    result += data.toString();
                });
                command.on('close', () => {
                    resolve(getFirstNonEmptyLineFromMultilineString(result));
                });
            });
        }
        else {
            return new Promise<string>(resolve => {
                child_process.execFile(pythonPath, ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                    resolve(getFirstNonEmptyLineFromMultilineString(stdout));
                });
            });
        }
    }
}
