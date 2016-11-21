import * as vscode from 'vscode';

export class StatusBar implements vscode.Disposable {
    private disposables: vscode.Disposable[];
    private statusBar: vscode.StatusBarItem;

    constructor() {
        this.disposables = [];
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.disposables.push(this.statusBar);
        this.statusBar.hide();
        vscode.workspace.onDidChangeConfiguration(this.onConfigurationChanged.bind(this));
    }

    private onConfigurationChanged() {
        this.displayStandardMessage();
    }

    private displayStandardMessage() {
        this.clearProgressTicker();
        this.statusBar.hide();

        this.statusBar.text = '$(sync) Symbols';
        this.statusBar.tooltip = 'Python Workspace Symbol Provider';
        this.statusBar.command = 'symbols.showOptions';
        this.statusBar.show();
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private progressCounter = 0;
    private ticker = ['|', '/', '-', '|', '/', '-', '\\'];
    private progressTimeout;
    private progressPrefix: string;

    public displayProgress(promise: Promise<any>, message: string, tooltip?: string, command?: string) {
        this.progressPrefix = this.statusBar.text = message;
        this.statusBar.command = command ? command : '';
        this.statusBar.tooltip = tooltip ? tooltip : '';
        this.statusBar.show();
        this.clearProgressTicker();
        this.progressTimeout = setInterval(() => this.updateProgressTicker(), 150);

        promise.then(value => {
            this.displayStandardMessage();
            return value;
        }).catch(reason => {
            this.displayStandardMessage();
            return Promise.reject(reason);
        });
    }
    private updateProgressTicker() {
        let text = `${this.progressPrefix} ${this.ticker[this.progressCounter % 7]}`;
        this.progressCounter += 1;
        this.statusBar.text = text;
    }
    private clearProgressTicker() {
        if (this.progressTimeout) {
            clearInterval(this.progressTimeout);
        }
        this.progressTimeout = null;
        this.progressCounter = 0;
    }
}
