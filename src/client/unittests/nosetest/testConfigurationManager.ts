import * as vscode from 'vscode';
import { TestConfigurationManager } from '../common/testConfigurationManager';
import * as fs from 'fs';
import * as path from 'path';
import { Installer, Product } from '../../common/installer';

export class ConfigurationManager extends TestConfigurationManager {
    public enable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.nosetestsEnabled', true);
    }
    public disable(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('unitTest.nosetestsEnabled', false);
    }

    private static configFilesExist(rootDir: string): Promise<string[]> {
        const promises = ['.noserc', 'nose.cfg'].map(cfg => {
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
        let installer = new Installer(this.outputChannel);
        return ConfigurationManager.configFilesExist(rootDir).then(configFiles => {
            if (configFiles.length > 0) {
                return Promise.resolve();
            }

            return this.getTestDirs(rootDir).then(subDirs => {
                return this.selectTestDir(rootDir, subDirs);
            }).then(testDir => {
                if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
                    args.push(testDir);
                }
            });
        }).then(() => {
            return installer.isInstalled(Product.nosetest);
        }).then(installed => {
            if (!installed) {
                return installer.install(Product.nosetest);
            }
        }).then(() => {
            const pythonConfig = vscode.workspace.getConfiguration('python');
            return pythonConfig.update('unitTest.nosetestArgs', args);
        });
    }
}