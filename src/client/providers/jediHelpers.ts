import * as proxy from './jediProxy';
import { EOL } from 'os';
import * as vscode from 'vscode';

export function extractSignatureAndDocumentation(definition: proxy.IAutoCompleteItem, highlightCode: boolean = false): [string, string] {
    // Somtimes the signature of the function, class (whatever) is broken into multiple lines
    // Here's an example
    // ```python
    // def __init__(self, group=None, target=None, name=None,
    //              args=(), kwargs=None, verbose=None):
    //     """This constructor should always be called with keyword arguments. Arguments are:

    //     *group* should be None; reserved for future extension when a ThreadGroup
    //     class is implemented.
    ///    """
    /// ```
    const txt = definition.description || definition.text;
    const rawDocString = typeof definition.raw_docstring === 'string' ? definition.raw_docstring.trim() : '';
    const firstLineOfRawDocString = rawDocString.length > 0 ? rawDocString.split(EOL)[0] : '';
    let lines = txt.split(EOL);
    const startIndexOfDocString = firstLineOfRawDocString === '' ? -1 : lines.findIndex(line => line.indexOf(firstLineOfRawDocString) === 0);

    let signatureLines = startIndexOfDocString === -1 ? [lines.shift()] : lines.splice(0, startIndexOfDocString);
    let signature = signatureLines.filter(line => line.trim().length > 0).join(EOL);

    switch (definition.type) {
        case vscode.CompletionItemKind.Constructor:
        case vscode.CompletionItemKind.Function:
        case vscode.CompletionItemKind.Method: {
            signature = 'def ' + signature;
            break;
        }
        case vscode.CompletionItemKind.Class: {
            signature = 'class ' + signature;
            break;
        }
    }

    // check if we have any sample code in the documentation
    if (highlightCode) {
        lines = lines.map(line => {
            if (line.trim().startsWith('>>> ')) {
                return '```python\n' + line.substring(4).trim() + '\n```';
            }
            return line;
        });
    }
    return [signature, lines.join(EOL).trim().replace(/^\s+|\s+$/g, '').trim()];
}

export function extractHoverInfo(definition: proxy.IAutoCompleteItem): vscode.Hover {
    const parts = extractSignatureAndDocumentation(definition, true);
    const hoverInfo: vscode.MarkedString[] = parts[0].length === 0 ? [] : [{ language: 'python', value: parts[0] }];
    if (parts[1].length > 0) {
        hoverInfo.push(parts[1]);
    }
    return new vscode.Hover(hoverInfo);
}