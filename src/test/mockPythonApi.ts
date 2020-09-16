import { inject, injectable } from 'inversify';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import { PythonApi } from '../client/api/types';
import { InterpreterUri } from '../client/common/installer/types';
import { InstallerResponse, Product, Resource } from '../client/common/types';
import { IInterpreterQuickPickItem } from '../client/interpreter/configuration/types';
import { IInterpreterService } from '../client/interpreter/contracts';
import { IWindowsStoreInterpreter } from '../client/interpreter/locators/types';
import { PythonEnvironment } from '../client/pythonEnvironments/info';

@injectable()
export class MockPythonApi implements PythonApi {
    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeEmitter.event;
    }
    private didChangeEmitter = new EventEmitter<void>();
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IWindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {}
    public getInterpreters(resource?: Uri): Promise<PythonEnvironment[]> {
        return this.interpreterService.getInterpreters(resource);
    }
    public getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined> {
        return this.interpreterService.getActiveInterpreter(resource);
    }
    public getInterpreterDetails(pythonPath: string, resource?: Uri): Promise<undefined | PythonEnvironment> {
        return this.interpreterService.getInterpreterDetails(pythonPath, resource);
    }
    public async getActivatedEnvironmentVariables(
        _resource: Resource,
        _interpreter?: PythonEnvironment,
        _allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined> {
        return undefined;
    }
    public isWindowsStoreInterpreter(pythonPath: string): Promise<boolean> {
        return this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath);
    }
    public async getSuggestions(_resource: Resource): Promise<IInterpreterQuickPickItem[]> {
        return [];
    }
    public async install(
        _product: Product,
        _resource?: InterpreterUri,
        _cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        return InstallerResponse.Ignore;
    }
}
