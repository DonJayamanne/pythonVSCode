// import { initialize, setPythonExecutable } from '../initialize';
// import * as assert from 'assert';

// import * as settings from '../../client/common/configSettings';
// import { MockStatusBarItem } from '../mockClasses';
// import { InterpreterDisplay } from '../../client/interpreter/display';
// import { MockProvider } from './mocks';
// import * as path from 'path';
// import { EOL } from 'os';
// import * as utils from '../../client/common/utils';

// let pythonSettings = settings.PythonSettings.getInstance();
// const originalPythonPath = pythonSettings.pythonPath;
// let disposable = setPythonExecutable(pythonSettings);

// suite('Interpreters', () => {
//     suiteSetup(done => {
//         initialize()
//             .then(() => done())
//             .catch(() => done());
//     });
//     suiteTeardown(() => {
//         disposable.dispose();
//     });
//     teardown(() => {
//         pythonSettings.pythonPath = originalPythonPath;
//     });

//     test('Command name', () => {
//         const statusBar = new MockStatusBarItem();
//         new InterpreterDisplay(statusBar, new MockProvider([]));
//         assert.equal(statusBar.command, 'python.setInterpreter', 'Incorrect command name');
//     });
//     test('Display name for known interpreter', async () => {
//         const statusBar = new MockStatusBarItem();
//         const provider = new MockProvider([]);
//         const display = new InterpreterDisplay(statusBar, provider);
//         await display.refresh();
//         const pythonPath = pythonSettings.pythonPath;

//         const displayName = await getInterpreterDisplayName(pythonPath, '');
//         assert.equal(statusBar.text, displayName, 'Incorrect display name');
//     });
//     test('Display name for unknown interpreter', async () => {
//         const statusBar = new MockStatusBarItem();
//         const provider = new MockProvider([]);
//         const display = new InterpreterDisplay(statusBar, provider);
//         // Change interpreter to an invalid value
//         const pythonPath = pythonSettings.pythonPath = 'c:/some/unknonw/Python Interpreter.exe';
//         await display.refresh();

//         const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
//         const displayName = await getInterpreterDisplayName(pythonPath, defaultDisplayName);
//         assert.equal(statusBar.text, displayName, 'Incorrect display name');
//     });
//     test('Display name from list of interpreters', async () => {
//         const statusBar = new MockStatusBarItem();
//         const interpreters = [
//             { name: 'One', path: 'c:/path1/one.exe', type: 'One 1' },
//             { name: 'Two', path: pythonSettings.pythonPath, type: 'Two 2' },
//             { name: 'Three', path: 'c:/path3/three.exe', type: 'Three 3' },
//         ];
//         const provider = new MockProvider(interpreters);
//         const display = new InterpreterDisplay(statusBar, provider);
//         // Change interpreter to an invalid value
//         pythonSettings.pythonPath = 'c:/some/unknonw/Python Interpreter.exe';
//         await display.refresh();

//         assert.equal(statusBar.text, '$(alert) Select Python Environment', 'Incorrect display name');
//     });
//     test('Suggest setting interpreter', async () => {
//         const statusBar = new MockStatusBarItem();
//         const interpreters = [
//             { name: 'One', path: 'c:/path1/one.exe', type: 'One 1' },
//             { name: 'Two', path: pythonSettings.pythonPath, type: 'Two 2' },
//             { name: 'Three', path: 'c:/path3/three.exe', type: 'Three 3' },
//         ];
//         const provider = new MockProvider(interpreters);
//         const display = new InterpreterDisplay(statusBar, provider);
//         await display.refresh();

//         assert.equal(statusBar.text, interpreters[1].name, 'Incorrect display name');
//         assert.equal(statusBar.tooltip, `${pythonSettings.pythonPath}${EOL}${interpreters[1].type}`, 'Incorrect tooltip');
//     });
// });

// async function getInterpreterDisplayName(pythonPath: string, defaultValue: string) {
//     return utils.execPythonFile(pythonPath, ['--version'], __dirname, true)
//         .then(version => {
//             version = version.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0).join('');
//             return version.length > 0 ? version : defaultValue;
//         })
//         .catch(() => defaultValue);
// }

