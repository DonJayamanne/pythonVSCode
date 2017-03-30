import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import { PythonSettings } from '../common/configSettings';

const pythonSettings = PythonSettings.getInstance();

export class Generator implements vscode.Disposable {
    private optionsFile: string;
    private disposables: vscode.Disposable[];

    constructor(private output: vscode.OutputChannel) {
        this.disposables = [];
        this.optionsFile = path.join(__dirname, '..', '..', '..', 'resources', 'ctagOptions');
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private buildCmdArgsg(): string[] {
        const optionsFile = this.optionsFile.indexOf(' ') > 0 ? `"${this.optionsFile}"` : this.optionsFile;
        const exclusions = pythonSettings.workspaceSymbols.exclusionPatterns;
        const excludes = exclusions.length === 0 ? [] : exclusions.map(pattern => `--exclude=${pattern}`);

        return [`--options=${optionsFile}`, '--languages=Python'].concat(excludes);
    }

    generateWorkspaceTags(): Promise<any> {
        const tagFile = pythonSettings.workspaceSymbols.tagFilePath;
        return this.generateTags(tagFile, { directory: vscode.workspace.rootPath });
    }

    private generateTags(outputFile: string, source: { directory?: string, file?: string }): Promise<any> {
        const cmd = pythonSettings.workspaceSymbols.ctagsPath;
        const args = this.buildCmdArgsg();
        if (source.file && source.file.length > 0) {
            source.directory = path.dirname(source.file);
        }

        if (path.dirname(outputFile) === source.directory) {
            outputFile = path.basename(outputFile);
        }
        outputFile = outputFile.indexOf(' ') > 0 ? `"${outputFile}"` : outputFile;

        args.push(`-o ${outputFile}`, '.');
        this.output.appendLine('-'.repeat(10) + 'Generating Tags' + '-'.repeat(10));
        this.output.appendLine(`${cmd} ${args.join(' ')}`);
        const promise = new Promise<any>((resolve, reject) => {
            let options: child_process.SpawnOptions = {
                cwd: source.directory
            };

            let hasErrors = false;
            let errorMsg = '';
            const proc = child_process.spawn(cmd, args, options);
            proc.stderr.setEncoding('utf8');
            proc.stdout.setEncoding('utf8');
            proc.on('error', (error: Error) => {
                reject(error);
            });
            proc.stderr.on('data', (data: string) => {
                errorMsg += data;
                this.output.append(data);
            });
            proc.stdout.on('data', (data: string) => {
                this.output.append(data);
            });
            proc.on('exit', () => {
                if (hasErrors) {
                    reject(errorMsg);
                }
                else {
                    resolve(outputFile);
                }
            });
        });

        vscode.window.setStatusBarMessage('Generating Tags', promise);

        return promise;
    }
}