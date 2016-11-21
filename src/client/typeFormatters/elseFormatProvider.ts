import { FormattingOptions, TextEdit, TextDocument } from 'vscode';
import { Position, Range } from 'vscode';
import { CodeBlockFormatProvider, BlockRegEx } from './contracts';
import { IF_REGEX, ELIF_REGEX, ELSE_REGEX, FOR_IN_REGEX, ASYNC_FOR_IN_REGEX, WHILE_REGEX } from './contracts';
import { DEF_REGEX, ASYNC_DEF_REGEX, CLASS_REGEX } from './contracts';

export class ElseFormatProvider implements CodeBlockFormatProvider {
    private regExps: BlockRegEx[];
    private boundaryRegExps: BlockRegEx[];
    constructor() {
        this.regExps = [
            IF_REGEX,
            ELIF_REGEX,
            FOR_IN_REGEX,
            ASYNC_FOR_IN_REGEX,
            WHILE_REGEX
        ];
        this.boundaryRegExps = [
            DEF_REGEX,
            ASYNC_DEF_REGEX,
            CLASS_REGEX
        ];
    }
    canProvideEdits(line: string): boolean {
        return ELSE_REGEX.test(line);
    }

    provideEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, line: string): TextEdit[] {
        // We can have else for the following blocks:
        // if:
        // elif x:
        // for x in y:
        // while x:

        const indexOfElse = line.indexOf(ELSE_REGEX.startWord);

        // We need to find a block statement that is less than or equal to this statement block (but not greater)
        for (let lineNumber = position.line - 1; lineNumber > 0; lineNumber--) {
            const line = document.lineAt(lineNumber).text;

            // Oops, we've reached a boundary (like the function or class definition)
            // Get out of here
            if (this.boundaryRegExps.some(value => value.test(line))) {
                return [];
            }

            const blockRegEx = this.regExps.find(value => value.test(line));
            if (!blockRegEx) {
                continue;
            }

            const startOfBlockInLine = line.indexOf(blockRegEx.startWord);
            if (startOfBlockInLine > indexOfElse) {
                continue;
            }

            const startPosition = new Position(position.line, 0);
            const endPosition = new Position(position.line, indexOfElse - startOfBlockInLine);
            return [
                TextEdit.delete(new Range(startPosition, endPosition))
            ];
        }

        return [];
    }
}