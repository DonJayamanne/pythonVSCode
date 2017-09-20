import * as Registry from 'winreg';
enum RegistryArchitectures {
    x86 = 'x86',
    x64 = 'x64'
}

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum Hive {
    HKCU, HKLM
}

export interface IRegistry {
    getKeys(key: string, hive: Hive, arch?: Architecture): Promise<string[]>;
    getValue(key: string, hive: Hive, arch?: Architecture, name?: string): Promise<string | void>;
}

export class RegistryImplementation implements IRegistry {
    public getKeys(key: string, hive: Hive, arch?: Architecture) {
        return getRegistryKeys({ hive: translateHive(hive), arch: translateArchitecture(arch), key });
    }
    public getValue(key: string, hive: Hive, arch?: Architecture, name: string = '') {
        return getRegistryValue({ hive: translateHive(hive), arch: translateArchitecture(arch), key }, name);
    }
}

export function getArchitectureDislayName(arch: Architecture) {
    switch (arch) {
        case Architecture.x64:
            return '64-bit';
        case Architecture.x86:
            return '32-bit';
        default:
            return '';
    }
}

function getRegistryValue(options: Registry.Options, name: string = '') {
    return new Promise<string | undefined | null>((resolve, reject) => {
        new Registry(options).get(name, (error, result) => {
            if (error) {
                return resolve();
            }
            resolve(result.value);
        });
    });
}
function getRegistryKeys(options: Registry.Options): Promise<string[]> {
    // https://github.com/python/peps/blob/master/pep-0514.txt#L85
    return new Promise<string[]>((resolve, reject) => {
        new Registry(options).keys((error, result) => {
            if (error) {
                return resolve([]);
            }
            resolve(result.map(item => item.key));
        });
    });
}
function translateArchitecture(arch: Architecture) {
    switch (arch) {
        case Architecture.x86:
            return RegistryArchitectures.x86;
        case Architecture.x64:
            return RegistryArchitectures.x64;
        default:
            return;
    }
}
function translateHive(hive: Hive) {
    switch (hive) {
        case Hive.HKCU:
            return Registry.HKCU;
        case Hive.HKLM:
            return Registry.HKLM;
        default:
            return;
    }
}
