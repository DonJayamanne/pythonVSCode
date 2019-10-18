// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { inject, injectable } from 'inversify';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import { CellState, ICell, IJupyterExecution, INotebookExporter, INotebookImporter } from '../types';
import { InvalidNotebookFileError } from './invalidNotebookFileError';

@injectable()
export class JupyterImporter implements INotebookImporter {

    public dispose = noop;
    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(INotebookExporter) private notebookExporter: INotebookExporter
    ) {
    }

    public async importCellsFromFile(file: string): Promise<ICell[]> {
        // First convert to a python file to verify this file is valid. This is
        // an easy way to have something else verify the validity of the file. If nbconvert isn't installed
        // just assume the file is correct.
        const results = (await this.jupyterExecution.isImportSupported()) ? await this.notebookExporter.export('python', file, {}) : '';
        if (results) {
            // Then read in the file as json. This json should already
            return this.importCells(await this.fileSystem.readFile(file));
        }

        throw new InvalidNotebookFileError(file);
    }

    public async importCells(json: string): Promise<ICell[]> {
        // Should we do validation here? jupyterlabs has a ContentsManager that can do validation, but skipping
        // for now because:
        // a) JSON parse should validate that it's JSON
        // b) cells check should validate it's at least close to a notebook
        // tslint:disable-next-line: no-any
        const contents = json ? JSON.parse(json) as any : undefined;
        if (contents && contents.cells) {
            // Convert the cells into actual cell objects
            const cells = contents.cells as (nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell)[];

            // Convert the inputdata into our ICell format
            return cells.map((c, index) => {
                return {
                    id: `NotebookImport#${index}`,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.finished,
                    data: c,
                    type: 'preview'
                };
            });
        }

        throw new InvalidNotebookFileError();
    }
}
