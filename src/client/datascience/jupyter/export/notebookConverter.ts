// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';

import { noop } from '../../../common/utils/misc';
import { splitMultilineString } from '../../common';
import { ICell, IJupyterExecution, NotebookExportOptions } from '../../types';
import { ExportHelper } from './helper';

@injectable()
export class NotebookConverter {
    constructor(@inject(IJupyterExecution) private jupyterExecution: IJupyterExecution, @inject(ExportHelper) private readonly helper: ExportHelper) {}

    public dispose() {
        noop();
    }

    public async convert(cells: ICell[], options: NotebookExportOptions): Promise<nbformat.INotebookContent> {
        // If requested, add in a change directory cell to fix relative paths
        if (options.directoryChange) {
            cells = await this.addDirectoryChangeCell(cells, options.directoryChange);
        }

        const pythonNumber = await this.extractPythonMainVersion();

        // Use this to build our metadata object
        // Use these as the defaults unless we have been given some in the options.
        const metadata: nbformat.INotebookMetadata = {
            language_info: {
                name: 'python',
                codemirror_mode: {
                    name: 'ipython',
                    version: pythonNumber
                }
            },
            orig_nbformat: 2,
            file_extension: '.py',
            mimetype: 'text/x-python',
            name: 'python',
            npconvert_exporter: 'python',
            pygments_lexer: `ipython${pythonNumber}`,
            version: pythonNumber
        };

        // If the notebook data provided only contains cell information, then add the above default information.
        // Not adding this is gives a invalid notebook with just cells.
        const properties = Object.keys(options.notebookData || {});
        const useDefaultData = properties.length === 0 || Array.isArray((options.notebookData || {}).cells);
        const defaultData = {
            nbformat: 4,
            nbformat_minor: 2,
            metadata: metadata
        };

        const notebookData = useDefaultData ? defaultData : options.notebookData;

        // Combine this into a JSON object
        return {
            ...(notebookData as nbformat.INotebookContent),
            cells: this.fixupCells(cells)
        };
    }
    private fixupCells(cells: ICell[]): nbformat.ICell[] {
        return cells.map(cell => ({
            ...cell.data,
            // Source is usually a single string on input. Convert back to an array
            source: splitMultilineString(cell.data.source)
        }));
    }
    // For exporting, put in a cell that will change the working directory back to the workspace directory so relative data paths will load correctly
    private addDirectoryChangeCell = async (cells: ICell[], file: string): Promise<ICell[]> => {
        const newCell = await this.helper.createDirectoryChangerCell(file, cells);
        return newCell ? [newCell, ...cells] : cells;
    }

    private extractPythonMainVersion = async (): Promise<number> => {
        // Use the active interpreter
        const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
        return usableInterpreter && usableInterpreter.version ? usableInterpreter.version.major : 3;
    }
}
