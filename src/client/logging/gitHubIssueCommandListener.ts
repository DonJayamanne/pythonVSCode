import { Octokit } from '@octokit/rest';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import {
    authentication,
    Diagnostic,
    DiagnosticCollection,
    env,
    languages,
    Position,
    Range,
    TextDocument,
    Uri,
    window,
    workspace,
    WorkspaceEdit
} from 'vscode';
import { IApplicationEnvironment, IApplicationShell, ICommandManager } from '../common/application/types';
import { MARKDOWN_LANGUAGE } from '../common/constants';
import { traceError } from '../common/logger';
import { IPlatformService } from '../common/platform/types';
import { IDisposableRegistry, IExtensionContext, IPathUtils } from '../common/types';
import { GitHubIssue } from '../common/utils/localize';
import { Commands } from '../datascience/constants';
import {
    IDataScienceCommandListener,
    IDataScienceFileSystem,
    IInteractiveWindowProvider,
    INotebookProvider
} from '../datascience/types';
import { IInterpreterService } from '../interpreter/contracts';

@injectable()
export class GitHubIssueCommandListener implements IDataScienceCommandListener {
    private logfilePath: string;
    private issueFilePath: Uri | undefined;
    private issueTextDocument: TextDocument | undefined;
    private diagnosticCollection: DiagnosticCollection;
    constructor(
        @inject(IDataScienceFileSystem) private filesystem: IDataScienceFileSystem,
        @inject(IPathUtils) private pathUtils: IPathUtils,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IApplicationEnvironment) private applicationEnvironment: IApplicationEnvironment,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IExtensionContext) private extensionContext: IExtensionContext,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider
    ) {
        this.logfilePath = path.join(this.extensionContext.globalStoragePath, 'log.txt');
        this.diagnosticCollection = languages.createDiagnosticCollection(MARKDOWN_LANGUAGE);
    }
    public register(commandManager: ICommandManager): void {
        this.disposableRegistry.push(
            ...[
                commandManager.registerCommand(Commands.CreateGitHubIssue, this.createGitHubIssue, this),
                commandManager.registerCommand(Commands.SubmitGitHubIssue, this.submitGitHubIssue, this)
            ]
        );
    }
    private async createGitHubIssue() {
        try {
            const pleaseFillThisOut = GitHubIssue.pleaseFillThisOut();
            const formatted = `# Steps to cause the bug to occur
1. <!-- ${pleaseFillThisOut} -->

# Actual behavior
<!-- ${pleaseFillThisOut} -->

# Expected behavior
<!-- ${pleaseFillThisOut} -->

# Your Jupyter environment
Active Python interpreter: ${(await this.interpreterService.getActiveInterpreter(undefined))?.displayName}
Number of interactive windows: ${this.interactiveWindowProvider?.windows?.length}
Number of Jupyter notebooks: ${this.notebookProvider?.activeNotebooks?.length}
Jupyter notebook type: ${this.notebookProvider?.type}
Extension version: ${this.applicationEnvironment?.packageJson?.version}
VS Code version: ${this.applicationEnvironment?.vscodeVersion}
OS: ${this.platformService.osType} ${(await this.platformService?.getVersion())?.version}

<details>

${'```'}
${await this.getRedactedLogs()}
${'```'}
</details>`;

            // Create and open an untitled file with our issue template
            this.issueFilePath = Uri.file('issue.md').with({
                scheme: 'untitled'
            });
            this.issueTextDocument = await workspace.openTextDocument(this.issueFilePath);
            const edit = new WorkspaceEdit();
            edit.insert(this.issueFilePath, new Position(0, 0), formatted);
            await workspace.applyEdit(edit);
            this.commandManager.executeCommand('vscode.open', this.issueFilePath);
        } catch (err) {
            traceError(err);
        }
    }

    // After the user has reviewed the contents, submit the issue on their behalf
    private async submitGitHubIssue() {
        const editors = window.visibleTextEditors.filter(
            (e) => e.document.uri.toString() === this.issueFilePath?.toString()
        );
        if (editors.length === 1) {
            const editor = editors[0];
            const content = editor.document.getText();
            try {
                await this.validateBodyAndSubmit(content, editor.document);
            } catch (err) {
                traceError(err);
                await this.copyIssueContentsAndOpenGitHub(content);
            }
        }
    }

    private async validateBodyAndSubmit(content: string, document: TextDocument) {
        const problems = this.displayErrors(document);
        if (problems.length > 0) {
            await this.appShell.showErrorMessage(GitHubIssue.missingFields());
        } else {
            await this.submitForUser(content);
        }
    }

    private displayErrors(document: TextDocument) {
        this.diagnosticCollection.clear();
        const pleaseFillThisOut = GitHubIssue.pleaseFillThisOut();
        const diagnostics = [];

        for (let index = 0; index < document.lineCount; index += 1) {
            const line = document.lineAt(index);
            const matchIndex = line.text.search(pleaseFillThisOut);
            if (matchIndex !== -1) {
                const start = new Position(line.lineNumber, matchIndex);
                const end = new Position(line.lineNumber, matchIndex + pleaseFillThisOut.length);
                const range = new Range(start, end);
                diagnostics.push(new Diagnostic(range, pleaseFillThisOut));
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
        return diagnostics;
    }

    private async submitForUser(body: string) {
        const title = await window.showInputBox({
            ignoreFocusOut: true,
            prompt: GitHubIssue.askForIssueTitle(),
            placeHolder: GitHubIssue.titlePlaceholder()
        });
        const authSession = await authentication.getSession('github', ['repo'], { createIfNone: true });
        if (authSession) {
            const octokit = new Octokit({ auth: authSession.accessToken });
            const response = await octokit.issues.create({
                owner: 'microsoft',
                repo: 'vscode-jupyter',
                title: title ? title : 'Bug report',
                body
            });
            if (response?.data?.html_url) {
                await env.openExternal(Uri.parse(response.data.html_url));
                this.closeIssueEditorOnSuccess();
            }
        }
    }

    private closeIssueEditorOnSuccess() {
        if (window.activeTextEditor?.document === this.issueTextDocument) {
            this.commandManager.executeCommand('workbench.action.closeActiveEditor');
        }
    }

    private async copyIssueContentsAndOpenGitHub(issueBody: string) {
        const prompt = GitHubIssue.copyContentToClipboardAndOpenIssue();
        const selection = await this.appShell.showErrorMessage(GitHubIssue.failure(), ...[prompt]);
        if (selection === prompt) {
            await env.clipboard.writeText(issueBody);
            await env.openExternal(Uri.parse('https://github.com/microsoft/vscode-jupyter/issues/new'));
            this.closeIssueEditorOnSuccess();
        }
    }

    private async getRedactedLogs() {
        const pathComponents = this.pathUtils.home.split(this.pathUtils.separator);
        const username = pathComponents[pathComponents.length - 1];
        const re = RegExp(username, 'gi');
        return (await this.filesystem.readLocalFile(this.logfilePath)).replace(re, '[redacted]');
    }
}
