import { inject, injectable, named, optional } from 'inversify';
import * as path from 'path';
import { compare, parse, SemVer } from 'semver';
import { ConfigurationChangeEvent, Uri } from 'vscode';

import { IWorkspaceService } from '../../../common/application/types';
import { Logger, traceDecorators, traceVerbose } from '../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IConfigurationService, IDisposableRegistry, ILogger, IPersistentStateFactory } from '../../../common/types';
import {
    CondaInfo,
    ICondaService,
    IInterpreterLocatorService,
    InterpreterType,
    PythonInterpreter,
    WINDOWS_REGISTRY_SERVICE
} from '../../contracts';
import { CondaHelper } from './condaHelper';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

// This glob pattern will match all of the following:
// ~/anaconda/bin/conda, ~/anaconda3/bin/conda, ~/miniconda/bin/conda, ~/miniconda3/bin/conda
// /usr/share/anaconda/bin/conda, /usr/share/anaconda3/bin/conda, /usr/share/miniconda/bin/conda, /usr/share/miniconda3/bin/conda

const condaGlobPathsForLinuxMac = [
    '/opt/*conda*/bin/conda',
    '/usr/share/*conda*/bin/conda',
    untildify('~/*conda*/bin/conda')];

export const CondaLocationsGlob = `{${condaGlobPathsForLinuxMac.join(',')}}`;

// ...and for windows, the known default install locations:
const condaGlobPathsForWindows = [
    '/ProgramData/[Mm]iniconda*/Scripts/conda.exe',
    '/ProgramData/[Aa]naconda*/Scripts/conda.exe',
    untildify('~/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/[Aa]naconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Aa]naconda*/Scripts/conda.exe')];

// format for glob processing:
export const CondaLocationsGlobWin = `{${condaGlobPathsForWindows.join(',')}}`;

export const CondaGetEnvironmentPrefix = 'Outputting Environment Now...';

/**
 * A wrapper around a conda installation.
 */
@injectable()
export class CondaService implements ICondaService {
    private condaFile?: Promise<string | undefined>;
    private isAvailable: boolean | undefined;
    private readonly condaHelper = new CondaHelper();

