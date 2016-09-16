import * as vscode from 'vscode';
import {KernelspecMetadata} from '../contracts';
import {Commands} from '../../common/constants';

export class KernelPicker extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    constructor() {
        super(() => { });
        this.disposables = [];
        this.registerCommands();
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Select_Kernel, this.selectkernel.bind(this)));
    }

    private selectkernel(language?: string): Promise<KernelspecMetadata> {
        return new Promise<KernelspecMetadata>(resolve => {
            const command = language ? Commands.Jupyter.Get_All_KernelSpecs_For_Language : Commands.Jupyter.Get_All_KernelSpecs;
            vscode.commands.executeCommand(command, language).then((kernelSpecs: KernelspecMetadata[]) => {
                if (kernelSpecs.length === 0) {
                    return resolve();
                }
                this.displayKernelPicker(kernelSpecs).then(resolve);
            });
        });
    }
    private displayKernelPicker(kernelspecs: KernelspecMetadata[]): Promise<KernelspecMetadata> {
        const items = kernelspecs.map(spec => {
            return {
                label: spec.display_name,
                description: spec.language,
                kernelspec: spec
            };
        });
        return new Promise<KernelspecMetadata>(resolve => {
            vscode.window.showQuickPick(items, { placeHolder: 'Select a Kernel' }).then(item => {
                if (item) {
                    resolve(item.kernelspec);
                }
                else {
                    resolve();
                }
            });
        });
    }
}