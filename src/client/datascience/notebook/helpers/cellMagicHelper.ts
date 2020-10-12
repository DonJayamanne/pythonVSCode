// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils';
import { EOL } from 'os';
import { NotebookCell } from '../../../../../types/vscode-proposed';
import { NotebookCellMetadata } from '../../../../../typings/vscode-proposed';
import { concatMultilineString } from '../../../../datascience-ui/common';
import { PYTHON_LANGUAGE } from '../../../common/constants';

type CellTextProvider = (cell: NotebookCell) => string;
const cellTextProviders: { [key: string]: CellTextProvider } = {
    javascript: getCellTextForJs,
    perl: getCellTextForPerl,
    html: getCellTextForHtml,
    svg: getCellTextForSvg,
    xml: getCellTextForSvg,
    bash: getCellTextForBash,
    ruby: getCellTextForRuby,
    shellscript: getCellTextForSh
};

export function getCellTextForIPyKernelExecution(cell: NotebookCell): string {
    if (cell.language === PYTHON_LANGUAGE) {
        return cell.document.getText();
    }

    if (['plaintext', 'raw'].includes(cell.language.toLowerCase())) {
        return cell.document.getText();
    }

    // Treat the rest as scripts.
    const language = cell.language.toLowerCase();
    if (language in cellTextProviders) {
        return cellTextProviders[language](cell);
    }
    return cell.document.getText();
}

export function getCellCodeLanguageAndUpdateMetadata(cell: nbformat.IBaseCell, notebookCellMetadata: NotebookCellMetadata){
    let source = concatMultilineString(cell.source);
    const lines = source.splitLines();
    const firstLine = lines.length ? lines[0] : '';
    const map: [prefix: string, language: string][] = [
        ['%%js', 'javascript'],
        ['%%javascript', 'javascript'],
        ['%%sh', 'shellscript'],
        ['%%bash', 'shellscript'],
        ['%%html', 'html'],
        ['%%svg', 'xml'],
        ['%%perl', 'perl'],
        ['%%ruby', 'ruby']
    ];
    const languageInfo = map.find(item => firstLine.startsWith(item[0]));
    let language = PYTHON_LANGUAGE;
    if (languageInfo) {
        lines.shift();
        source = lines.join(EOL);
        language = languageInfo[1];

        // Keep track of the original cell Magic.
        notebookCellMetadata.custom!.vscode = notebookCellMetadata.custom?.vscode || {};
        notebookCellMetadata.custom!.vscode.transient = notebookCellMetadata.custom!.vscode.transient || {};
        notebookCellMetadata.custom!.vscode.transient.cellMagic = firstLine;
    }
    return {source, language};
}
export function getCellCodeForMagicCells(cell: NotebookCell): string {
    let code = cell.document.getText();
    let cellMagic = '';
    if (cell.language === PYTHON_LANGUAGE) {
        // Noop.
    } else if (cell.metadata.custom?.vscode?.transient?.cellMagic) {
        cellMagic = cell.metadata.custom?.vscode?.transient?.cellMagic;
    } else if (cell.language === 'html') {
        cellMagic = '%%html';
    } else if (cell.language === 'javascript') {
        cellMagic = '%%javascript';
    } else if (cell.language === 'shellscript') {
        cellMagic = '%%bash';
    } else if (cell.language === 'svg' || cell.language === 'xml') {
        cellMagic = '%%svg';
    } else if (cell.language === 'perl') {
        cellMagic = '%%perl';
    } else if (cell.language === 'ruby') {
        cellMagic = '%%ruby';
    }
    if (cellMagic) {
        code = `${cellMagic}${EOL}${code}`;
    }
    return code;
}
function getCellTextForJs(cell: NotebookCell): string {
    if (cell.metadata.custom?.vscode?.magicIsJs) {
        return `%%js${EOL}${cell.document.getText()}`;
    }
    return `%%javascript${EOL}${cell.document.getText()}`;
}
function getCellTextForPerl(cell: NotebookCell): string {
    return `%%perl${EOL}${cell.document.getText()}`;
}
function getCellTextForHtml(cell: NotebookCell): string {
    return `%%html${EOL}${cell.document.getText()}`;
}
function getCellTextForSvg(cell: NotebookCell): string {
    return `%%svg${EOL}${cell.document.getText()}`;
}
function getCellTextForBash(cell: NotebookCell): string {
    return `%%bash${EOL}${cell.document.getText()}`;
}
function getCellTextForRuby(cell: NotebookCell): string {
    return `%%ruby${EOL}${cell.document.getText()}`;
}
function getCellTextForSh(cell: NotebookCell): string {
    return `%%sh${EOL}${cell.document.getText()}`;
}
