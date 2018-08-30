// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { getUnicodeCategory, UnicodeCategory } from './unicode';

export function isIdentifierStartChar(ch: number) {
    switch (ch) {
        // Underscore is explicitly allowed to start an identifier
        case Char.Underscore:
            return true;
        // Characters with the Other_ID_Start property
        case 0x1885:
        case 0x1886:
        case 0x2118:
        case 0x212E:
        case 0x309B:
        case 0x309C:
            return true;
        default:
            break;
    }

    const cat = getUnicodeCategory(ch);
    switch (cat) {
        // Supported categories for starting an identifier
        case UnicodeCategory.UppercaseLetter:
        case UnicodeCategory.LowercaseLetter:
        case UnicodeCategory.TitlecaseLetter:
        case UnicodeCategory.ModifierLetter:
        case UnicodeCategory.OtherLetter:
        case UnicodeCategory.LetterNumber:
            return true;
        default:
            break;
    }
    return false;
}

export function isIdentifierChar(ch: number) {
    if (isIdentifierStartChar(ch)) {
        return true;
    }

    switch (ch) {
        // Characters with the Other_ID_Continue property
        case 0x00B7:
        case 0x0387:
        case 0x1369:
        case 0x136A:
        case 0x136B:
        case 0x136C:
        case 0x136D:
        case 0x136E:
        case 0x136F:
        case 0x1370:
        case 0x1371:
        case 0x19DA:
            return true;
        default:
            break;
    }

    switch (getUnicodeCategory(ch)) {
        // Supported categories for continuing an identifier
        case UnicodeCategory.NonSpacingMark:
        case UnicodeCategory.SpacingCombiningMark:
        case UnicodeCategory.DecimalDigitNumber:
        case UnicodeCategory.ConnectorPunctuation:
            return true;
        default:
            break;
    }
    return false;
}

export function isWhiteSpace(ch: number): boolean {
    return ch <= Char.Space || ch === 0x200B; // Unicode whitespace
}

export function isLineBreak(ch: number): boolean {
    return ch === Char.CarriageReturn || ch === Char.LineFeed;
}

export function isNumber(ch: number): boolean {
    return ch >= Char._0 && ch <= Char._9 || ch === Char.Underscore;
}

export function isDecimal(ch: number): boolean {
    return ch >= Char._0 && ch <= Char._9 || ch === Char.Underscore;
}

export function isHex(ch: number): boolean {
    return isDecimal(ch) || (ch >= Char.a && ch <= Char.f) || (ch >= Char.A && ch <= Char.F) || ch === Char.Underscore;
}

export function isOctal(ch: number): boolean {
    return ch >= Char._0 && ch <= Char._7 || ch === Char.Underscore;
}

export function isBinary(ch: number): boolean {
    return ch === Char._0 || ch === Char._1 || ch === Char.Underscore;
}
