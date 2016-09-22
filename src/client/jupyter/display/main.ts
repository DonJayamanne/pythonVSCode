import * as vscode from 'vscode';
import {KernelPicker} from './kernelPicker';
import {Commands} from '../../common/constants';
import {KernelspecMetadata} from '../contracts';
import {TextDocumentContentProvider} from './resultView';
import {CellOptions} from './cellOptions';
import {JupyterCodeLensProvider} from '../editorIntegration/codeLensProvider';
import {JupyterCellHighlightProvider} from '../editorIntegration/cellHighlightProvider';
import {Server} from './server';

const jupyterSchema = 'jupyter-result-viewer';
const previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

export class JupyterDisplay extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private previewWindow: TextDocumentContentProvider;
    private cellOptions: CellOptions;
    private server: Server;
    constructor(cellCodeLenses: JupyterCodeLensProvider, cellHighlightProvider: JupyterCellHighlightProvider) {
        super(() => { });
        this.disposables = [];
        this.server = new Server();
        this.disposables.push(this.server);
        this.disposables.push(new KernelPicker());
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel_Options, this.showKernelOptions.bind(this)));
        this.previewWindow = new TextDocumentContentProvider();
        this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(jupyterSchema, this.previewWindow));
        this.cellOptions = new CellOptions(cellCodeLenses, cellHighlightProvider);
        this.disposables.push(this.cellOptions);
        this.server.on('appendResults', appendType => {
            this.appendResults = appendType === 'append';
        });
    }

    private displayed = false;
    private appendResults = false;
    public showResults(result: string, data: any): Thenable<any> {
        return this.server.start().then(port => {
            this.previewWindow.ServerPort = port;
            // If we need to append the results, then do so if we have any result windows open
            let sendDataToResultView = Promise.resolve(false);
            if (this.appendResults) {
                sendDataToResultView = this.server.clientsConnected(2000);
            }
            return sendDataToResultView.then(clientConnected => {
                if (clientConnected) {
                    return this.server.sendResults(data);
                }
                this.previewWindow.setText(result, data);
                this.previewWindow.AppendResults = this.appendResults;
                // Dirty hack to support instances when document has been closed
                if (this.displayed) {
                    this.previewWindow.update();
                }
                this.displayed = true;
                return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Results')
                    .then(() => {
                        // Do nothing
                    }, reason => {
                        vscode.window.showErrorMessage(reason);
                    });
            });
        });
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private showKernelOptions(selectedKernel: KernelspecMetadata) {
        let description = '';
        if (selectedKernel.display_name.toLowerCase().indexOf(selectedKernel.language.toLowerCase()) === -1) {
            description = selectedKernel.language;
        }
        const options = [
            {
                label: `Interrupt ${selectedKernel.display_name} Kernel`,
                description: description,
                command: Commands.Jupyter.Kernel.Kernel_Interrupt,
                args: [selectedKernel]
            },
            {
                label: `Restart ${selectedKernel.display_name} Kernel`,
                description: description,
                command: Commands.Jupyter.Kernel.Kernel_Restart,
                args: [selectedKernel]
            },
            {
                label: `Shut Down ${selectedKernel.display_name} Kernel`,
                description: description,
                command: Commands.Jupyter.Kernel.Kernel_Shut_Down,
                args: [selectedKernel]
            },
            {
                label: ` `,
                description: ' ',
                command: '',
                args: []
            },
            {
                label: `Select another ${selectedKernel.language} Kernel`,
                description: ` `,
                command: Commands.Jupyter.Select_Kernel,
                args: [selectedKernel.language]
            }
        ];

        vscode.window.showQuickPick(options).then(option => {
            if (!option || !option.command || option.command.length === 0) {
                return;
            }
            vscode.commands.executeCommand(option.command, ...option.args);
        });
    }
}