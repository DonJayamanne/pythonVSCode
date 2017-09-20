import { OnTypeFormattingEditProvider, FormattingOptions, TextEdit, CancellationToken, TextDocument } from 'vscode';
import { Position, Range, TextLine } from 'vscode';

export class LineContinuationFormatProvider implements OnTypeFormattingEditProvider {
    private matchStatementContinuation: RegExp;
    private matchClosingBracket: RegExp;
    private matchClosingParenColon: RegExp;
    private matchHangingCont: RegExp;
    private matchAlignedCont: RegExp;

    constructor() {
        this.matchClosingBracket = new RegExp(/^.*?(?:\)|\]|\})\s*$/);
        this.matchClosingParenColon = new RegExp(/^.*?\):\s*$/);
        this.matchStatementContinuation = new RegExp(/^.*?(?:\(|\[|\{|\\|\,|\+|\-|\*|\/)\s*$/);
        this.matchHangingCont = new RegExp(/^.*?(?:\(|\[|\{)\s*$/);
        this.matchAlignedCont = new RegExp(/^.*?(\(|\[|\{).*?(?:\,|\\|\+|\-|\*|\/)\s*$/);
    }

    findLastStatementLine(document: TextDocument, startLine: TextLine): TextLine {
        // To find the last statement we look upwards for line continuation char
        // We use the indent level of the last line containing a line continuation char
        // We stop as soon as we don't find a line continuation
        // Matched end of line chars in statements: "([{,\"
        // These are the correct characters which can be at the end of a line that
        // trigger a legal new line. Additionally, there is constructs like "(a + b + \n c"
        // which are also legal, but only if the parentheses exist, these are harder to catch
        // without having false negatives etc. To simplify, simply also add these characters
        // to the list of legal line continuation characters.
        // Total list of master end of line chars: "([{,\+-/*"
        for (let ln = startLine.lineNumber - 1; ln >= 1; ln--) {
            // If one line above above does not match line continuation char, we check two above
            // if that one matches, we know that the statement has not ended and continue
            // Full breakdown:
            // If one == no lcc and two == no lcc, one is a single line statement (our searched line, break)
            // If one == no lcc and two == lcc, one is end of statement (our searched statement, but not correct line), continue upwards
            // If one == lcc and two == no lcc, one is start of statement (our searched line, break)
            // If one == lcc and two == lcc, one and two are part of our statement, but we continue upwards
            // We can shorten this down to if two == no lcc then we break, in all other cases we continue upwards
            const twoAbove = document.lineAt(ln - 1).text;
            this.matchStatementContinuation.lastIndex = -1;
            const matchTwo = this.matchStatementContinuation.test(twoAbove);
            if (!matchTwo) {
                return document.lineAt(ln);
            }
        }
        return startLine;
    }

    setIndentTo(line: number, curFirstNonWhite: number, tarFirstNonWhite: number) : TextEdit[] {
        // TODO: Add support for tabs
        // TODO: Fix the issue of not moving cursor with indent if cursor is set to pos 0 after newline
        if (tarFirstNonWhite < curFirstNonWhite) {
            const startPosition = new Position(line, 0);
            const endPosition = new Position(line, curFirstNonWhite - tarFirstNonWhite);
            return [
                TextEdit.delete(new Range(startPosition, endPosition))
            ];
        }
        else if (tarFirstNonWhite > curFirstNonWhite) {
            const startPosition = new Position(line, 0);
            const toInsert = " ".repeat(tarFirstNonWhite - curFirstNonWhite);
            return [
                TextEdit.insert(startPosition, toInsert)
            ];
        }
        return [];
    }

    provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): TextEdit[] {
        // Provides formatting for variations of the following cases:
        // fncall(a, b, c) # Want to break after a
        // This is the previous result:
        // fncall(a,
        // b, c)
        // New result:
        // fncall(a,
        //        b, c)
        // It also should return to correct indent level if entering at end of line e.g.
        // fncall(a,
        //        b, c)| # Press enter with cursor at |
        //        | # Where the cursor previously would be placed
        // | # Where the cursor now is placed
        // Total function overview:
        // 1. Find the line of the last "statement" to determine indentation level
        // 2. Adjust indentation if the last statement was a def or class
        // 3. If newline is directly after "({[" do hanging continuation
        // 4. If newline is inside multiple params do aligned continuation
        if (position.line === 0) {
            return [];
        }

        const currentLine = document.lineAt(position.line);
        const previousLine = document.lineAt(position.line - 1);
        const previousLineText = previousLine.text;

        // Find the last statement, this will determine our indent level
        const lastStatementLine = this.findLastStatementLine(document, currentLine);

        // Rectify correct indentation if we use after closing bracket ")" and "):"
        // Since we used enter, we are on the next line, so we should test against previous line
        // Normal closing bracket/paren/brace:
        this.matchClosingBracket.lastIndex = -1;
        if (this.matchClosingBracket.test(previousLineText)) {
            // Match our indent
            return this.setIndentTo(position.line,
                currentLine.firstNonWhitespaceCharacterIndex,
                lastStatementLine.firstNonWhitespaceCharacterIndex
            );
        }
        // Closing paren followed by ":", add one indent level
        this.matchClosingParenColon.lastIndex = -1;
        if (this.matchClosingParenColon.test(previousLineText)) {
            // Add an extra indent because of the colon
            return this.setIndentTo(position.line,
                currentLine.firstNonWhitespaceCharacterIndex,
                lastStatementLine.firstNonWhitespaceCharacterIndex + options.tabSize
            );
        }

        // Adjust correct indentation patterns for multiline continuations
        // Does not work correctly for nested indent levels
        // Hanging indents
        const lastStatementLineText = lastStatementLine.text;
        this.matchHangingCont.lastIndex = -1;
        if (this.matchHangingCont.test(lastStatementLineText)) {
            return this.setIndentTo(position.line,
                currentLine.firstNonWhitespaceCharacterIndex,
                lastStatementLine.firstNonWhitespaceCharacterIndex + options.tabSize
            )
        }

        // Aligned continuation
        this.matchAlignedCont.lastIndex = -1;
        const matched = this.matchAlignedCont[Symbol.match](lastStatementLineText);
        if (matched) {
            return this.setIndentTo(position.line,
                currentLine.firstNonWhitespaceCharacterIndex,
                lastStatementLineText.indexOf(matched[1]) + 1
            )
        }

        return [];
    }
}