    constructor(
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ILogger) private logger: ILogger,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IInterpreterLocatorService) @named(WINDOWS_REGISTRY_SERVICE) @optional() private registryLookupForConda?: IInterpreterLocatorService
    ) {
        this.addCondaPathChangedHandler();
    }

    public get condaEnvironmentsFile(): string | undefined {
        const homeDir = this.platform.isWindows ? process.env.USERPROFILE : (process.env.HOME || process.env.HOMEPATH);
        return homeDir ? path.join(homeDir, '.conda', 'environments.txt') : undefined;
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    public dispose() { }

    /**
     * Return the path to the "conda file".
     */
    public async getCondaFile(): Promise<string> {
        if (!this.condaFile) {
            this.condaFile = this.getCondaFileImpl();
        }
        // tslint:disable-next-line:no-unnecessary-local-variable
        const condaFile = await this.condaFile!;
        return condaFile!;
    }

    /**
     * Is there a conda install to use?
     */
    public async isCondaAvailable(): Promise<boolean> {
        if (typeof this.isAvailable === 'boolean') {
            return this.isAvailable;
        }
        return this.getCondaVersion()
            .then(version => this.isAvailable = version !== undefined)
            .catch(() => this.isAvailable = false);
    }

    /**
     * Return the conda version.
     */
    public async getCondaVersion(): Promise<SemVer | undefined> {
        const processService = await this.processServiceFactory.create();
        const info = await this.getCondaInfo().catch<CondaInfo | undefined>(() => undefined);
        let versionString: string | undefined;
        if (info && info.conda_version) {
            versionString = info.conda_version;
        } else {
            const stdOut = await this.getCondaFile()
                .then(condaFile => processService.exec(condaFile, ['--version'], {}))
                .then(result => result.stdout.trim())
                .catch<string | undefined>(() => undefined);

            versionString = (stdOut && stdOut.startsWith('conda ')) ? stdOut.substring('conda '.length).trim() : stdOut;
        }
        if (!versionString) {
            return;
        }
        const version = parse(versionString, true);
        if (version) {
            return version;
        }
        // Use a bogus version, at least to indicate the fact that a version was returned.
        Logger.warn(`Unable to parse Version of Conda, ${versionString}`);
        return new SemVer('0.0.1');
    }

    /**
     * Can the shell find conda (to run it)?
     */
    public async isCondaInCurrentPath() {
        const processService = await this.processServiceFactory.create();
        return processService.exec('conda', ['--version'])
            .then(output => output.stdout.length > 0)
            .catch(() => false);
    }

    /**
     * Return the info reported by the conda install.
     */
    public async getCondaInfo(): Promise<CondaInfo | undefined> {
        try {
            const condaFile = await this.getCondaFile();
            const processService = await this.processServiceFactory.create();
            const condaInfo = await processService.exec(condaFile, ['info', '--json']).then(output => output.stdout);

            return JSON.parse(condaInfo) as CondaInfo;
        } catch (ex) {
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda info --json` has changed signature.
        }
    }

    /**
     * Determines whether a python interpreter is a conda environment or not.
     * The check is done by simply looking for the 'conda-meta' directory.
     * @param {string} interpreterPath
     * @returns {Promise<boolean>}
     * @memberof CondaService
     */
    public async isCondaEnvironment(interpreterPath: string): Promise<boolean> {
        const dir = path.dirname(interpreterPath);
        const isWindows = this.platform.isWindows;
        const condaMetaDirectory = isWindows ? path.join(dir, 'conda-meta') : path.join(dir, '..', 'conda-meta');
        return this.fileSystem.directoryExists(condaMetaDirectory);
    }

    /**
     * Return (env name, interpreter filename) for the interpreter.
     */
    public async getCondaEnvironment(interpreterPath: string): Promise<{ name: string; path: string } | undefined> {
        const isCondaEnv = await this.isCondaEnvironment(interpreterPath);
        if (!isCondaEnv) {
            return;
        }
        let environments = await this.getCondaEnvironments(false);
        const dir = path.dirname(interpreterPath);

        // If interpreter is in bin or Scripts, then go up one level
        const subDirName = path.basename(dir);
        const goUpOnLevel = ['BIN', 'SCRIPTS'].indexOf(subDirName.toUpperCase()) !== -1;
        const interpreterPathToMatch = goUpOnLevel ? path.join(dir, '..') : dir;

        // From the list of conda environments find this dir.
        let matchingEnvs = Array.isArray(environments) ? environments.filter(item => this.fileSystem.arePathsSame(item.path, interpreterPathToMatch)) : [];
        if (matchingEnvs.length === 0) {
            environments = await this.getCondaEnvironments(true);
            matchingEnvs = Array.isArray(environments) ? environments.filter(item => this.fileSystem.arePathsSame(item.path, interpreterPathToMatch)) : [];
        }

        if (matchingEnvs.length > 0) {
            return { name: matchingEnvs[0].name, path: interpreterPathToMatch };
        }

        // If still not available, then the user created the env after starting vs code.
        // The only solution is to get the user to re-start vscode.
    }

    /**
     * Return the list of conda envs (by name, interpreter filename).
     */
    @traceDecorators.verbose('Get Conda environments')
    public async getCondaEnvironments(ignoreCache: boolean): Promise<({ name: string; path: string }[]) | undefined> {
        // Global cache.
        // tslint:disable-next-line:no-any
        const globalPersistence = this.persistentStateFactory.createGlobalPersistentState<{ data: { name: string; path: string }[] | undefined }>('CONDA_ENVIRONMENTS', undefined as any);
        if (!ignoreCache && globalPersistence.value) {
            return globalPersistence.value.data;
        }

        try {
            const condaFile = await this.getCondaFile();
            const processService = await this.processServiceFactory.create();
            const envInfo = await processService.exec(condaFile, ['env', 'list']).then(output => output.stdout);
            traceVerbose(`Conda Env List ${envInfo}}`);
            const environments = this.condaHelper.parseCondaEnvironmentNames(envInfo);
            await globalPersistence.updateValue({ data: environments });
            return environments;
        } catch (ex) {
            await globalPersistence.updateValue({ data: undefined });
            // Failed because either:
            //   1. conda is not installed.
            //   2. `conda env list has changed signature.
            this.logger.logInformation('Failed to get conda environment list from conda', ex);
        }
    }

    /**
     * Return the interpreter's filename for the given environment.
     */
    public getInterpreterPath(condaEnvironmentPath: string): string {
        // where to find the Python binary within a conda env.
        const relativePath = this.platform.isWindows ? 'python.exe' : path.join('bin', 'python');
        return path.join(condaEnvironmentPath, relativePath);
    }

    /**
     * Get the conda exe from the path to an interpreter's python. This might be different than the globally registered conda.exe
     */
    @traceDecorators.verbose('Get Conda File from interpreter')
    public async getCondaFileFromInterpreter(interpreterPath?: string, envName?: string): Promise<string | undefined> {
        const condaExe = this.platform.isWindows ? 'conda.exe' : 'conda';
        const scriptsDir = this.platform.isWindows ? 'Scripts' : 'bin';
        const interpreterDir = interpreterPath ? path.dirname(interpreterPath) : '';

        // Might be in a situation where this is not the default python env, but rather one running
        // from a virtualenv
        const envsPos = envName ? interpreterDir.indexOf(path.join('envs', envName)) : -1;
        if (envsPos > 0) {
            // This should be where the original python was run from when the environment was created.
            const originalPath = interpreterDir.slice(0, envsPos);
            let condaPath = path.join(originalPath, condaExe);

            if (await this.fileSystem.fileExists(condaPath)) {
                return condaPath;
            }

            // Also look in the scripts directory here too.
            condaPath = path.join(originalPath, scriptsDir, condaExe);
            if (await this.fileSystem.fileExists(condaPath)) {
                return condaPath;
            }
        }

        let condaPath = path.join(interpreterDir, condaExe);
        if (await this.fileSystem.fileExists(condaPath)) {
            return condaPath;
        }
        // Conda path has changed locations, check the new location in the scripts directory after checking
        // the old location
        condaPath = path.join(interpreterDir, scriptsDir, condaExe);
        if (await this.fileSystem.fileExists(condaPath)) {
            return condaPath;
        }
    }

    /**
     * Is the given interpreter from conda?
     */
    private detectCondaEnvironment(interpreter: PythonInterpreter) {
        return interpreter.type === InterpreterType.Conda ||
            (interpreter.displayName ? interpreter.displayName : '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName ? interpreter.companyDisplayName : '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName ? interpreter.companyDisplayName : '').toUpperCase().indexOf('CONTINUUM') >= 0;
    }

    /**
     * Return the highest Python version from the given list.
     */
    private getLatestVersion(interpreters: PythonInterpreter[]) {
        const sortedInterpreters = interpreters.slice();
        // tslint:disable-next-line:no-non-null-assertion
        sortedInterpreters.sort((a, b) => (a.version && b.version) ? compare(a.version.raw, b.version.raw) : 0);
        if (sortedInterpreters.length > 0) {
            return sortedInterpreters[sortedInterpreters.length - 1];
        }
    }

    private addCondaPathChangedHandler() {
        const disposable = this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
        this.disposableRegistry.push(disposable);
    }
    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders!.map(workspace => workspace.uri) : [undefined];
        if (workspacesUris.findIndex(uri => event.affectsConfiguration('python.condaPath', uri)) === -1) {
            return;
        }
        this.condaFile = undefined;
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     */
    private async getCondaFileImpl() {
        const settings = this.configService.getSettings();

        const setting = settings.condaPath;
        if (setting && setting !== '') {
            return setting;
        }

        const isAvailable = await this.isCondaInCurrentPath();
        if (isAvailable) {
            return 'conda';
        }
        if (this.platform.isWindows && this.registryLookupForConda) {
            const interpreters = await this.registryLookupForConda.getInterpreters();
            const condaInterpreters = interpreters.filter(this.detectCondaEnvironment);
            const condaInterpreter = this.getLatestVersion(condaInterpreters);
            if (condaInterpreter) {
                const interpreterPath = await this.getCondaFileFromInterpreter(condaInterpreter.path, condaInterpreter.envName);
                if (interpreterPath) {
                    return interpreterPath;
                }
            }
        }
        return this.getCondaFileFromKnownLocations();
    }

    /**
     * Return the path to the "conda file", if there is one (in known locations).
     * Note: For now we simply return the first one found.
     */
    private async getCondaFileFromKnownLocations(): Promise<string> {
        const globPattern = this.platform.isWindows ? CondaLocationsGlobWin : CondaLocationsGlob;
        const condaFiles = await this.fileSystem.search(globPattern)
            .catch<string[]>((failReason) => {
                Logger.warn(
                    'Default conda location search failed.',
                    `Searching for default install locations for conda results in error: ${failReason}`
                );
                return [];
            });
        const validCondaFiles = condaFiles.filter(condaPath => condaPath.length > 0);
        return validCondaFiles.length === 0 ? 'conda' : validCondaFiles[0];
    }
}
