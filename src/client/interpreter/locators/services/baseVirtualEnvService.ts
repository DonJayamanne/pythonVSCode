import { injectable, unmanaged } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterVersionService, InterpreterType, IVirtualEnvironmentsSearchPathProvider, PythonInterpreter } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { lookForInterpretersInDirectory } from '../helpers';
import { CacheableLocatorService } from './cacheableLocatorService';

@injectable()
export class BaseVirtualEnvService extends CacheableLocatorService {
    private readonly virtualEnvMgr: IVirtualEnvironmentManager;
    private readonly versionProvider: IInterpreterVersionService;
    private readonly fileSystem: IFileSystem;
    public constructor(@unmanaged() private searchPathsProvider: IVirtualEnvironmentsSearchPathProvider,
        @unmanaged() serviceContainer: IServiceContainer,
        @unmanaged() name: string,
        @unmanaged() cachePerWorkspace: boolean = false) {
        super(name, serviceContainer, cachePerWorkspace);
        this.virtualEnvMgr = serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        this.versionProvider = serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownVenvs(resource);
    }
    private async suggestionsFromKnownVenvs(resource?: Uri) {
        const searchPaths = this.searchPathsProvider.getSearchPaths(resource);
        return Promise.all(searchPaths.map(dir => this.lookForInterpretersInVenvs(dir)))
            .then(listOfInterpreters => _.flatten(listOfInterpreters));
    }
    private async lookForInterpretersInVenvs(pathToCheck: string) {
        return this.fileSystem.getSubDirectories(pathToCheck)
            .then(subDirs => Promise.all(this.getProspectiveDirectoriesForLookup(subDirs)))
            .then(dirs => dirs.filter(dir => dir.length > 0))
            .then(dirs => Promise.all(dirs.map(lookForInterpretersInDirectory)))
            .then(pathsWithInterpreters => _.flatten(pathsWithInterpreters))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getVirtualEnvDetails(interpreter))))
            .catch((err) => {
                console.error('Python Extension (lookForInterpretersInVenvs):', err);
                // Ignore exceptions.
                return [] as PythonInterpreter[];
            });
    }
    private getProspectiveDirectoriesForLookup(subDirs: string[]) {
        const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        const dirToLookFor = platform.virtualEnvBinName;
        return subDirs.map(subDir =>
            this.fileSystem.getSubDirectories(subDir)
                .then(dirs => {
                    const scriptOrBinDirs = dirs.filter(dir => {
                        const folderName = path.basename(dir);
                        return this.fileSystem.arePathsSame(folderName, dirToLookFor);
                    });
                    return scriptOrBinDirs.length === 1 ? scriptOrBinDirs[0] : '';
                })
                .catch((err) => {
                    console.error('Python Extension (getProspectiveDirectoriesForLookup):', err);
                    // Ignore exceptions.
                    return '';
                }));
    }
    private async getVirtualEnvDetails(interpreter: string): Promise<PythonInterpreter> {
        return Promise.all([
            this.versionProvider.getVersion(interpreter, path.basename(interpreter)),
            this.virtualEnvMgr.getEnvironmentName(interpreter)
        ])
            .then(([displayName, virtualEnvName]) => {
                const virtualEnvSuffix = virtualEnvName.length ? virtualEnvName : this.getVirtualEnvironmentRootDirectory(interpreter);
                return {
                    displayName: `${displayName} (${virtualEnvSuffix})`.trim(),
                    path: interpreter,
                    type: virtualEnvName.length > 0 ? InterpreterType.VirtualEnv : InterpreterType.Unknown
                };
            });
    }
    private getVirtualEnvironmentRootDirectory(interpreter: string) {
        // Python interperters are always in a subdirectory of the environment folder.
        return path.basename(path.dirname(path.dirname(interpreter)));
    }
}
