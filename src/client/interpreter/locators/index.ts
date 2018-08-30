import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Disposable, Uri } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { arePathsSame } from '../../common/utils';
import { IServiceContainer } from '../../ioc/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IInterpreterLocatorService,
    InterpreterType,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    PythonInterpreter,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../contracts';
import { fixInterpreterDisplayName, isMacDefaultPythonPath } from './helpers';

@injectable()
export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private disposables: Disposable[] = [];
    private platform: IPlatformService;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        serviceContainer.get<Disposable[]>(IDisposableRegistry).push(this);
        this.platform = serviceContainer.get<IPlatformService>(IPlatformService);
    }
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        // Pipenv always wins
        const pipenv = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, PIPENV_SERVICE);
        const interpreters = await pipenv.getInterpreters(resource);
        if (interpreters.length > 0) {
            return interpreters;
        }
        return this.getInterpretersPerResource(resource);
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private async getInterpretersPerResource(resource?: Uri): Promise<PythonInterpreter[]> {
        const locators = this.getLocators();
        const promises = locators.map(async provider => provider.getInterpreters(resource));
        const listOfInterpreters = await Promise.all(promises);

        // tslint:disable-next-line:underscore-consistent-invocation
        return _.flatten(listOfInterpreters)
            .filter(item => !!item)
            .map(item => item!)
            .map(fixInterpreterDisplayName)
            .map(item => { item.path = path.normalize(item.path); return item; })
            .reduce<PythonInterpreter[]>((accumulator, current) => {
                if (this.platform.isMac && isMacDefaultPythonPath(current.path)) {
                    return accumulator;
                }
                const existingItem = accumulator.find(item => arePathsSame(item.path, current.path));
                if (!existingItem) {
                    accumulator.push(current);
                } else {
                    // Preserve type information.
                    if (existingItem.type === InterpreterType.Unknown && current.type !== InterpreterType.Unknown) {
                        existingItem.type = current.type;
                    }
                }
                return accumulator;
            }, []);
    }
    private getLocators(): IInterpreterLocatorService[] {
        const locators: IInterpreterLocatorService[] = [];
        // The order of the services is important.
        // The order is important because the data sources at the bottom of the list do not contain all,
        //  the information about the interpreters (e.g. type, environment name, etc).
        // This way, the items returned from the top of the list will win, when we combine the items returned.
        if (this.platform.isWindows) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WINDOWS_REGISTRY_SERVICE));
        }
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CONDA_ENV_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CONDA_ENV_FILE_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, GLOBAL_VIRTUAL_ENV_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE));

        if (!this.platform.isWindows) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, KNOWN_PATH_SERVICE));
        }
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CURRENT_PATH_SERVICE));

        return locators;
    }
}
