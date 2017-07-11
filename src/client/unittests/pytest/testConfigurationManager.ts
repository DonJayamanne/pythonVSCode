import * as vscode from 'vscode';
import { TestConfigurationManager } from '../common/testConfigurationManager';
import * as fs from 'fs';
import * as path from 'path';
import { Installer, Product } from '../../common/installer';

export class ConfigurationManager extends TestConfigurationManager {
    public enable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.pyTestEnabled', true);
    }
    public disable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.pyTestEnabled', false);
    }

    private static configFilesExist(rootDir: string): Promise<string[]> {
        const promises = ['pytest.ini', 'tox.ini', 'setup.cfg'].map(cfg => {
            return new Promise<string>(resolve => {
                fs.exists(path.join(rootDir, cfg), exists => { resolve(exists ? cfg : ''); });
            });
        });
        return Promise.all(promises).then(values => {
            return values.filter(exists => exists.length > 0);
        });
    }
    public configure(rootDir: string): Promise<any> {
        const args = [];
        const configFileOptionLabel = 'Use existing config file';
        const options: vscode.QuickPickItem[] = [];
        let installer = new Installer(this.outputChannel);
        return ConfigurationManager.configFilesExist(rootDir).then(configFiles => {
            if (configFiles.length > 0 && configFiles.length !== 1 && configFiles[0] !== 'setup.cfg') {
                return Promise.resolve();
            }

            if (configFiles.length === 1 && configFiles[0] === 'setup.cfg') {
                options.push({
                    label: configFileOptionLabel,
                    description: 'setup.cfg'
                });
            }
            return this.getTestDirs(rootDir).then(subDirs => {
                return this.selectTestDir(rootDir, subDirs, options);
            }).then(testDir => {
                if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
                    args.push(testDir);
                }
            });
        }).then(() => {
            return installer.isInstalled(Product.pytest);
        }).then(installed => {
            if (!installed) {
                return installer.install(Product.pytest);
            }
        }).then(() => {
            const pythonConfig = vscode.workspace.getConfiguration('python');
            return pythonConfig.update('unitTest.pyTestArgs', args);
        });
    }
}