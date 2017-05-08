import { SymbolInformation, TextDocument, Range, Uri, Location } from 'vscode';
import * as proxy from "../../providers/jediProxy";
export class SymbolInformationParser {
    public static parse(data: proxy.ISymbolResult, document: TextDocument): SymbolInformation[] {
        if (!data || !Array.isArray(data.definitions) || data.definitions.length === 0) {
            return [];
        }
        let symbols = data.definitions.filter(sym => sym.fileName === document.fileName);
        return symbols.map(sym => {
            const symbol = sym.kind;
            const range = new Range(
                sym.range.startLine, sym.range.startColumn,
                sym.range.endLine, sym.range.endColumn);
            const uri = Uri.file(sym.fileName);
            const location = new Location(uri, range);
            return new SymbolInformation(sym.text, symbol, sym.container, location);
        });
    }
}