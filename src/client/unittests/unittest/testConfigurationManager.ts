import { Uri } from 'vscode';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { TestConfigurationManager } from '../common/managers/testConfigurationManager';

export class ConfigurationManager extends TestConfigurationManager {
    constructor(workspace: Uri, serviceContainer: IServiceContainer) {
        super(workspace, Product.unittest, serviceContainer);
    }
    public async requiresUserToConfigure(_wkspace: Uri): Promise<boolean> {
        return true;
    }
    public async configure(wkspace: Uri) {
        const args = ['-v'];
        const subDirs = await this.getTestDirs(wkspace.fsPath);
        const testDir = await this.selectTestDir(wkspace.fsPath, subDirs);
        args.push('-s');
        if (typeof testDir === 'string' && testDir !== '.') {
            args.push(`./${testDir}`);
        } else {
            args.push('.');
        }

        const testfilePattern = await this.selectTestFilePattern();
        args.push('-p');
        if (typeof testfilePattern === 'string') {
            args.push(testfilePattern);
        } else {
            args.push('test*.py');
        }
        await this.testConfigSettingsService.updateTestArgs(wkspace.fsPath, Product.unittest, args);
    }
}
