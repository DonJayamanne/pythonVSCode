import { Location, Range, Uri } from 'vscode';
import * as proxy from '../../providers/jediProxy';
export class LocationParser {
    public static parse(data: proxy.IReferenceResult): Location[] {
        if (!data || !Array(data.references) || data.references.length === 0) {
            return [];
        }
        var references = data.references.filter(ref => {
            if (!ref || typeof ref.columnIndex !== 'number' || typeof ref.lineIndex !== 'number'
                || typeof ref.fileName !== 'string' || ref.columnIndex === -1 || ref.lineIndex === -1 || ref.fileName.length === 0) {
                return false;
            }
            return true;
        }).map(ref => {
            var definitionResource = Uri.file(ref.fileName);

            var range = new Range(ref.lineIndex, ref.columnIndex, ref.lineIndex, ref.columnIndex);
            return new Location(definitionResource, range);
        });

        return references;
    }
}
