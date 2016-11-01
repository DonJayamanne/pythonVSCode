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

    private static configFilesExist(rootDir: string): Promise<boolean> {
        const promises = [
            new Promise<boolean>(resolve => {
                fs.exists(path.join(rootDir, 'pytest.ini'), exists => { resolve(true); });
            }),
            new Promise<boolean>(resolve => {
                fs.exists(path.join(rootDir, 'tox.ini'), exists => { resolve(true); });
            }),
            new Promise<boolean>(resolve => {
                fs.exists(path.join(rootDir, 'setup.cfg'), exists => { resolve(true); });
            })];
        return Promise.all(promises).then(values => {
            return values.some(exists => exists);
        });
    }
    public configure(rootDir: string): Promise<any> {
        const args = [];
        const configFileOptionLabel = 'Use existing config file';
        const options: vscode.QuickPickItem[] = [];
        let installer = new Installer(this.outputChannel);
        return ConfigurationManager.configFilesExist(rootDir).then(configExists => {
            if (configExists) {
                options.push({
                    label: configFileOptionLabel,
                    description: 'pytest.ini, tox.ini or setup.cfg'
                });
            }
        }).then(() => {
            return this.getTestDirs(rootDir);
        }).then(subDirs => {
            return this.selectTestDir(rootDir, subDirs, options);
        }).then(testDir => {
            if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
                args.push(testDir);
            }
        }).then(() => {
            return installer.isProductInstalled(Product.pytest);
        }).then(installed => {
            if (!installed){
                return installer.installProduct(Product.pytest);
            }
        }).then(() => {
            const pythonConfig = vscode.workspace.getConfiguration('python');
            return pythonConfig.update('unitTest.pyTestArgs', args);
        });
    }
}