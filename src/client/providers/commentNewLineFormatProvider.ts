import { OnTypeFormattingEditProvider, TextEdit, TextDocument, FormattingOptions, CancellationToken, Position } from 'vscode';

export class CommentNewLineFormatProvider implements OnTypeFormattingEditProvider {
    provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string,
        options: FormattingOptions, token: CancellationToken): TextEdit[] {

        if (position.line === 0) {
            return [];
        }
        const previousLine = document.lineAt(position.line - 1).text;
        const trimmedLine = previousLine.trim();
        if (!trimmedLine.startsWith('#') || document.lineAt(position.line).text.trim().length === 0) {
            return [];
        }
        const index = previousLine.indexOf('#');
        const leftOvers = previousLine.substring(index + 1).trim();
        const additionalSpaces = previousLine.indexOf(leftOvers) - index - 1;
        const spaces = Array(additionalSpaces).fill(' ');
        return [
            TextEdit.insert(position, "#" + spaces.join(''))
        ];
    }
}