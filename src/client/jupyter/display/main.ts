import * as vscode from 'vscode';
import {KernelPicker} from './kernelPicker';
import {Commands} from '../../common/constants';
import {KernelspecMetadata} from '../contracts';

export class JupyterDisplay extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    constructor() {
        super(() => { });
        this.disposables = [];
        this.disposables.push(new KernelPicker());
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel_Options, this.showKernelOptions.bind(this)));
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