import { Definition, Location, Range, Uri } from 'vscode';
import * as proxy from '../../providers/jediProxy';
export class DefinitionParser {
    public static parse(data: proxy.IDefinitionResult, possibleWord: string): Definition {
        if (!data || !Array.isArray(data.definitions) || data.definitions.length === 0) {
            return null;
        }
        const definitions = data.definitions.filter(d => d.text === possibleWord);
        const definition = definitions.length > 0 ? definitions[0] : data.definitions[data.definitions.length - 1];
        const definitionResource = Uri.file(definition.fileName);
        const range = new Range(
            definition.range.startLine, definition.range.startColumn,
            definition.range.endLine, definition.range.endColumn);
        return new Location(definitionResource, range);
    }
}