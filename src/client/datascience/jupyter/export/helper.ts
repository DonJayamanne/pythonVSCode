// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import * as localize from '../../../common/utils/localize';
import { concatMultilineStringInput } from '../../common';
import { CodeSnippits, Identifiers } from '../../constants';
import { CellState, ICell } from '../../types';

@injectable()
export class ExportHelper {
    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IPlatformService) private readonly platform: IPlatformService
    ) {}

    public async createDirectoryChangerCell(notebookFile: string, cells: ICell[]): Promise<ICell | undefined> {
        const changeDirectory = await this.calculateDirectoryChange(notebookFile, cells);
        if (!changeDirectory){
            return;
        }
        const exportChangeDirectory = CodeSnippits.ChangeDirectory.join(EOL).format(
            localize.DataScience.exportChangeDirectoryComment(),
            CodeSnippits.ChangeDirectoryCommentIdentifier,
            changeDirectory
        );

        const cell: ICell = {
            data: {
                source: exportChangeDirectory,
                cell_type: 'code',
                outputs: [],
                metadata: {},
                execution_count: 0
            },
            id: uuid(),
            file: Identifiers.EmptyFileName,
            line: 0,
            state: CellState.finished
        };

        // Type isn't a known property of a cell.
        // tslint:disable-next-line: no-any
        (cell as any).type = 'execute';
    }
    private async calculateDirectoryChange(notebookFile: string, cells: ICell[]): Promise<string | undefined> {
        // Make sure we don't already have a cell with a ChangeDirectory comment in it.
        let directoryChange: string | undefined;

        const haveChangeAlready = (cells || []).some(c => concatMultilineStringInput(c.data.source).includes(CodeSnippits.ChangeDirectoryCommentIdentifier));

        if (!haveChangeAlready) {
            const notebookFilePath = path.dirname(notebookFile);
            // First see if we have a workspace open, this only works if we have a workspace root to be relative to
            if (this.workspaceService.hasWorkspaceFolders) {
                const workspacePath = await this.firstWorkspaceFolder(cells);

                // Make sure that we have everything that we need here
                if (workspacePath && path.isAbsolute(workspacePath) && notebookFilePath && path.isAbsolute(notebookFilePath)) {
                    directoryChange = path.relative(notebookFilePath, workspacePath);
                }
            }
        }

        // If path.relative can't calculate a relative path, then it just returns the full second path
        // so check here, we only want this if we were able to calculate a relative path, no network shares or drives
        if (directoryChange && !path.isAbsolute(directoryChange)) {
            // Escape windows path chars so they end up in the source escaped
            if (this.platform.isWindows) {
                directoryChange = directoryChange.replace('\\', '\\\\');
            }

            return directoryChange;
        }
    }
    // When we export we want to our change directory back to the first real file that we saw run from any workspace folder
    private firstWorkspaceFolder = async (cells: ICell[]): Promise<string | undefined> => {
        for (const cell of cells) {
            const filename = cell.file;

            // First check that this is an absolute file that exists (we add in temp files to run system cell)
            if (path.isAbsolute(filename) && (await this.fileSystem.fileExists(filename))) {
                // We've already check that workspace folders above
                for (const folder of this.workspaceService.workspaceFolders!) {
                    if (filename.toLowerCase().startsWith(folder.uri.fsPath.toLowerCase())) {
                        return folder.uri.fsPath;
                    }
                }
            }
        }
    }
}
