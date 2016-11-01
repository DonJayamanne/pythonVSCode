import * as vscode from 'vscode';
import { TestConfigurationManager } from '../common/testConfigurationManager';

export class ConfigurationManager extends TestConfigurationManager {
    public enable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.pyTestEnabled', true);
    }
    public disable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.pyTestEnabled', false);
    }

    public configure(rootDir: string): Promise<any> {
        const args = [];
        const configFileOptionLabel = 'Use existing config file';
        return this.getTestDirs(rootDir).then(subDirs => {
            const rootConfigFileOption = <vscode.QuickPickItem>{
                label: configFileOptionLabel,
                description: 'pytest.ini, tox.ini or setup.cfg'
            };
            return this.selectTestDir(rootDir, subDirs, [rootConfigFileOption]);
        }).then(testDir => {
            if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
                args.push(testDir);
            }
        }).then(() => {
            const pythonConfig = vscode.workspace.getConfiguration('python');
            return pythonConfig.update('unitTest.pyTestArgs', args);
        });
    }
}