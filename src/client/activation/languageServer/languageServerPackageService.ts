// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { parse, SemVer } from 'semver';
import { IApplicationEnvironment } from '../../common/application/types';
import { PVSC_EXTENSION_ID } from '../../common/constants';
import { traceVerbose } from '../../common/logger';
import { INugetRepository, INugetService, NugetPackage } from '../../common/nuget/types';
import { IPlatformService } from '../../common/platform/types';
import { IConfigurationService, IExtensions, LanguageServerDownloadChannels } from '../../common/types';
import { Architecture, OSType } from '../../common/utils/platform';
import { IServiceContainer } from '../../ioc/types';
import { PlatformName } from '../platformData';
import { ILanguageServerPackageService } from '../types';
import { azureCDNBlobStorageAccount, LanguageServerPackageStorageContainers } from './languageServerPackageRepository';

const downloadBaseFileName = 'Python-Language-Server';
export const maxMajorVersion = 0;
export const PackageNames = {
    [PlatformName.Windows32Bit]: `${downloadBaseFileName}-${PlatformName.Windows32Bit}`,
    [PlatformName.Windows64Bit]: `${downloadBaseFileName}-${PlatformName.Windows64Bit}`,
    [PlatformName.Linux64Bit]: `${downloadBaseFileName}-${PlatformName.Linux64Bit}`,
    [PlatformName.Mac64Bit]: `${downloadBaseFileName}-${PlatformName.Mac64Bit}`
};

@injectable()
export class LanguageServerPackageService implements ILanguageServerPackageService {
    public maxMajorVersion: number = maxMajorVersion;
    constructor(@inject(IServiceContainer) protected readonly serviceContainer: IServiceContainer,
        @inject(IApplicationEnvironment) private readonly appEnv: IApplicationEnvironment) { }
    public getNugetPackageName(): string {
        const plaform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        switch (plaform.info.type) {
            case OSType.Windows: {
                const is64Bit = plaform.info.architecture === Architecture.x64;
                return PackageNames[is64Bit ? PlatformName.Windows64Bit : PlatformName.Windows32Bit];
            }
            case OSType.OSX: {
                return PackageNames[PlatformName.Mac64Bit];
            }
            default: {
                return PackageNames[PlatformName.Linux64Bit];
            }
        }
    }

    @traceVerbose('Get latest language server nuget package version')
    public async getLatestNugetPackageVersion(): Promise<NugetPackage> {
        const downloadChannel = this.getLanguageServerDownloadChannel();
        const nugetRepo = this.serviceContainer.get<INugetRepository>(INugetRepository, downloadChannel);
        const packageName = this.getNugetPackageName();
        traceVerbose(`Listing packages for ${downloadChannel} for ${packageName}`);
        const packages = await nugetRepo.getPackages(packageName);

        return this.getValidPackage(packages);
    }

    public getLanguageServerDownloadChannel(): LanguageServerDownloadChannels {
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configService.getSettings();
        if (settings.analysis.downloadChannel) {
            return settings.analysis.downloadChannel;
        }

        const isAlphaVersion = this.isAlphaVersionOfExtension();
        return isAlphaVersion ? 'beta' : 'stable';
    }
    protected getValidPackage(packages: NugetPackage[]): NugetPackage {
        const nugetService = this.serviceContainer.get<INugetService>(INugetService);
        const validPackages = packages
            .filter(item => item.version.major === this.maxMajorVersion)
            .filter(item => nugetService.isReleaseVersion(item.version))
            .sort((a, b) => a.version.compare(b.version));

        const pkg = validPackages[validPackages.length - 1];
        const minimumVersion = this.appEnv.packageJson.languageServerVersion as string;
        if (pkg.version.compare(minimumVersion) > 0) {
            return validPackages[validPackages.length - 1];
        }

        // This is a fall back, if the wrong version is returned, e.g. version is cached downstream in some proxy server or similar.
        // This way, we always ensure we have the minimum version that's compatible.
        return {
            version: new SemVer(minimumVersion),
            package: LanguageServerPackageStorageContainers.stable,
            uri: `${azureCDNBlobStorageAccount}/${LanguageServerPackageStorageContainers.stable}.${minimumVersion}.nupkg`
        };
    }

    private isAlphaVersionOfExtension() {
        const extensions = this.serviceContainer.get<IExtensions>(IExtensions);
        const extension = extensions.getExtension(PVSC_EXTENSION_ID)!;
        const version = parse(extension.packageJSON.version)!;
        return version.prerelease.length > 0 && version.prerelease[0] === 'alpha';
    }
}
