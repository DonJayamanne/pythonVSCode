import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../client/common/platform/types';
import { ILogger, IPersistentStateFactory } from '../../client/common/types';
import { ICondaService, IInterpreterLocatorService, IInterpreterVersionService, InterpreterType } from '../../client/interpreter/contracts';
import { AnacondaCompanyName, AnacondaCompanyNames, AnacondaDisplayName } from '../../client/interpreter/locators/services/conda';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import { IServiceContainer } from '../../client/ioc/types';
import { initialize, initializeTest } from '../initialize';
import { MockState } from './mocks';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const environmentsFilePath = path.join(environmentsPath, 'environments.txt');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Conda Environments Text File', () => {
    let logger: TypeMoq.IMock<ILogger>;
    let condaService: TypeMoq.IMock<ICondaService>;
    let interpreterVersion: TypeMoq.IMock<IInterpreterVersionService>;
    let condaFileProvider: IInterpreterLocatorService;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    suiteSetup(initialize);
    setup(async () => {
        await initializeTest();
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => state);

        condaService = TypeMoq.Mock.ofType<ICondaService>();
        interpreterVersion = TypeMoq.Mock.ofType<IInterpreterVersionService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        logger = TypeMoq.Mock.ofType<ILogger>();
        condaFileProvider = new CondaEnvFileService(interpreterVersion.object, condaService.object, fileSystem.object, serviceContainer.object, logger.object);
    });
    test('Must return an empty list if environment file cannot be found', async () => {
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => undefined);
        interpreterVersion.setup(i => i.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('Mock Name'));
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return an empty list for an empty file', async () => {
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.readFile(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(''));
        interpreterVersion.setup(i => i.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('Mock Name'));
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });

    async function filterFilesInEnvironmentsFileAndReturnValidItems(isWindows: boolean) {
        const validPaths = [
            path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join(environmentsPath, 'conda', 'envs', 'scipy')];
        const interpreterPaths = [
            path.join(environmentsPath, 'xyz', 'one'),
            path.join(environmentsPath, 'xyz', 'two'),
            path.join(environmentsPath, 'xyz', 'python.exe')
        ].concat(validPaths);
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
            return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
        });
        condaService.setup(c => c.getCondaEnvironments(TypeMoq.It.isAny())).returns(() => {
            const condaEnvironments = validPaths.map(item => {
                return {
                    path: item,
                    name: path.basename(item)
                };
            });
            return Promise.resolve(condaEnvironments);
        });
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p1: string, p2: string) => isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase());
        validPaths.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });

        fileSystem.setup(fs => fs.readFile(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(interpreterPaths.join(EOL)));
        interpreterVersion.setup(i => i.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('Mock Name'));

        const interpreters = await condaFileProvider.getInterpreters();

        const expectedPythonPath = isWindows ? path.join(validPaths[0], 'python.exe') : path.join(validPaths[0], 'bin', 'python');
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');
        assert.equal(interpreters[0].displayName, `${AnacondaDisplayName} Mock Name (numpy)`, 'Incorrect display name');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect display name');
        assert.equal(interpreters[0].path, expectedPythonPath, 'Incorrect path');
        assert.equal(interpreters[0].envPath, validPaths[0], 'Incorrect envpath');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Incorrect type');
    }
    test('Must filter files in the list and return valid items (non windows)', async () => {
        await filterFilesInEnvironmentsFileAndReturnValidItems(false);
    });
    test('Must filter files in the list and return valid items (windows)', async () => {
        await filterFilesInEnvironmentsFileAndReturnValidItems(true);
    });

    test('Must strip company name from version info', async () => {
        const interpreterPaths = [
            path.join(environmentsPath, 'conda', 'envs', 'numpy')
        ];
        const pythonPath = path.join(interpreterPaths[0], 'pythonPath');
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(() => pythonPath);
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.readFile(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(interpreterPaths.join(EOL)));

        for (const companyName of AnacondaCompanyNames) {
            const versionWithCompanyName = `Mock Version :: ${companyName}`;
            interpreterVersion.setup(c => c.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(versionWithCompanyName));
            const interpreters = await condaFileProvider.getInterpreters();

            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            assert.equal(interpreters[0].displayName, `${AnacondaDisplayName} Mock Version`, 'Incorrect display name');
        }
    });
});
