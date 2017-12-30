import * as vscode from 'vscode';
import { CancellationToken, CodeLens, TextDocument, Uri } from 'vscode';
import * as settings from '../../common/configSettings';
import { IProcessServiceFactory } from '../../common/process/processServiceFactory';
import { IS_WINDOWS } from '../../common/utils';

export class ShebangCodeLensProvider implements vscode.CodeLensProvider {
    // tslint:disable-next-line:no-any
    public onDidChangeCodeLenses: vscode.Event<void> = vscode.workspace.onDidChangeConfiguration as any as vscode.Event<void>;
    constructor(private processServiceFactory: IProcessServiceFactory) { }
    // tslint:disable-next-line:function-name
    public async detectShebang(document: TextDocument): Promise<string | undefined> {
        const firstLine = document.lineAt(0);
        if (firstLine.isEmptyOrWhitespace) {
            return;
        }

        if (!firstLine.text.startsWith('#!')) {
            return;
        }

        const shebang = firstLine.text.substr(2).trim();
        const pythonPath = await this.getFullyQualifiedPathToInterpreter(shebang, document.uri);
        return typeof pythonPath === 'string' && pythonPath.length > 0 ? pythonPath : undefined;
    }

    public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
        const codeLenses = await this.createShebangCodeLens(document);
        return Promise.resolve(codeLenses);
    }
    private async getFullyQualifiedPathToInterpreter(pythonPath: string, resource: Uri) {
        let cmdFile = pythonPath;
        let args = ['-c', 'import sys;print(sys.executable)'];
        if (pythonPath.indexOf('bin/env ') >= 0 && !IS_WINDOWS) {
            // In case we have pythonPath as '/usr/bin/env python'.
            const parts = pythonPath.split(' ').map(part => part.trim()).filter(part => part.length > 0);
            cmdFile = parts.shift()!;
            args = parts.concat(args);
        }
        return this.processServiceFactory.create(resource).exec(cmdFile, args)
            .then(output => output.stdout.trim())
            .catch(() => '');
    }
    private async createShebangCodeLens(document: TextDocument) {
        const shebang = await this.detectShebang(document);
        const pythonPath = settings.PythonSettings.getInstance(document.uri).pythonPath;
        const resolvedPythonPath = await this.getFullyQualifiedPathToInterpreter(pythonPath, document.uri);
        if (!shebang || shebang === resolvedPythonPath) {
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

        return [(new CodeLens(shebangRange, cmd))];
    }
}
