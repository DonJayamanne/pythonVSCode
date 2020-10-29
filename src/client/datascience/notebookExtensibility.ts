import { injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import type { NotebookCell } from '../../../types/vscode-proposed';
import { noop } from '../common/utils/misc';
import { ICell, INotebookExecutionLogger, INotebookExtensibility } from './types';
import { translateCellToNative } from './utils';

export type KernelStateEventArgs = {
    resource: Uri;
    state: KernelState;
    cell?: NotebookCell;
};

enum KernelState {
    started,
    executed,
    restarted
}

@injectable()
export class NotebookExtensibility implements INotebookExecutionLogger, INotebookExtensibility {
    private kernelStateChange = new EventEmitter<KernelStateEventArgs>();

    public dispose() {
        noop();
    }

    public async preExecute(): Promise<void> {
        noop();
    }
    public async postExecute(cell: ICell, _silent: boolean, language: string, resource: Uri): Promise<void> {
        const nbCell = translateCellToNative(cell, language);
        if (nbCell && nbCell.code.length > 0) {
            this.kernelStateChange.fire({
                resource,
                state: KernelState.executed,
                cell: nbCell as NotebookCell
            });
        }
    }
    public onKernelStarted(resource: Uri): void {
        this.kernelStateChange.fire({
            resource,
            state: KernelState.started
        });
    }
    public onKernelRestarted(resource: Uri): void {
        this.kernelStateChange.fire({
            resource,
            state: KernelState.restarted
        });
    }

    public get onKernelStateChange(): Event<KernelStateEventArgs> {
        return this.kernelStateChange.event;
    }
}
