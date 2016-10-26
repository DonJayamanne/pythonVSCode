import * as vscode from 'vscode';
import { Commands } from '../../common/constants';
import { JupyterCodeLensProvider } from '../editorIntegration/codeLensProvider';
import { CellHelper } from '../common/cellHelper';

export class CellOptions extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private cellHelper: CellHelper;
    constructor(private cellCodeLenses: JupyterCodeLensProvider) {
        super(() => { });
        this.cellHelper = new CellHelper(this.cellCodeLenses);
        this.disposables = [];
        this.registerCommands();
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Cell.DisplayCellMenu, this.displayCellOptions.bind(this)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Cell.AdcanceToCell, this.cellHelper.advanceToCell.bind(this.cellHelper)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Cell.ExecuteCurrentCell, this.executeCell.bind(this, false)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Cell.ExecuteCurrentCellAndAdvance, this.executeCell.bind(this, true)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Cell.GoToNextCell, this.cellHelper.goToNextCell.bind(this.cellHelper)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Cell.GoToPreviousCell, this.cellHelper.goToPreviousCell.bind(this.cellHelper)));
    }

    private executeCell(advanceToNext: boolean): Thenable<any> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve();
        }

        return this.cellHelper.getActiveCell().then(cellInfo => {
            if (!cellInfo || !cellInfo.cell) {
                return;
            }
            return vscode.commands.executeCommand(Commands.Jupyter.ExecuteRangeInKernel, activeEditor.document, cellInfo.cell).then(() => {
                if (!advanceToNext) {
                    return;
                }
                return this.cellHelper.advanceToCell(activeEditor.document, cellInfo.nextCell);
            });
        });
    }
    private displayCellOptions(document: vscode.TextDocument, range: vscode.Range, nextCellRange?: vscode.Range) {
        interface Option extends vscode.QuickPickItem {
            command: string;
            args: any[];
            postCommand?: string;
            postArgs?: any[];
        }
        const items: Option[] = [
            {
                label: 'Run cell',
                description: '',
                command: Commands.Jupyter.ExecuteRangeInKernel,
                args: [document, range]
            }];

        if (nextCellRange) {
            items.push(
                {
                    label: 'Run cell and advance',
                    description: '',
                    command: Commands.Jupyter.ExecuteRangeInKernel,
                    args: [document, range],
                    postCommand: Commands.Jupyter.Cell.AdcanceToCell,
                    postArgs: [document, nextCellRange]
                });
        }

        vscode.window.showQuickPick(items).then(item => {
            if (item) {
                vscode.commands.executeCommand(item.command, ...item.args).then(() => {
                    if (item.postCommand) {
                        vscode.commands.executeCommand(item.postCommand, ...item.postArgs);
                    }
                });
            }
        });
    }

}