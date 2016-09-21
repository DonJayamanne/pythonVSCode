import * as vscode from 'vscode';
import {KernelPicker} from './kernelPicker';
import {Commands} from '../../common/constants';
import {KernelspecMetadata} from '../contracts';
import {TextDocumentContentProvider} from './resultView';
import {Server} from '../server/main';
import {CellOptions} from './cellOptions';
import {JupyterCodeLensProvider} from '../editorIntegration/codeLensProvider';
import {JupyterCellHighlightProvider} from '../editorIntegration/cellHighlightProvider';

const jupyterSchema = 'jupyter-result-viewer';
const previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

export class JupyterDisplay extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private previewWindow: TextDocumentContentProvider;
    private server: Server;
    private cellOptions: CellOptions;
    constructor(cellCodeLenses: JupyterCodeLensProvider, cellHighlightProvider: JupyterCellHighlightProvider) {
        super(() => { });
        this.disposables = [];
        this.disposables.push(new KernelPicker());
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel_Options, this.showKernelOptions.bind(this)));
        this.server = new Server();
        this.disposables.push(this.server);
        this.previewWindow = new TextDocumentContentProvider();
        this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(jupyterSchema, this.previewWindow));
        this.cellOptions = new CellOptions(cellCodeLenses, cellHighlightProvider);
        this.disposables.push(this.cellOptions);
    }

    private displayed = false;
    public showResults(result: string, data: any): Promise<any> {
        return this.server.start().then(port => {
            this.previewWindow.ServerPort = port;
            this.previewWindow.setText(result, data);
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