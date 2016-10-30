import * as vscode from 'vscode';
import {TestConfigurationManager} from '../common/testConfigurationManager';

export class ConfigurationManager extends TestConfigurationManager {
    public enable() {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        pythonConfig.update('unitTest.pyTestEnabled', true);
    }
    public disable() {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        pythonConfig.update('unitTest.pyTestEnabled', false);
    }

    public configure(rootDir: string): Promise<any> {
        return Promise.resolve();
    }
}