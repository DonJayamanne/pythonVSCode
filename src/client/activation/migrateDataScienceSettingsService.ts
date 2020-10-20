// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IApplicationEnvironment, IWorkspaceService } from '../common/application/types';
import { traceError } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { Resource } from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { traceDecorators } from '../logging';
import { IExtensionActivationService } from './types';

@injectable()
export class MigrateDataScienceSettingsService implements IExtensionActivationService {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationEnvironment) private readonly application: IApplicationEnvironment,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService
    ) {}

    public async activate(resource: Resource): Promise<void> {
        this.updateSettings(resource).ignoreErrors();
    }

    @swallowExceptions('Failed to update settings.json')
    public async fixSettingInFile(filePath: string): Promise<string> {
        let fileContents = await this.fs.readLocalFile(filePath);
        fileContents = fileContents.replace(
            /"python\.dataScience\.(.*?)":/g,
            (_match, capture) => `"jupyter.${capture}":`
        );
        await this.fs.writeLocalFile(filePath, fileContents);
        return fileContents;
    }

    @traceDecorators.error('Failed to update test settings')
    private async updateSettings(resource: Resource): Promise<void> {
        const filesToBeFixed = await this.getFilesToBeFixed(resource);
        await Promise.all(filesToBeFixed.map((file) => this.fixSettingInFile(file)));
    }

    private getSettingsFiles(resource: Resource): string[] {
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

    private async getFilesToBeFixed(resource: Resource): Promise<string[]> {
        const files = this.getSettingsFiles(resource);
        const result = await Promise.all(
            files.map(async (file) => {
                const needsFixing = await this.doesFileNeedToBeFixed(file);
                return { file, needsFixing };
            })
        );
        return result.filter((item) => item.needsFixing).map((item) => item.file);
    }

    private async doesFileNeedToBeFixed(filePath: string): Promise<boolean> {
        try {
            if (await this.fs.localFileExists(filePath)) {
                const contents = await this.fs.readLocalFile(filePath);
                return contents.indexOf('python.dataScience') > 0;
            } else {
                return false;
            }
        } catch (ex) {
            traceError('Failed to check if settings file needs to be fixed', ex);
            return false;
        }
    }
}
