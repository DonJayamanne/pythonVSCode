import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { ILogger } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import {
    ICondaService,
    IInterpreterHelper,
    InterpreterType,
    PythonInterpreter
} from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';
import { AnacondaCompanyName, AnacondaCompanyNames, AnacondaDisplayName } from './conda';

@injectable()
export class CondaEnvFileService extends CacheableLocatorService {
    constructor(@inject(IInterpreterHelper) private helperService: IInterpreterHelper,
        @inject(ICondaService) private condaService: ICondaService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(ILogger) private logger: ILogger) {
        super('CondaEnvFileService', serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.getSuggestionsFromConda();
    }
    private async getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        if (!this.condaService.condaEnvironmentsFile) {
            return [];
        }
        return this.fileSystem.fileExists(this.condaService.condaEnvironmentsFile!)
            .then(exists => exists ? this.getEnvironmentsFromFile(this.condaService.condaEnvironmentsFile!) : Promise.resolve([]));
    }
    private async getEnvironmentsFromFile(envFile: string) {
        try {
            const fileContents = await this.fileSystem.readFile(envFile);
            const environmentPaths = fileContents.split(/\r?\n/g)
                .map(environmentPath => environmentPath.trim())
                .filter(environmentPath => environmentPath.length > 0);

            const interpreters = (await Promise.all(environmentPaths
                .map(environmentPath => this.getInterpreterDetails(environmentPath))))
                .filter(item => !!item)
                .map(item => item!);

            const environments = await this.condaService.getCondaEnvironments(true);
            if (Array.isArray(environments) && environments.length > 0) {
                interpreters
                    .forEach(interpreter => {
                        const environment = environments.find(item => this.fileSystem.arePathsSame(item.path, interpreter!.envPath!));
                        if (environment) {
                            interpreter.envName = environment!.name;
                            interpreter.displayName = `${interpreter.displayName} (${environment!.name})`;
                        }
                    });
            }
            return interpreters;
        } catch (err) {
            this.logger.logError('Python Extension (getEnvironmentsFromFile.readFile):', err);
            // Ignore errors in reading the file.
            return [] as PythonInterpreter[];
        }
    }
    private async getInterpreterDetails(environmentPath: string): Promise<PythonInterpreter | undefined> {
        const interpreter = this.condaService.getInterpreterPath(environmentPath);
        if (!interpreter || !await this.fileSystem.fileExists(interpreter)) {
            return;
        }

        const details = await this.helperService.getInterpreterInformation(interpreter);
        if (!details) {
            return;
        }
        const versionWithoutCompanyName = this.stripCompanyName(details.version!);
        return {
            displayName: `${AnacondaDisplayName} ${versionWithoutCompanyName}`,
            ...(details as PythonInterpreter),
            path: interpreter,
            companyDisplayName: AnacondaCompanyName,
            type: InterpreterType.Conda,
            envPath: environmentPath
        };
    }
    private stripCompanyName(content: string) {
        // Strip company name from version.
        const startOfCompanyName = AnacondaCompanyNames.reduce((index, companyName) => {
            if (index > 0) {
                return index;
            }
            return content.indexOf(`:: ${companyName}`);
        }, -1);

        return startOfCompanyName > 0 ? content.substring(0, startOfCompanyName).trim() : content;
    }
}
