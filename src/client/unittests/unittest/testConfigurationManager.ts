import * as path from 'path';
import { OutputChannel, Uri } from 'vscode';
import { Installer, Product } from '../../common/installer';
import { TestConfigurationManager } from '../common/testConfigurationManager';
import { ITestConfigSettingsService } from '../common/types';

export class ConfigurationManager extends TestConfigurationManager {
    constructor(workspace: Uri, outputChannel: OutputChannel,
        installer: Installer, testConfigSettingsService: ITestConfigSettingsService) {
        super(workspace, Product.unittest, outputChannel, installer, testConfigSettingsService);
    }
    // tslint:disable-next-line:no-any
    public async configure(rootDir: string) {
        const args = ['-v'];
        const subDirs = await this.getTestDirs(rootDir);
        const testDir = await this.selectTestDir(rootDir, subDirs);
        args.push('-s');
        if (typeof testDir === 'string' && testDir !== '.') {
            args.push(`.${path.sep}${testDir}`);
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
        await this.testConfigSettingsService.updateTestArgs(rootDir, Product.unittest, args);
    }
}
