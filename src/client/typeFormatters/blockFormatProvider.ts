import { OnTypeFormattingEditProvider, FormattingOptions, TextEdit, CancellationToken, TextDocument } from 'vscode';
import { Position } from 'vscode';
import { CodeBlockFormatProvider } from './contracts';
import { ElseFormatProvider } from './elseFormatProvider';

export class BlockFormatProviders implements OnTypeFormattingEditProvider {
    private providers: CodeBlockFormatProvider[];
    constructor() {
        this.providers = [];
        this.providers.push(new ElseFormatProvider());
    }
    provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): TextEdit[] {
        if (position.line === 0) {
            return [];
        }

        const currentLine = document.lineAt(position.line).text;
        const provider = this.providers.find(provider => provider.canProvideEdits(currentLine));
        if (provider) {
            return provider.provideEdits(document, position, ch, options, currentLine);
        }

        return [];
    }
}