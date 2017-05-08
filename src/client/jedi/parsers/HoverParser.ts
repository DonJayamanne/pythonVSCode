import { Hover, SymbolKind } from 'vscode';
import * as proxy from '../../providers/jediProxy';
import { highlightCode } from '../../providers/jediHelpers';
import { EOL } from 'os';
export class HoverParser {
    public static parse(data: proxy.IHoverResult, currentWord: string): Hover {
        let results = [];
        let capturedInfo: string[] = [];
        data.items.forEach(item => {
            let { signature } = item;
            switch (item.kind) {
                case SymbolKind.Constructor:
                case SymbolKind.Function:
                case SymbolKind.Method: {
                    signature = 'def ' + signature;
                    break;
                }
                case SymbolKind.Class: {
                    signature = 'class ' + signature;
                    break;
                }
                default: {
                    signature = typeof item.text === 'string' && item.text.length > 0 ? item.text : currentWord;
                }
            }
            if (item.docstring) {
                let lines = item.docstring.split(/\r?\n/);
                // If the docstring starts with the signature, then remove those lines from the docstring
                if (lines.length > 0 && item.signature.indexOf(lines[0]) === 0) {
                    lines.shift();
                    let endIndex = lines.findIndex(line => item.signature.endsWith(line));
                    if (endIndex >= 0) {
                        lines = lines.filter((line, index) => index > endIndex);
                    }
                }
                if (lines.length > 0 && item.signature.startsWith(currentWord) && lines[0].startsWith(currentWord) && lines[0].endsWith(')')) {
                    lines.shift();
                }
                let descriptionWithHighlightedCode = highlightCode(lines.join(EOL));
                let hoverInfo = ['```python', signature, '```', descriptionWithHighlightedCode].join(EOL);
                let key = signature + lines.join('');
                // Sometimes we have duplicate documentation, one with a period at the end
                if (capturedInfo.indexOf(key) >= 0 || capturedInfo.indexOf(key + '.') >= 0) {
                    return;
                }
                capturedInfo.push(key);
                capturedInfo.push(key + '.');
                results.push(hoverInfo);
                return;
            }
            if (item.description) {
                let descriptionWithHighlightedCode = highlightCode(item.description);
                let hoverInfo = '```python' + EOL + signature + EOL + '```' + EOL + descriptionWithHighlightedCode;
                let lines = item.description.split(EOL);
                let key = signature + lines.join('');
                // Sometimes we have duplicate documentation, one with a period at the end
                if (capturedInfo.indexOf(key) >= 0 || capturedInfo.indexOf(key + '.') >= 0) {
                    return;
                }
                capturedInfo.push(key);
                capturedInfo.push(key + '.');
                results.push(hoverInfo);
            }
        });
        return new Hover(results);
    }
}