"use strict";

import { TextDocument, Position, CancellationToken } from 'vscode';
import { CompletionItem, Definition, Hover, ReferenceContext, Location, SignatureHelp, SymbolInformation } from 'vscode';

export interface IClientAdapter {
    getCompletions(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionItem[]>;
    getDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition>;
    getHoverDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover>;
    getReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): Promise<Location[]>;
    getSignature(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp>;
    getDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[]>;
}
