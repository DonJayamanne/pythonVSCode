// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IExtensionActivationService } from '../../activation/types';
import { IApplicationEnvironment, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { traceDecorators, traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { Resource } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';

@injectable()
export class UpdateTestSettingService implements IExtensionActivationService {
    constructor(@inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationEnvironment) private readonly application: IApplicationEnvironment,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService) {
    }
    public async activate(resource: Resource): Promise<void> {
        this.updateTestSettings(resource).ignoreErrors();
    }
    @traceDecorators.error('Failed to update test settings')
    public async updateTestSettings(resource: Resource): Promise<void> {
        const filesToBeFixed = await this.getFilesToBeFixed(resource);
        await Promise.all(filesToBeFixed.map(file => this.fixSettingInFile(file)));
    }
    public getSettingsFiles(resource: Resource) {
        const settingsFiles: string[] = [];
        if (this.application.userSettingsFile) {
            settingsFiles.push(this.application.userSettingsFile);
        }
        const workspaceFolder = this.workspace.getWorkspaceFolder(resource);
        if (workspaceFolder) {
            settingsFiles.push(path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json'));
        }
        return settingsFiles;
    }
    public async getFilesToBeFixed(resource: Resource) {
        const files = this.getSettingsFiles(resource);
        const result = await Promise.all(files.map(async file => {
            const needsFixing = await this.doesFileNeedToBeFixed(file);
            return { file, needsFixing };
        }));
        return result.filter(item => item.needsFixing).map(item => item.file);
    }
    @swallowExceptions('Failed to update settings.json')
    public async fixSettingInFile(filePath: string) {
        let fileContents = await this.fs.readFile(filePath);
        const setting = new RegExp('"python.unitTest', 'g');
        const setting_pytest_enabled = new RegExp('.pyTestEnabled"', 'g');
        const setting_pytest_args = new RegExp('.pyTestArgs"', 'g');
        const setting_pytest_path = new RegExp('.pyTestPath"', 'g');
        const setting_jedi_disabled = new RegExp('.jediEnabled": false', 'g');
        const setting_jedi_enabled = new RegExp('.jediEnabled": true', 'g');

        fileContents = fileContents.replace(setting, '"python.testing');
        fileContents = fileContents.replace(setting_pytest_enabled, '.pytestEnabled"');
        fileContents = fileContents.replace(setting_pytest_args, '.pytestArgs"');
        fileContents = fileContents.replace(setting_pytest_path, '.pytestPath"');
        fileContents = fileContents.replace(setting_jedi_disabled, '.languageServer": "microsoft"');
        fileContents = fileContents.replace(setting_jedi_enabled, '.languageServer": "jedi"');
        await this.fs.writeFile(filePath, fileContents);
    }
    public async doesFileNeedToBeFixed(filePath: string) {
        try {
            const contents = await this.fs.readFile(filePath);
            return contents.indexOf('python.unitTest.') > 0 || contents.indexOf('.pyTest') > 0 ||
                contents.indexOf('python.jediEnabled') > 0;
        } catch (ex) {
            traceError('Failed to check if file needs to be fixed', ex);
            return false;
        }
    }
}
