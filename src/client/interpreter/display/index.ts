import { inject, injectable } from 'inversify';
import { Disposable, OutputChannel, StatusBarAlignment, StatusBarItem, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import '../../common/extensions';
import { IDisposableRegistry, IOutputChannel, IPathUtils, Resource } from '../../common/types';
import { Interpreters } from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { IInterpreterAutoSelectionService } from '../autoSelection/types';
import { IInterpreterDisplay, IInterpreterHelper, IInterpreterService, PythonInterpreter } from '../contracts';

// tslint:disable-next-line:completed-docs
@injectable()
export class InterpreterDisplay implements IInterpreterDisplay {
    private readonly statusBar: StatusBarItem;
    private readonly helper: IInterpreterHelper;
    private readonly workspaceService: IWorkspaceService;
    private readonly pathUtils: IPathUtils;
    private readonly interpreterService: IInterpreterService;
    private currentlySelectedInterpreterPath?: string;
    private currentlySelectedWorkspaceFolder: Resource;
    private readonly autoSelection: IInterpreterAutoSelectionService;
    private interpreterPath: string | undefined;

    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.pathUtils = serviceContainer.get<IPathUtils>(IPathUtils);
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.autoSelection = serviceContainer.get<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService);

        const application = serviceContainer.get<IApplicationShell>(IApplicationShell);
        const disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);

        this.statusBar = application.createStatusBarItem(StatusBarAlignment.Left, 100);
        this.statusBar.command = 'python.setInterpreter';
        disposableRegistry.push(this.statusBar);

        this.interpreterService.onDidChangeInterpreterInformation(
            this.onDidChangeInterpreterInformation,
            this,
            disposableRegistry
        );
    }
    public async refresh(resource?: Uri) {
        // Use the workspace Uri if available
        if (resource && this.workspaceService.getWorkspaceFolder(resource)) {
            resource = this.workspaceService.getWorkspaceFolder(resource)!.uri;
        }
        if (!resource) {
            const wkspc = this.helper.getActiveWorkspaceUri(resource);
            resource = wkspc ? wkspc.folderUri : undefined;
        }
        await this.updateDisplay(resource);
    }
    private onDidChangeInterpreterInformation(info: PythonInterpreter) {
        if (!this.currentlySelectedInterpreterPath || this.currentlySelectedInterpreterPath === info.path) {
            this.updateDisplay(this.currentlySelectedWorkspaceFolder).ignoreErrors();
        }
    }
    private async updateDisplay(workspaceFolder?: Uri) {
        await this.autoSelection.autoSelectInterpreter(workspaceFolder);
        const interpreter = await this.interpreterService.getActiveInterpreter(workspaceFolder);
        this.currentlySelectedWorkspaceFolder = workspaceFolder;
        if (interpreter) {
            this.statusBar.color = '';
            this.statusBar.tooltip = this.pathUtils.getDisplayName(interpreter.path, workspaceFolder?.fsPath);
            if (this.interpreterPath !== interpreter.path) {
                const output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
                output.appendLine(
                    Interpreters.pythonInterpreterPath().format(
                        this.pathUtils.getDisplayName(interpreter.path, workspaceFolder?.fsPath)
                    )
                );
                this.interpreterPath = interpreter.path;
            }
            this.statusBar.text = interpreter.displayName!;
            this.currentlySelectedInterpreterPath = interpreter.path;
        } else {
            this.statusBar.tooltip = '';
            this.statusBar.color = 'yellow';
            this.statusBar.text = '$(alert) Select Python Interpreter';
            this.currentlySelectedInterpreterPath = undefined;
        }
        this.statusBar.show();
    }
}
