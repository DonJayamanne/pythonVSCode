import * as vscode from 'vscode';
import * as path from 'path';
import { TestConfigurationManager } from '../common/testConfigurationManager';

export class ConfigurationManager extends TestConfigurationManager {
    public enable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.unittestEnabled', true);
    }
    public disable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.unittestEnabled', false);
    }

    public configure(rootDir: string): Promise<any> {
        const args = ['-v'];
        return this.getTestDirs(rootDir).then(subDirs => {
            return this.selectTestDir(rootDir, subDirs);
        }).then(testDir => {
            args.push('-s');
            if (typeof testDir === 'string' && testDir !== '.') {
                args.push(`.${path.sep}${testDir}`);
            }
            else {
                args.push('.');
            }

            return this.selectTestFilePattern();
        }).then(testfilePattern => {
            args.push('-p');
            if (typeof testfilePattern === 'string') {
                args.push(testfilePattern);
            }
            else {
                args.push('test*.py');
            }
        }).then(() => {
            const pythonConfig = vscode.workspace.getConfiguration('python');
            return pythonConfig.update('unitTest.unittestArgs', args);
        });
    }
}