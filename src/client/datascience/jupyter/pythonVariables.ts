// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { JSONObject } from '@phosphor/coreutils';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DebugSession } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IJupyterVariable, IJupyterVariables, INotebook } from '../types';

@injectable()
export class PythonVariables implements IJupyterVariables {
    private fetchVariablesScript?: string;
    private fetchVariableValueScript?: string;
    private fetchDataFrameInfoScript?: string;
    private fetchDataFrameRowsScript?: string;
    private filesLoaded: boolean = false;
    constructor(@inject(IFileSystem) private fileSystem: IFileSystem) {}

    // IJupyterVariables implementation
    public async getVariables(notebook: INotebook): Promise<IJupyterVariable[]> {
        // Run the fetch variables script.
        return this.runScript<IJupyterVariable[]>(notebook, undefined, [], () => this.fetchVariablesScript);
    }

    public async getValue(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        // Run the get value script
        return this.runScript<IJupyterVariable>(notebook, targetVariable, targetVariable, () => this.fetchVariableValueScript);
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable> {
        // Run the get dataframe info script
        return this.runScript<IJupyterVariable>(notebook, targetVariable, targetVariable, () => this.fetchDataFrameInfoScript, [
            { key: '_VSCode_JupyterValuesColumn', value: localize.DataScience.valuesColumn() }
        ]);
    }

    public async getDataFrameRows(targetVariable: IJupyterVariable, notebook: INotebook, start: number, end: number): Promise<JSONObject> {
        // Run the get dataframe rows script
        return this.runScript<JSONObject>(notebook, targetVariable, {}, () => this.fetchDataFrameRowsScript, [
            { key: '_VSCode_JupyterValuesColumn', value: localize.DataScience.valuesColumn() },
            { key: '_VSCode_JupyterStartRow', value: start.toString() },
            { key: '_VSCode_JupyterEndRow', value: end.toString() }
        ]);
    }

    // Private methods
    // Load our python files for fetching variables
    private async loadVariableFiles(): Promise<void> {
        let file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableList.py');
        this.fetchVariablesScript = await this.fileSystem.readFile(file);

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableValue.py');
        // this.fetchVariableValueScript = await this.fileSystem.readFile(file);
        this.fetchVariableValueScript = 'getJupyterVariableValue.do(_VSCode_JupyterTestValue, globals(), locals())';

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableDataFrameInfo.py');
        // this.fetchDataFrameInfoScript = await this.fileSystem.readFile(file);
        this.fetchDataFrameInfoScript = 'getJupyterVariableDataFrameInfo.do(_VSCode_JupyterTestValue, globals(), locals())';

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableDataFrameRows.py');
        this.fetchDataFrameRowsScript = await this.fileSystem.readFile(file);
        this.fetchDataFrameRowsScript = 'getJupyterVariableDataFrameRows.do(_VSCode_JupyterTestValue, _VSCode_JupyterStartRow, _VSCode_JupyterEndRow, globals(), locals())';

        this.filesLoaded = true;
    }

    private async runScript<T>(
        notebook: INotebook,
        targetVariable: IJupyterVariable | undefined,
        defaultValue: T,
        scriptBaseTextFetcher: () => string | undefined,
        extraReplacements: { key: string; value: string }[] = []
    ): Promise<T> {
        if (!this.filesLoaded) {
            await this.loadVariableFiles();
        }

        const scriptBaseText = scriptBaseTextFetcher();
        if (!notebook || !scriptBaseText) {
            // No active server just return the unchanged target variable
            return defaultValue;
        }

        // Prep our targetVariable to send over
        const variableString = JSON.stringify(targetVariable);

        // Setup a regex
        const regexPattern = extraReplacements.length === 0 ? '_VSCode_JupyterTestValue' : ['_VSCode_JupyterTestValue', ...extraReplacements.map(v => v.key)].join('|');
        const replaceRegex = new RegExp(regexPattern, 'g');

        // Replace the test value with our current value. Replace start and end as well
        const scriptText = scriptBaseText.replace(replaceRegex, (match: string) => {
            if (match === '_VSCode_JupyterTestValue') {
                return variableString;
            } else {
                const index = extraReplacements.findIndex(v => v.key === match);
                if (index >= 0) {
                    return extraReplacements[index].value;
                }
            }

            return match;
        });

        // Execute this on the notebook passed in.
        // tslint:disable-next-line: no-any
        const dbgSession = (notebook as any) as DebugSession;
        // Try twice.
        let value = defaultValue;
        try {
            await dbgSession.customRequest('evaluate', {
                expression:
                    'import sys;sys.path.append("/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/pythonFiles/datascience");import getJupyterVariableValue;import getJupyterVariableDataFrameRows;import getJupyterVariableDataFrameInfo',
                frameId: targetVariable!.frameId!,
                context: 'repl'
            });
        } catch (ex) {
            console.error(ex);
        }
        try {
            await sleep(1000);
            if (value === defaultValue) {
                let expression = `getJupyterVariableValue.do(${JSON.stringify(targetVariable!)
                    .replace(/true/g, 'True')
                    .replace(/true/g, 'False')}, globals(), locals())`;
                expression = scriptText.replace('true', 'True').replace('false', 'False');
                const reulst = await dbgSession.customRequest('evaluate', { expression, frameId: targetVariable!.frameId!, context: 'repl' });
                value = JSON.parse(reulst.result.slice(1, -1));
                value = { ...targetVariable!, ...value };
            }
        } catch (ex) {
            console.error(ex);
        }
        console.log(value);
        return value;
        // const results = await notebook.execute(scriptText, Identifiers.EmptyFileName, 0, uuid(), undefined, true);

        // // Results should be the updated variable.
        // return this.deserializeJupyterResult<T>(results);
    }

    // // Pull our text result out of the Jupyter cell
    // private deserializeJupyterResult<T>(cells: ICell[]): T {
    //     // Verify that we have the correct cell type and outputs
    //     if (cells.length > 0 && cells[0].data) {
    //         const codeCell = cells[0].data as nbformat.ICodeCell;
    //         if (codeCell.outputs.length > 0) {
    //             const codeCellOutput = codeCell.outputs[0] as nbformat.IOutput;
    //             if (codeCellOutput && codeCellOutput.output_type === 'stream' && codeCellOutput.name === 'stderr' && codeCellOutput.hasOwnProperty('text')) {
    //                 const resultString = codeCellOutput.text as string;
    //                 // See if this the IOPUB data rate limit problem
    //                 if (resultString.includes('iopub_data_rate_limit')) {
    //                     throw new JupyterDataRateLimitError();
    //                 } else {
    //                     const error = localize.DataScience.jupyterGetVariablesExecutionError().format(resultString);
    //                     traceError(error);
    //                     throw new Error(error);
    //                 }
    //             }
    //             if (codeCellOutput && codeCellOutput.output_type === 'stream' && codeCellOutput.hasOwnProperty('text')) {
    //                 const resultString = codeCellOutput.text as string;
    //                 return JSON.parse(resultString) as T;
    //             }
    //             if (codeCellOutput && codeCellOutput.output_type === 'error' && codeCellOutput.hasOwnProperty('traceback')) {
    //                 const traceback: string[] = codeCellOutput.traceback as string[];
    //                 const stripped = traceback.map(stripAnsi).join('\r\n');
    //                 const error = localize.DataScience.jupyterGetVariablesExecutionError().format(stripped);
    //                 traceError(error);
    //                 throw new Error(error);
    //             }
    //         }
    //     }

    //     throw new Error(localize.DataScience.jupyterGetVariablesBadResults());
    // }
}
