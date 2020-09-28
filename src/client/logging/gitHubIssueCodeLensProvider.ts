import { inject, injectable } from 'inversify';
import { CancellationToken, CodeLens, languages, Position, Range, TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { GITHUB_ISSUE_MARKDOWN_FILE } from '../common/constants';
import { IExtensionContext } from '../common/types';
import { GitHubIssue } from '../common/utils/localize';
import { Commands } from '../datascience/constants';
import { generateCommand } from '../datascience/editor-integration/codeLensFactory';

@injectable()
export class GitHubIssueCodeLensProvider implements IExtensionSingleActivationService {
    constructor(@inject(IExtensionContext) private extensionContext: IExtensionContext) {}

    public async activate() {
        this.extensionContext.subscriptions.push(languages.registerCodeLensProvider(GITHUB_ISSUE_MARKDOWN_FILE, this));
    }

    public provideCodeLenses(document: TextDocument, _token: CancellationToken): CodeLens[] {
        const command = generateCommand(Commands.SubmitGitHubIssue, GitHubIssue.submitGitHubIssue());
        const codelenses: CodeLens[] = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            const line = document.lineAt(index);
            if (line.text.startsWith('<details>')) {
                break;
            }
            if (line.text.startsWith('# ')) {
                const range = new Range(new Position(line.lineNumber, 0), new Position(line.lineNumber, 1));
                codelenses.push(new CodeLens(range, command));
            }
        }
        return codelenses;
    }
}
