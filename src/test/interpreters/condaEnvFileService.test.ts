import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import { initialize } from '../initialize';
import { MockInterpreterVersionProvider } from './mocks';
import { CondaEnvFileProvider } from '../../client/interpreter/locators/services/condaEnvFileService';
import { AnacondaDisplayName, AnacondaCompanyName, CONDA_RELATIVE_PY_PATH, } from '../../client/interpreter/locators/services/conda';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const environmentsFilePath = path.join(environmentsPath, 'environments.txt');

suite('Interpreters from Conda Environments Text File', () => {
    suiteSetup(done => {
        initialize()
            .then(() => done())
            .catch(() => done());
    });
    suiteTeardown(async () => {
        // Clear the file so we don't get unwanted changes prompting for a checkin of this file
        await updateEnvWithInterpreters([]);
    });

    async function updateEnvWithInterpreters(envs: string[]) {
        await fs.writeFile(environmentsFilePath, envs.join(EOL), { flag: 'w' });
    }
    test('Must return an empty list for an empty file', async () => {
        await updateEnvWithInterpreters([]);
        const displayNameProvider = new MockInterpreterVersionProvider('Mock Name');
        const condaFileProvider = new CondaEnvFileProvider(environmentsFilePath, displayNameProvider);
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return filter files in the list and return valid items', async () => {
        const interpreterPaths = [
            path.join(environmentsPath, 'path1'),
            path.join('Invalid and non existent'),
            path.join(environmentsPath, 'path2'),
            path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join('Another Invalid and non existent')
        ];
        await updateEnvWithInterpreters(interpreterPaths);
        const displayNameProvider = new MockInterpreterVersionProvider('Mock Name');
        const condaFileProvider = new CondaEnvFileProvider(environmentsFilePath, displayNameProvider);
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 3, 'Incorrect number of entries');
        assert.equal(interpreters[0].displayName, `${AnacondaDisplayName} Mock Name (path1)`, 'Incorrect display name');
        assert.equal(interpreters[1].companyDisplayName, AnacondaCompanyName, 'Incorrect display name');
        assert.equal(interpreters[1].path, path.join(interpreterPaths[2], ...CONDA_RELATIVE_PY_PATH), 'Incorrect company display name');
    });
});
