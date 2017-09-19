import { initialize, setPythonExecutable } from '../initialize';
import * as assert from 'assert';
import * as path from 'path';
import { IS_WINDOWS } from '../../client/common/utils';
import { CondaEnvProvider } from '../../client/interpreter/sources/condaEnvProvider';
import * as settings from '../../client/common/configSettings';

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
        assert.equal(interpreters[0].displayName, 'Anaconda (temp)', 'Incorrect display name for first env');
        assert.equal(interpreters[0].companyDisplayName, 'Continuum Analytics, Inc.', 'Incorrect company display name for first env');
    });
});
