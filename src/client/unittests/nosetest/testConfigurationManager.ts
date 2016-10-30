import * as vscode from 'vscode';
import {TestConfigurationManager} from '../common/testConfigurationManager';

export class ConfigurationManager extends TestConfigurationManager {
    public enable() {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        pythonConfig.update('unitTest.nosetestsEnabled', true);
    }
    public disable() {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        pythonConfig.update('unitTest.nosetestsEnabled', false);
    }

    public configure(rootDir: string): Promise<any> {
        return Promise.resolve();
    }
}