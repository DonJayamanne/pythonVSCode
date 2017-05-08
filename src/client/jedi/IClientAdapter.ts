"use strict";

import { TextDocument, Position, CancellationToken } from 'vscode';
import { CompletionItem, Definition, Hover, ReferenceContext, Location, SignatureHelp, SymbolInformation } from 'vscode';

export interface IClientAdapter {
    getCompletions(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<CompletionItem[]>;
    getDefinition(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<Definition>;
    getHoverDefinition(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<Hover>;
    getReferences(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<Location[]>;
    getSignature(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<SignatureHelp>;
    getDocumentSymbols(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<SymbolInformation[]>;
}
