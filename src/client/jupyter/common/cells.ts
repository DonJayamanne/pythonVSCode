import {Cell} from '../contracts';
import {TextDocument, Range} from 'vscode';

const CellIdentifier = /^(# %%|#%%|# \<codecell\>|# In\[\d?\]|# In\[ \])(.*)/i;

export class CellHelper {
    constructor() {

    }

    public static getCells(document: TextDocument): Cell[] {
        const cells: Cell[] = [];
        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);
            if (CellIdentifier.test(line.text)) {
                const results = CellIdentifier.exec(line.text);
                if (cells.length > 0) {
                    const previousCell = cells[cells.length - 1];
                    previousCell.range = new Range(previousCell.range.start, document.lineAt(index - 1).range.end);
                }
                cells.push({
                    range: line.range,
                    title: results.length > 1 ? results[2].trim() : ''
                });
            }

            if (index > 0 && index === document.lineCount - 1) {
                const previousCell = cells[cells.length - 1];
                previousCell.range = new Range(previousCell.range.start, line.range.end);
            }
        }
        return cells;
    }
}