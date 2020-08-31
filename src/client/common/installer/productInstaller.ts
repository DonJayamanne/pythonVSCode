// tslint:disable:max-classes-per-file max-classes-per-file

import { inject, injectable, named } from 'inversify';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';
import { Telemetry } from '../../datascience/constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { IApplicationShell, IWorkspaceService } from '../application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { traceError } from '../logger';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../process/types';
import {
    IConfigurationService,
    IInstaller,
    InstallerResponse,
    IOutputChannel,
    ModuleNamePurpose,
    Product,
    ProductType
} from '../types';
import { isResource, noop } from '../utils/misc';
import { StopWatch } from '../utils/stopWatch';
import { ProductNames } from './productNames';
import { IInstallationChannelManager, InterpreterUri, IProductPathService, IProductService } from './types';

export { Product } from '../types';

export abstract class BaseInstaller {
    private static readonly PromptPromises = new Map<string, Promise<InstallerResponse>>();
    protected readonly appShell: IApplicationShell;
    protected readonly configService: IConfigurationService;
    private readonly workspaceService: IWorkspaceService;
    private readonly productService: IProductService;

    constructor(protected serviceContainer: IServiceContainer, protected outputChannel: OutputChannel) {
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.productService = serviceContainer.get<IProductService>(IProductService);
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
        const channels = this.serviceContainer.get<IInstallationChannelManager>(IInstallationChannelManager);
        const installer = await channels.getInstallationChannel(product, resource);
        if (!installer) {
            return InstallerResponse.Ignore;
        }

        const moduleName = translateProductToModule(product, ModuleNamePurpose.install);
        await installer
            .installModule(moduleName, resource, cancel)
            .catch((ex) => traceError(`Error in installing the module '${moduleName}', ${ex}`));

        return this.isInstalled(product, resource).then((isInstalled) =>
            isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore
        );
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
        const productType = this.productService.getProductType(product);
        const productPathService = this.serviceContainer.get<IProductPathService>(IProductPathService, productType);
        return productPathService.getExecutableNameFromSettings(product, resource);
    }
    protected isExecutableAModule(product: Product, resource?: Uri): Boolean {
        const productType = this.productService.getProductType(product);
        const productPathService = this.serviceContainer.get<IProductPathService>(IProductPathService, productType);
        return productPathService.isExecutableAModule(product, resource);
    }
}

export class DataScienceInstaller extends BaseInstaller {
    // Override base installer to support a more DS-friendly streamlined installation.
    public async install(
        _product: Product,
        _interpreterUri?: InterpreterUri,
        _cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Python Jupyter API
        this.appShell.showErrorMessage('Hookup with Python API').then(noop, noop);
        return InstallerResponse.Ignore;
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
    private readonly productService: IProductService;
    private interpreterService: IInterpreterService;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel: OutputChannel
    ) {
        this.productService = serviceContainer.get<IProductService>(IProductService);
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
        return this.createInstaller(product).promptToInstall(product, resource, cancel);
    }
    public async install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken
    ): Promise<InstallerResponse> {
        return this.createInstaller(product).install(product, resource, cancel);
    }
    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean | undefined> {
        return this.createInstaller(product).isInstalled(product, resource);
    }
    public translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string {
        return translateProductToModule(product, purpose);
    }
    private createInstaller(product: Product): BaseInstaller {
        const productType = this.productService.getProductType(product);
        switch (productType) {
            case ProductType.DataScience:
                return new DataScienceInstaller(this.serviceContainer, this.outputChannel);
            default:
                break;
        }
        throw new Error(`Unknown product ${product}`);
    }
}

// tslint:disable-next-line: cyclomatic-complexity
function translateProductToModule(product: Product, _purpose: ModuleNamePurpose): string {
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
