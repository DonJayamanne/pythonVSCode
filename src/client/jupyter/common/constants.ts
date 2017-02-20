
export const PythonLanguage = { language: 'python', scheme: 'file' };

export namespace Commands {
    export namespace Jupyter {
        export const Get_All_KernelSpecs_For_Language = 'jupyter.getAllKernelSpecsForLanguage';
        export const Get_All_KernelSpecs = 'jupyter.getAllKernelSpecs';
        export const Kernel_Options = 'jupyter.kernelOptions';
        export const StartKernelForKernelSpeck = 'jupyter.sartKernelForKernelSpecs';
        export const ExecuteRangeInKernel = 'jupyter.execRangeInKernel';
        export const ExecuteSelectionOrLineInKernel = 'jupyter.runSelectionLine';
        export namespace Cell {
            export const ExecuteCurrentCell = 'jupyter.execCurrentCell';
            export const ExecuteCurrentCellAndAdvance = 'jupyter.execCurrentCellAndAdvance';
            export const AdcanceToCell = 'jupyter.advanceToNextCell';
            export const DisplayCellMenu = 'jupyter.displayCellMenu';
            export const GoToPreviousCell = 'jupyter.gotToPreviousCell';
            export const GoToNextCell = 'jupyter.gotToNextCell';
        }
        export namespace Kernel {
            export const Select = 'jupyter.selectKernel';
            export const Interrupt = 'jupyter.kernelInterrupt';
            export const Restart = 'jupyter.kernelRestart';
            export const Shutdown = 'jupyter.kernelShutDown';
            export const Details = 'jupyter.kernelDetails';
        }
        export namespace Notebook {
            export const ShutDown = 'jupyter.shutdown';
        }
    }
}