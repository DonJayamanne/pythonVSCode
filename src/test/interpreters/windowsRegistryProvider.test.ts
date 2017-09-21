import { initialize, setPythonExecutable } from '../initialize';
import { IS_WINDOWS } from '../../client/debugger/Common/Utils';
import * as assert from 'assert';

import * as settings from '../../client/common/configSettings';
import { WindowsRegistryProvider } from '../../client/interpreter/sources/providers/windowsRegistryProvider';
import { MockRegistry } from './mocks';
import { Architecture, Hive } from '../../client/common/registry';

let pythonSettings = settings.PythonSettings.getInstance();
const originalPythonPath = pythonSettings.pythonPath;
let disposable = setPythonExecutable(pythonSettings);

suite('Interpreters from Windows Registry', () => {
    suiteSetup(done => {
        initialize()
            .then(() => done())
            .catch(() => done());
    });
    suiteTeardown(() => {
        disposable.dispose();
    });
    teardown(() => {
        pythonSettings.pythonPath = originalPythonPath;
    });

    if (IS_WINDOWS) {
        test('Must return an empty list (x86)', async () => {
            const registry = new MockRegistry([], []);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();
            assert.equal(interpreters.length, 0, 'Incorrect number of entries');
        });
        test('Must return an empty list (x64)', async () => {
            const registry = new MockRegistry([], []);
            const winRegistry = new WindowsRegistryProvider(registry, true);

            const interpreters = await winRegistry.getInterpreters();
            assert.equal(interpreters.length, 0, 'Incorrect number of entries');
        });
        test('Must return a single entry', async () => {
            const registryKeys = [
                { key: '\\Software\\Python', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One'] },
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1'] }
            ];
            const registryValues = [
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'c:/temp/Install Path Tag1' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'c:/temp/Install Path Tag1/Executable.Tag1', name: 'ExecutablePath' },
                { key: '\\Software\\Python\\Company One\\Tag1', hive: Hive.HKCU, arch: Architecture.x86, value: 'Version.Tag1', name: 'Version' },
                { key: '\\Software\\Python\\Company One\\Tag1', hive: Hive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },
            ];
            const registry = new MockRegistry(registryKeys, registryValues);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();

            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
            assert.equal(interpreters[0].displayName, 'DisplayName.Tag1', 'Incorrect display name');
            assert.equal(interpreters[0].path, 'c:/temp/Install Path Tag1/Executable.Tag1', 'Incorrect path');
            assert.equal(interpreters[0].version, 'Version.Tag1', 'Incorrect version');
        });
        test('Must default names for PythonCore and exe', async () => {
            const registryKeys = [
                { key: '\\Software\\Python', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PythonCore'] },
                { key: '\\Software\\Python\\PythonCore', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PythonCore\\Tag1'] }
            ];
            const registryValues = [
                { key: '\\Software\\Python\\PythonCore\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'c:/temp/Install Path Tag1' }
            ];
            const registry = new MockRegistry(registryKeys, registryValues);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();

            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[0].companyDisplayName, 'Python Software Foundation', 'Incorrect company name');
            assert.equal(interpreters[0].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[0].path, 'c:\\temp\\Install Path Tag1\\python.exe', 'Incorrect path');
            assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
        });
        test(`Must ignore company 'PyLauncher'`, async () => {
            const registryKeys = [
                { key: '\\Software\\Python', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PyLauncher'] },
                { key: '\\Software\\Python\\PythonCore', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PyLauncher\\Tag1'] }
            ];
            const registryValues = [
                { key: '\\Software\\Python\\PyLauncher\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'c:/temp/Install Path Tag1' }
            ];
            const registry = new MockRegistry(registryKeys, registryValues);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();

            assert.equal(interpreters.length, 0, 'Incorrect number of entries');
        });
        test('Must return a single entry and when registry contains only the InstallPath', async () => {
            const registryKeys = [
                { key: '\\Software\\Python', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One'] },
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1'] },
            ];
            const registryValues = [
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'c:/temp/Install Path Tag1' }
            ];
            const registry = new MockRegistry(registryKeys, registryValues);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();

            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[0].companyDisplayName, 'Company One', 'Incorrect company name');
            assert.equal(interpreters[0].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[0].path, 'c:\\temp\\Install Path Tag1\\python.exe', 'Incorrect path');
            assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
        });
        test('Must return multiple entries', async () => {
            const registryKeys = [
                { key: '\\Software\\Python', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three'] },
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
                { key: '\\Software\\Python\\Company Two', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
                { key: '\\Software\\Python\\Company Three', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
                { key: '\\Software\\Python', hive: Hive.HKLM, arch: Architecture.x86, values: ['A'] },
                { key: '\\Software\\Python\\Company A', hive: Hive.HKLM, arch: Architecture.x86, values: ['Another Tag'] }
            ];
            const registryValues = [
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag1' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Executable.Tag1', name: 'ExecutablePath' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Version.Tag1', name: 'Version' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },

                { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag2' },
                { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Executable.Tag2', name: 'ExecutablePath' },

                { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag A' },
                { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Version.Tag A', name: 'Version' },

                { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag B' },
                { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
                { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag C' },

                { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag !' },

                { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: Hive.HKLM, arch: Architecture.x86, value: 'Install Path Another Tag' }
            ];
            const registry = new MockRegistry(registryKeys, registryValues);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();

            assert.equal(interpreters.length, 6, 'Incorrect number of entries');
            assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
            assert.equal(interpreters[0].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[0].path, 'Executable.Tag1', 'Incorrect path');
            assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');

            assert.equal(interpreters[1].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[1].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
            assert.equal(interpreters[1].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[1].path, 'Executable.Tag2', 'Incorrect path');
            assert.equal(interpreters[1].version, 'Tag2', 'Incorrect version');

            assert.equal(interpreters[2].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[2].companyDisplayName, 'Company Two', 'Incorrect company name');
            assert.equal(interpreters[2].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[2].path, 'Install Path Tag A\\python.exe', 'Incorrect path');
            assert.equal(interpreters[2].version, 'Tag A', 'Incorrect version');
        });
        test('Must return multiple entries excluding the invalid registry items', async () => {
            const registryKeys = [
                { key: '\\Software\\Python', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three', '\\Software\\Python\\Company Four', '\\Software\\Python\\Company Five', 'Missing Tag'] },
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
                { key: '\\Software\\Python\\Company Two', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
                { key: '\\Software\\Python\\Company Three', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
                { key: '\\Software\\Python\\Company Four', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Four\\Four !'] },
                { key: '\\Software\\Python\\Company Five', hive: Hive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Five\\Five !'] },
                { key: '\\Software\\Python', hive: Hive.HKLM, arch: Architecture.x86, values: ['A'] },
                { key: '\\Software\\Python\\Company A', hive: Hive.HKLM, arch: Architecture.x86, values: ['Another Tag'] }
            ];
            const registryValues: { key: string, hive: Hive, arch?: Architecture, value: string, name?: string }[] = [
                { key: '\\Software\\Python\\Company One', hive: Hive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag1' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Executable.Tag1', name: 'ExecutablePath' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Version.Tag1', name: 'Version' },
                { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },

                { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag2' },
                { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Executable.Tag2', name: 'ExecutablePath' },

                { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag A' },
                { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Version.Tag A', name: 'Version' },

                { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag B' },
                { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
                { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag C' },

                { key: '\\Software\\Python\\Company Five\\Five !\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: undefined },

                { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: Hive.HKCU, arch: Architecture.x86, value: 'Install Path Tag !' },

                { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: Hive.HKLM, arch: Architecture.x86, value: 'Install Path Another Tag' }
            ];
            const registry = new MockRegistry(registryKeys, registryValues);
            const winRegistry = new WindowsRegistryProvider(registry, false);

            const interpreters = await winRegistry.getInterpreters();

            assert.equal(interpreters.length, 6, 'Incorrect number of entries');
            assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
            assert.equal(interpreters[0].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[0].path, 'Executable.Tag1', 'Incorrect path');
            assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');

            assert.equal(interpreters[1].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[1].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
            assert.equal(interpreters[1].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[1].path, 'Executable.Tag2', 'Incorrect path');
            assert.equal(interpreters[1].version, 'Tag2', 'Incorrect version');

            assert.equal(interpreters[2].architecture, Architecture.x86, 'Incorrect arhictecture');
            assert.equal(interpreters[2].companyDisplayName, 'Company Two', 'Incorrect company name');
            assert.equal(interpreters[2].displayName, undefined, 'Incorrect display name');
            assert.equal(interpreters[2].path, 'Install Path Tag A\\python.exe', 'Incorrect path');
            assert.equal(interpreters[2].version, 'Tag A', 'Incorrect version');
        });
    }
});
