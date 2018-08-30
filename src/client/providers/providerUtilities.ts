// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { Tokenizer } from '../language/tokenizer';
import { ITextRangeCollection, IToken, TokenizerMode, TokenType } from '../language/types';

export function getDocumentTokens(document: vscode.TextDocument, tokenizeTo: vscode.Position, mode: TokenizerMode): ITextRangeCollection<IToken> {
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), tokenizeTo));
    return new Tokenizer().tokenize(text, 0, text.length, mode);
}

export function isPositionInsideStringOrComment(document: vscode.TextDocument, position: vscode.Position): boolean {
    const tokenizeTo = position.translate(1, 0);
    const tokens = getDocumentTokens(document, tokenizeTo, TokenizerMode.CommentsAndStrings);
    const offset = document.offsetAt(position);
    let index = tokens.getItemContaining(offset);
    if (index >= 0) {
        const token = tokens.getItemAt(index);
        return token.type === TokenType.String || token.type === TokenType.Comment;
    }
    if (offset > 0) {
        // In case position is at the every end of the comment or unterminated string
        index = tokens.getItemContaining(offset - 1);
        if (index >= 0) {
            const token = tokens.getItemAt(index);
            return token.end === offset && token.type === TokenType.Comment;
        }
    }
    return false;
}
