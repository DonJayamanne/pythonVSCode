import { initialize, setPythonExecutable } from '../initialize';

import * as assert from 'assert';
import * as child_process from 'child_process';
import * as settings from '../../client/common/configSettings';
import * as path from 'path';
import * as utils from '../../client/common/utils';
import { MockStatusBarItem } from '../mockClasses';
import { MockInterpreterVersionProvider } from './mocks';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { MockProvider, MockVirtualEnv } from './mocks';
import { EOL } from 'os';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';

let pythonSettings = settings.PythonSettings.getInstance();
const originalPythonPath = pythonSettings.pythonPath;
let disposable = setPythonExecutable(pythonSettings);

suite('Interpreters Display', () => {
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

    test('Must have command name', () => {
        const statusBar = new MockStatusBarItem();
        const displayNameProvider = new MockInterpreterVersionProvider('');
        new InterpreterDisplay(statusBar, new MockProvider([]), new VirtualEnvironmentManager([]), displayNameProvider);
        assert.equal(statusBar.command, 'python.setInterpreter', 'Incorrect command name');
    });
    test('Must get display name from interpreter itself', async () => {
        const statusBar = new MockStatusBarItem();
        const provider = new MockProvider([]);
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, displayName, 'Incorrect display name');
    });
    test('Must suffix display name with name of interpreter', async () => {
        const statusBar = new MockStatusBarItem();
        const provider = new MockProvider([]);
        const env1 = new MockVirtualEnv(false, 'Mock 1');
        const env2 = new MockVirtualEnv(true, 'Mock 2');
        const env3 = new MockVirtualEnv(true, 'Mock 3');
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([env1, env2, env3]), displayNameProvider);
        await display.refresh();
        assert.equal(statusBar.text, `${displayName} (${env2.name})`, 'Incorrect display name');
    });
    test(`Must display default 'Display name' for unknown interpreter`, async () => {
        const statusBar = new MockStatusBarItem();
        const provider = new MockProvider([]);
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName, true);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        // Change interpreter to an invalid value
        const pythonPath = pythonSettings.pythonPath = 'c:/some/unknonw/Python Interpreter.exe';
        await display.refresh();

        const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
        assert.equal(statusBar.text, defaultDisplayName, 'Incorrect display name');
    });
    test('Must get display name from a list of interpreters', async () => {
        const pythonPath = await new Promise<string>(resolve => {
            child_process.execFile(pythonSettings.pythonPath, ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).then(value => value.length === 0 ? pythonSettings.pythonPath : value);
        const statusBar = new MockStatusBarItem();
        const interpreters = [
            { displayName: 'One', path: 'c:/path1/one.exe', type: 'One 1' },
            { displayName: 'Two', path: pythonPath, type: 'Two 2' },
            { displayName: 'Three', path: 'c:/path3/three.exe', type: 'Three 3' },
        ];
        const provider = new MockProvider(interpreters);
        const displayName = 'Mock Display Name';
        const displayNameProvider = new MockInterpreterVersionProvider(displayName, true);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, interpreters[1].displayName, 'Incorrect display name');
    });
    test('Must suffix tooltip with the companyDisplayName of interpreter', async () => {
        const pythonPath = await new Promise<string>(resolve => {
            child_process.execFile(pythonSettings.pythonPath, ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).then(value => value.length === 0 ? pythonSettings.pythonPath : value);

        const statusBar = new MockStatusBarItem();
        const interpreters = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1' },
            { displayName: 'Two', path: pythonPath, companyDisplayName: 'Two 2' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
        ];
        const provider = new MockProvider(interpreters);
        const displayNameProvider = new MockInterpreterVersionProvider('');
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, interpreters[1].displayName, 'Incorrect display name');
        assert.equal(statusBar.tooltip, `${pythonPath}${EOL}${interpreters[1].companyDisplayName}`, 'Incorrect tooltip');
    });
    test('Will update status prompting user to select an interpreter', async () => {
        const statusBar = new MockStatusBarItem();
        const interpreters = [
            { displayName: 'One', path: 'c:/path1/one.exe', companyDisplayName: 'One 1' },
            { displayName: 'Two', path: 'c:/asdf', companyDisplayName: 'Two 2' },
            { displayName: 'Three', path: 'c:/path3/three.exe', companyDisplayName: 'Three 3' },
        ];
        const provider = new MockProvider(interpreters);
        const displayNameProvider = new MockInterpreterVersionProvider('', true);
        const display = new InterpreterDisplay(statusBar, provider, new VirtualEnvironmentManager([]), displayNameProvider);
        // Change interpreter to an invalid value
        pythonSettings.pythonPath = 'c:/some/unknonw/Python Interpreter.exe';
        await display.refresh();

        assert.equal(statusBar.text, '$(alert) Select Python Environment', 'Incorrect display name');
    });
});

async function getInterpreterDisplayName(pythonPath: string, defaultValue: string) {
    return utils.execPythonFile(pythonPath, ['--version'], __dirname, true)
        .then(version => {
            version = version.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0).join('');
            return version.length > 0 ? version : defaultValue;
        })
        .catch(() => defaultValue);
}

