// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../common/application/types';
import { IFileSystem } from '../common/platform/types';

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import type { NotebookCell, NotebookCellRunState } from '../../../types/vscode-proposed';
import { concatMultilineString } from '../../datascience-ui/common';
import { IConfigurationService } from '../common/types';
import { CellState, ICell } from './types';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

export async function calculateWorkingDirectory(
    configService: IConfigurationService,
    workspace: IWorkspaceService,
    fs: IFileSystem
): Promise<string | undefined> {
    let workingDir: string | undefined;
    // For a local launch calculate the working directory that we should switch into
    const settings = configService.getSettings(undefined);
    const fileRoot = settings.notebookFileRoot;

    // If we don't have a workspace open the notebookFileRoot seems to often have a random location in it (we use ${workspaceRoot} as default)
    // so only do this setting if we actually have a valid workspace open
    if (fileRoot && workspace.hasWorkspaceFolders) {
        const workspaceFolderPath = workspace.workspaceFolders![0].uri.fsPath;
        if (path.isAbsolute(fileRoot)) {
            if (await fs.localDirectoryExists(fileRoot)) {
                // User setting is absolute and exists, use it
                workingDir = fileRoot;
            } else {
                // User setting is absolute and doesn't exist, use workspace
                workingDir = workspaceFolderPath;
            }
        } else if (!fileRoot.includes('${')) {
            // fileRoot is a relative path, combine it with the workspace folder
            const combinedPath = path.join(workspaceFolderPath, fileRoot);
            if (await fs.localDirectoryExists(combinedPath)) {
                // combined path exists, use it
                workingDir = combinedPath;
            } else {
                // Combined path doesn't exist, use workspace
                workingDir = workspaceFolderPath;
            }
        } else {
            // fileRoot is a variable that hasn't been expanded
            workingDir = fileRoot;
        }
    }
    return workingDir;
}

export function translateCellToNative(
    cell: ICell,
    language: string
): (Partial<NotebookCell> & { code: string }) | undefined {
    if (cell && cell.data && cell.data.source) {
        const query = '?query#';
        return {
            index: 0,
            language: language,
            metadata: {
                executionOrder: cell.data.execution_count as number,
                hasExecutionOrder: true,
                runState: translateCellStateToNative(cell.state)
            },
            uri: Uri.parse(cell.file + query + cell.id),
            outputs: [],
            cellKind: vscodeNotebookEnums.CellKind.Code,
            code: concatMultilineString(cell.data.source)
        };
    }
}

export function translateCellFromNative(cell: NotebookCell): ICell {
    const data: nbformat.ICodeCell = {
        cell_type: 'code',
        metadata: {},
        outputs: [],
        execution_count: cell.metadata.executionOrder ? cell.metadata.executionOrder : 0,
        source: cell.document.getText().splitLines()
    };
    return {
        id: cell.uri.fragment,
        file: cell.uri.fsPath,
        line: 0,
        state: translateCellStateFromNative(
            cell.metadata.runState ? cell.metadata.runState : vscodeNotebookEnums.NotebookCellRunState.Idle
        ),
        data: data
    };
}

export function translateCellStateToNative(state: CellState): NotebookCellRunState {
    switch (state) {
        case CellState.editing:
            return vscodeNotebookEnums.NotebookCellRunState.Idle;
        case CellState.error:
            return vscodeNotebookEnums.NotebookCellRunState.Error;
        case CellState.executing:
            return vscodeNotebookEnums.NotebookCellRunState.Running;
        case CellState.finished:
            return vscodeNotebookEnums.NotebookCellRunState.Success;
        case CellState.init:
            return vscodeNotebookEnums.NotebookCellRunState.Idle;
        default:
            return vscodeNotebookEnums.NotebookCellRunState.Idle;
    }
}

export function translateCellStateFromNative(state: NotebookCellRunState): CellState {
    switch (state) {
        case vscodeNotebookEnums.NotebookCellRunState.Error:
            return CellState.error;
        case vscodeNotebookEnums.NotebookCellRunState.Idle:
            return CellState.init;
        case vscodeNotebookEnums.NotebookCellRunState.Running:
            return CellState.executing;
        case vscodeNotebookEnums.NotebookCellRunState.Success:
            return CellState.finished;
        default:
            return CellState.init;
    }
}
