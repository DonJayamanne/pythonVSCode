// tslint:disable:max-classes-per-file max-classes-per-file

import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { IPythonInstaller } from '../../api/types';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';
import { Telemetry } from '../../datascience/constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { sendTelemetryEvent } from '../../telemetry';
import { IApplicationShell, IWorkspaceService } from '../application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../process/types';
import {
    IConfigurationService,
    IInstaller,
    InstallerResponse,
    IOutputChannel,
    ModuleNamePurpose,
    Product
} from '../types';
import { isResource } from '../utils/misc';
import { StopWatch } from '../utils/stopWatch';
import { ProductNames } from './productNames';
import { InterpreterUri, IProductPathService } from './types';

export { Product } from '../types';

export const CTagsInsllationScript =
    os.platform() === 'darwin' ? 'brew install ctags' : 'sudo apt-get install exuberant-ctags';

export abstract class BaseInstaller {
    private static readonly PromptPromises = new Map<string, Promise<InstallerResponse>>();
    protected readonly appShell: IApplicationShell;
    protected readonly configService: IConfigurationService;
    private readonly workspaceService: IWorkspaceService;

    constructor(protected serviceContainer: IServiceContainer, protected outputChannel: OutputChannel) {
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public promptToInstall(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        // If this method gets called twice, while previous promise has not been resolved, then return that same promise.
        // E.g. previous promise is not resolved as a message has been displayed to the user, so no point displaying
        // another message.
        const workspaceFolder =
            resource && isResource(resource) ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const key = `${product}${workspaceFolder ? workspaceFolder.uri.fsPath : ''}`;
        if (BaseInstaller.PromptPromises.has(key)) {
            return BaseInstaller.PromptPromises.get(key)!;
        }
        const promise = this.promptToInstallImplementation(product, resource, cancel);
        BaseInstaller.PromptPromises.set(key, promise);
        promise.then(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();
        promise.catch(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();

        return promise;
    }

    public async install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        return this.serviceContainer.get<IPythonInstaller>(IPythonInstaller).install(product, resource, cancel);
    }

    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean | undefined> {
        // User may have customized the module name or provided the fully qualified path.
        const interpreter = isResource(resource) ? undefined : resource;
        const uri = isResource(resource) ? resource : undefined;
        const executableName = this.getExecutableNameFromSettings(product, uri);

        const isModule = this.isExecutableAModule(product, uri);
        if (isModule) {
            const pythonProcess = await this.serviceContainer
                .get<IPythonExecutionFactory>(IPythonExecutionFactory)
                .createActivatedEnvironment({ resource: uri, interpreter, allowEnvironmentFetchExceptions: true });
            return pythonProcess.isModuleInstalled(executableName);
        } else {
            const process = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create(uri);
            return process
                .exec(executableName, ['--version'], { mergeStdOutErr: true })
                .then(() => true)
                .catch(() => false);
        }
    }

    protected abstract promptToInstallImplementation(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse>;
    protected getExecutableNameFromSettings(product: Product, resource?: Uri): string {
        const productPathService = this.serviceContainer.get<IProductPathService>(IProductPathService);
        return productPathService.getExecutableNameFromSettings(product, resource);
    }
    protected isExecutableAModule(product: Product, resource?: Uri): Boolean {
        const productPathService = this.serviceContainer.get<IProductPathService>(IProductPathService);
        return productPathService.isExecutableAModule(product, resource);
    }
}

export class DataScienceInstaller extends BaseInstaller {
    // Override base installer to support a more DS-friendly streamlined installation.
    public async install(
        product: Product,
        interpreterUri?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        // Precondition
        if (isResource(interpreterUri)) {
            throw new Error('All data science packages require an interpreter be passed in');
        }
        const installer = this.serviceContainer.get<IPythonInstaller>(IPythonInstaller);

        // At this point we know that `interpreterUri` is of type PythonInterpreter
        const interpreter = interpreterUri as PythonEnvironment;
        const result = await installer.install(product, interpreter, cancel);

        if (result === InstallerResponse.Disabled || result === InstallerResponse.Ignore) {
            return result;
        }

        return this.isInstalled(product, interpreter).then((isInstalled) =>
            isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore
        );
    }
    protected async promptToInstallImplementation(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;
        const item = await this.appShell.showErrorMessage(
            localize.DataScience.libraryNotInstalled().format(productName),
            'Yes',
            'No'
        );
        if (item === 'Yes') {
            const stopWatch = new StopWatch();
            try {
                const response = await this.install(product, resource, cancel);
                const event =
                    product === Product.jupyter ? Telemetry.UserInstalledJupyter : Telemetry.UserInstalledModule;
                sendTelemetryEvent(event, stopWatch.elapsedTime, { product: productName });
                return response;
            } catch (e) {
                if (product === Product.jupyter) {
                    sendTelemetryEvent(Telemetry.JupyterInstallFailed);
                }
                throw e;
            }
        }
        return InstallerResponse.Ignore;
    }
}

@injectable()
export class ProductInstaller implements IInstaller {
    private interpreterService: IInterpreterService;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel: OutputChannel
    ) {
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
    }

    // tslint:disable-next-line:no-empty
    public dispose() {}
    public async promptToInstall(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        const currentInterpreter = isResource(resource)
            ? await this.interpreterService.getActiveInterpreter(resource)
            : resource;
        if (!currentInterpreter) {
            return InstallerResponse.Ignore;
        }
        return this.createInstaller().promptToInstall(product, resource, cancel);
    }
    public async install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        return this.createInstaller().install(product, resource, cancel);
    }
    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean | undefined> {
        return this.createInstaller().isInstalled(product, resource);
    }
    public translateProductToModuleName(product: Product, _purpose: ModuleNamePurpose): string {
        return translateProductToModule(product);
    }
    private createInstaller(): BaseInstaller {
        return new DataScienceInstaller(this.serviceContainer, this.outputChannel);
    }
}

// tslint:disable-next-line: cyclomatic-complexity
function translateProductToModule(product: Product): string {
    switch (product) {
        case Product.jupyter:
            return 'jupyter';
        case Product.notebook:
            return 'notebook';
        case Product.pandas:
            return 'pandas';
        case Product.ipykernel:
            return 'ipykernel';
        case Product.nbconvert:
            return 'nbconvert';
        case Product.kernelspec:
            return 'kernelspec';
        default: {
            throw new Error(`Product ${product} cannot be installed as a Python Module.`);
        }
    }
}
