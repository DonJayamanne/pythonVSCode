'use strict';

import {CodeLensProvider, TextDocument, CancellationToken, CodeLens, Command} from 'vscode';
import * as telemetryContracts from '../../common/telemetryContracts';
import {Commands} from '../../common/constants';
import {CellHelper} from '../common/cells';

export class JupyterCodeLensProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument, token: CancellationToken): Thenable<CodeLens[]> {
        const cells = CellHelper.getCells(document);
        if (cells.length === 0) {
            return Promise.resolve([]);
        }

        const lenses = cells.map(cell => {
            const cmd: Command = {
                arguments: [cell.range],
                title: 'Run Cell',
                command: Commands.Jupyter.ExecuteRangeInKernel
            };
            return new CodeLens(cell.range, cmd);
        });

        return Promise.resolve(lenses);
    }
}