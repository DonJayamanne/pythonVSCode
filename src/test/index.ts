import { initializePython, IS_MULTI_ROOT_TEST } from './initialize';
const testRunner = require('vscode/lib/testrunner');

const singleWorkspaceTestConfig = {
    ui: 'tdd',
    useColors: true,
    timeout: 25000,
    grep: 'Unit Tests',
    // invert: 'invert'
};
const multiWorkspaceTestConfig = {
    ui: 'tdd',
    useColors: true,
    timeout: 25000,
    grep: 'Unit Tests',
    // invert: 'invert'
};

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
testRunner.configure(IS_MULTI_ROOT_TEST ? multiWorkspaceTestConfig : singleWorkspaceTestConfig);
module.exports = testRunner;
