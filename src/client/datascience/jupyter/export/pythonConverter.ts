// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import '../../../common/extensions';
import { IFileSystem } from '../../../common/platform/types';
import { IConfigurationService, IDisposableRegistry } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { CodeSnippits, Identifiers } from '../../constants';
import { IJupyterExecution } from '../../types';

@injectable()
export class PythonConverter {
    // Template that changes markdown cells to have # %% [markdown] in the comments
    private readonly nbconvertTemplateFormat =
        // tslint:disable-next-line:no-multiline-string
        `{%- extends 'null.tpl' -%}
{% block codecell %}
{0}
{{ super() }}
{% endblock codecell %}
{% block in_prompt %}{% endblock in_prompt %}
{% block input %}{{ cell.source | ipython2python }}{% endblock input %}
{% block markdowncell scoped %}{0} [markdown]
{{ cell.source | comment_lines }}
{% endblock markdowncell %}`;

    private templatePromise: Promise<string | undefined>;

    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
    ) {
        this.templatePromise = this.createTemplateFile();
    }

    public async convert(notebookFile: string): Promise<string> {
        const template = await this.templatePromise;

        // Use the jupyter nbconvert functionality to turn the notebook into a python file
        if (await this.jupyterExecution.isImportSupported()) {
            let fileOutput: string = await this.jupyterExecution.importNotebook(notebookFile, template);
            if (fileOutput.includes('get_ipython()')) {
                fileOutput = this.addIPythonImport(fileOutput);
            }
            return this.addInstructionComments(fileOutput);
        }

        throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
    }
    private addInstructionComments = (pythonOutput: string): string => {
        const comments = localize.DataScience.instructionComments().format(this.defaultCellMarker);
        return comments.concat(pythonOutput);
    }

    private get defaultCellMarker(): string {
        return this.configuration.getSettings().datascience.defaultCellMarker || Identifiers.DefaultCodeCellMarker;
    }

    private addIPythonImport = (pythonOutput: string): string => {
        return CodeSnippits.ImportIPython.format(this.defaultCellMarker, pythonOutput);
    }

    private async createTemplateFile(): Promise<string | undefined> {
        // Create a temp file on disk
        const file = await this.fileSystem.createTemporaryFile('.tpl');

        // Write our template into it
        if (file) {
            try {
                // Save this file into our disposables so the temp file goes away
                this.disposableRegistry.push(file);
                await fs.appendFile(file.filePath, this.nbconvertTemplateFormat.format(this.defaultCellMarker));

                // Now we should have a template that will convert
                return file.filePath;
            } catch {
                noop();
            }
        }
    }
}
