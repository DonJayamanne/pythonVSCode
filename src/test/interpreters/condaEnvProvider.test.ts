import * as assert from 'assert';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';
import { initialize, setPythonExecutable } from '../initialize';
import { IS_WINDOWS } from '../../client/common/utils';
import { CondaEnvProvider } from '../../client/interpreter/sources/providers/condaEnvProvider';
import { MockProvider } from './mocks';
import { PythonInterpreter } from '../../client/interpreter';

let pythonSettings = settings.PythonSettings.getInstance();
const originalPythonPath = pythonSettings.pythonPath;
let disposable = setPythonExecutable(pythonSettings);

suite('Interpreters from Conda Environments', () => {
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


    test('Must return an empty list for empty json', async () => {
        const condaProvider = new CondaEnvProvider();
        const interpreters = await condaProvider.parseCondaInfo({} as any)
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must extract display name from version info', async () => {
        const condaProvider = new CondaEnvProvider();
        const windowsEnvs = ['c:\\temp', 'c:\\two three\\four'];
        const nonWindowsEnvs = ['usr/temp', 'usr/two three/four'];
        const info = {
            envs: IS_WINDOWS ? windowsEnvs : nonWindowsEnvs,
            default_prefix: '',
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const interpreters = await condaProvider.parseCondaInfo(info);
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda 4.4.0 (64-bit) (temp)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, 'Continuum Analytics, Inc.', 'Incorrect company display name for first env');

        const path2 = path.join(info.envs[1], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[1].path, path2, 'Incorrect path for first env');
        assert.equal(interpreters[1].displayName, 'Anaconda 4.4.0 (64-bit) (four)', 'Incorrect display name for first env');
        assert.equal(interpreters[1].companyDisplayName, 'Continuum Analytics, Inc.', 'Incorrect company display name for first env');
    });
    test('Must use the default display name if sys.version is invalid', async () => {
        const condaProvider = new CondaEnvProvider();
        const windowsEnvs = ['c:\\temp'];
        const nonWindowsEnvs = ['usr/temp'];
        const info = {
            envs: IS_WINDOWS ? windowsEnvs : nonWindowsEnvs,
            default_prefix: '',
            'sys.version': '3.6.1 |Anaonda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const interpreters = await condaProvider.parseCondaInfo(info);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda (temp)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, 'Continuum Analytics, Inc.', 'Incorrect company display name for first env');
    });
    test('Must use the default display name if sys.version is empty', async () => {
        const condaProvider = new CondaEnvProvider();
        const windowsEnvs = ['c:\\temp'];
        const nonWindowsEnvs = ['usr/temp'];
        const info = {
            envs: IS_WINDOWS ? windowsEnvs : nonWindowsEnvs,
        };
        const interpreters = await condaProvider.parseCondaInfo(info as any);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda (temp)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, 'Continuum Analytics, Inc.', 'Incorrect company display name for first env');
    });
    test('Must include the default_prefix into the list of interpreters', async () => {
        const condaProvider = new CondaEnvProvider();
        const windowsEnvs = 'c:\\temp';
        const nonWindowsEnvs = 'usr/temp';
        const info = {
            default_prefix: IS_WINDOWS ? windowsEnvs : nonWindowsEnvs,
        };
        const interpreters = await condaProvider.parseCondaInfo(info as any);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.default_prefix, IS_WINDOWS ? 'python.exe' : 'bin/python');
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].displayName, 'Anaconda', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, 'Continuum Analytics, Inc.', 'Incorrect company display name for first env');
    });
    test('Must detect conda environments from a list', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1' },
            { displayName: 'Two', path: pythonSettings.pythonPath, companyDisplayName: 'Two 2' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
            { displayName: 'Anaconda', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
            { displayName: 'xAnaconda', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
            { displayName: 'xnaconda', path: 'c:/path3/three.exe', companyDisplayName: 'xContinuum Analytics, Inc.' },
            { displayName: 'xnaconda', path: 'c:/path3/three.exe', companyDisplayName: 'Continuum Analytics, Inc.' },
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvProvider(mockRegistryProvider);

        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[0]), false, '1. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[1]), false, '2. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[2]), false, '3. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[3]), true, `4. Failed to identify conda environment when displayName starts with 'Anaconda'`);
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[4]), true, `5. Failed to identify conda environment when displayName contains text 'Anaconda'`);
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[5]), true, `6. Failed to identify conda environment when comanyDisplayName contains 'Continuum'`);
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[6]), true, `7. Failed to identify conda environment when companyDisplayName starts with 'Continuum'`);
    });
    test('Must detect conda environments from a list', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1' },
            { displayName: 'Two', path: pythonSettings.pythonPath, companyDisplayName: 'Two 2' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
            { displayName: 'Anaconda', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
            { displayName: 'xAnaconda', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
            { displayName: 'xnaconda', path: 'c:/path3/three.exe', companyDisplayName: 'xContinuum Analytics, Inc.' },
            { displayName: 'xnaconda', path: 'c:/path3/three.exe', companyDisplayName: 'Continuum Analytics, Inc.' },
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvProvider(mockRegistryProvider);

        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[0]), false, '1. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[1]), false, '2. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[2]), false, '3. Identified environment incorrectly');
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[3]), true, `4. Failed to identify conda environment when displayName starts with 'Anaconda'`);
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[4]), true, `5. Failed to identify conda environment when displayName contains text 'Anaconda'`);
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[5]), true, `6. Failed to identify conda environment when comanyDisplayName contains 'Continuum'`);
        assert.equal(condaProvider.isCondaEnvironment(registryInterpreters[6]), true, `7. Failed to identify conda environment when companyDisplayName starts with 'Continuum'`);
    });
    test('Correctly identifies latest version when major version is different', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1', version: '1' },
            { displayName: 'Two', path: pythonSettings.pythonPath, companyDisplayName: 'Two 2', version: '3.1.3' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: '2.10.1' },
            { displayName: 'Four', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: <any>null },
            { displayName: 'Five', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: <any>undefined },
            { displayName: 'Six', path: 'c:/path3/three.exe', companyDisplayName: 'xContinuum Analytics, Inc.', version: '2' },
            { displayName: 'Seven', path: 'c:/path3/three.exe', companyDisplayName: 'Continuum Analytics, Inc.' },
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvProvider(mockRegistryProvider);

        assert.equal(condaProvider.getLatestVersion(registryInterpreters)!.displayName, 'Two', 'Failed to identify latest version');
    });
    test('Correctly identifies latest version when major version is same', async () => {
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1', version: '1' },
            { displayName: 'Two', path: pythonSettings.pythonPath, companyDisplayName: 'Two 2', version: '2.11.0' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: '2.10.1' },
            { displayName: 'Four', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: <any>null },
            { displayName: 'Five', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: <any>undefined },
            { displayName: 'Six', path: 'c:/path3/three.exe', companyDisplayName: 'xContinuum Analytics, Inc.', version: '2.9.3' },
            { displayName: 'Seven', path: 'c:/path3/three.exe', companyDisplayName: 'Continuum Analytics, Inc.' },
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvProvider(mockRegistryProvider);

        assert.equal(condaProvider.getLatestVersion(registryInterpreters)!.displayName, 'Two', 'Failed to identify latest version');
    });
    test('Must use Conda env from Registry to locate conda.exe', async () => {
        const condaPythonExePath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments', 'windows', 'conda', 'python.exe');
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1', version: '1' },
            { displayName: 'Anaconda', path: condaPythonExePath, companyDisplayName: 'Two 2', version: '1.11.0' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3', version: '2.10.1' },
            { displayName: 'Seven', path: 'c:/path3/three.exe', companyDisplayName: 'Continuum Analytics, Inc.' },
        ];
        const mockRegistryProvider = new MockProvider(registryInterpreters);
        const condaProvider = new CondaEnvProvider(mockRegistryProvider);

        const condaExe = await condaProvider.getCondaFile();
        assert.equal(condaExe, path.join(path.dirname(condaPythonExePath), 'Scripts', 'conda.exe'), 'Failed to identify conda.exe');
    });
});
