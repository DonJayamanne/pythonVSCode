import { Architecture, getArchitectureDislayName, Hive, IRegistry } from '../common/registry';
import { Is_64Bit } from '../common/utils';
import { PythonInterpreter } from './contracts';
import * as Registry from 'winreg';
import * as path from 'path';
import * as _ from 'lodash';
import * as os from 'os';

const DEFAULT_PYTHOH_EXECUTABLE = 'python.exe';
const COMPANIES_TO_IGNORE = ['PYLAUNCHER'];
const PythonCoreCompanyDisplayName = "Python Software Foundation";
const PythonCoreComany = "PythonCore";

type CompanyInterpreter = {
    companyKey: string,
    hive: Hive,
    arch?: Architecture
};

export class WindowsPythonInterpreters {
    constructor(private registry: IRegistry) {

    }
    public getInterpreters() {
        return this.getInterpretersFromRegistry()
    }
    private async getInterpretersFromRegistry() {
        // https://github.com/python/peps/blob/master/pep-0514.txt#L357
        const hkcuArch = Is_64Bit ? undefined : Architecture.x86;
        const promises: Promise<CompanyInterpreter[]>[] = [
            this.getCompanies(Hive.HKCU, hkcuArch),
            this.getCompanies(Hive.HKLM, Architecture.x86)
        ];
        // https://github.com/Microsoft/PTVS/blob/ebfc4ca8bab234d453f15ee426af3b208f3c143c/Python/Product/Cookiecutter/Shared/Interpreters/PythonRegistrySearch.cs#L44
        if (Is_64Bit) {
            promises.push(this.getCompanies(Hive.HKLM, Architecture.x64));
        }

        const companies = await Promise.all<CompanyInterpreter[]>(promises);
        const companyInterpreters = await Promise.all(_.flatten(companies)
            .filter(item => item !== undefined && item !== null)
            .map(company => {
                return this.getInterpretersForCompany(company.companyKey, company.hive, company.arch);
            }));

        return _.flatten(companyInterpreters)
            .filter(item => item !== undefined && item !== null)
            .map(item => item!)
            .reduce<PythonInterpreter[]>((prev, current) => {
                if (prev.findIndex(item => item.path.toUpperCase() === current.path.toUpperCase()) === -1) {
                    prev.push(current);
                }
                return prev;
            }, []);
    }
    private async getCompanies(hive: Hive, arch?: Architecture): Promise<CompanyInterpreter[]> {
        return this.registry.getKeys(`\\Software\\Python`, hive, arch)
            .then(companyKeys => companyKeys
                .filter(companyKey => COMPANIES_TO_IGNORE.indexOf(path.basename(companyKey).toUpperCase()) === -1)
                .map(companyKey => {
                    return { companyKey, hive, arch };
                }));
    }
    private async getInterpretersForCompany(companyKey: string, hive: Hive, arch?: Architecture) {
        const tagKeyss = await this.registry.getKeys(companyKey, hive, arch);
        return Promise.all(tagKeyss.map(tagKey => this.getInreterpreterDetailsForCompany(tagKey, companyKey, hive, arch)));
    }
    private getInreterpreterDetailsForCompany(tagKey: string, companyKey: string, hive: Hive, arch?: Architecture): Promise<PythonInterpreter> {
        const key = `${tagKey}\\InstallPath`;
        return this.registry.getValue(key, hive, arch)
            .then(installPath => {
                // Install path is mandatory
                if (!installPath) {
                    return null;
                }

                // Check if 'ExecutablePath' exists
                // Remember Python 2.7 doesn't have 'ExecutablePath' (there could be others)
                // Treat all other values as optional
                return Promise.all([
                    Promise.resolve(installPath),
                    this.registry.getValue(key, hive, arch, 'ExecutablePath'),
                    this.getInterpreterDisplayName(tagKey, companyKey, hive, arch),
                    this.registry.getValue(tagKey, hive, arch, 'Version'),
                    this.getCompanyDisplayName(companyKey, hive, arch)
                ]);
            })
            .then(([installPath, executablePath, displayName, version, companyDisplayName]) => {
                executablePath = executablePath && executablePath.length > 0 ? executablePath : path.join(installPath, DEFAULT_PYTHOH_EXECUTABLE);

                return {
                    architecture: arch,
                    displayName,
                    path: executablePath,
                    version: version ? path.basename(version) : path.basename(tagKey),
                    companyDisplayName
                } as PythonInterpreter;
            })
            .catch(error => {
                console.error(`Failed to retrieve interpreter details for company ${companyKey},tag: ${tagKey}, hive: ${hive}, arch: ${arch}`);
                console.error(error);
                return null;
            });
    }
    private async getInterpreterDisplayName(tagKey: string, companyKey: string, hive: Hive, arch?: Architecture) {
        const displayName = await this.registry.getValue(tagKey, hive, arch, 'DisplayName');
        if (displayName && displayName.length > 0) {
            return displayName;
        }
    }
    private async  getCompanyDisplayName(companyKey: string, hive: Hive, arch?: Architecture) {
        const displayName = await this.registry.getValue(companyKey, hive, arch, 'DisplayName');
        if (displayName && displayName.length > 0) {
            return displayName;
        }
        const company = path.basename(companyKey);
        return company.toUpperCase() === PythonCoreComany ? PythonCoreCompanyDisplayName : company;
    }
}