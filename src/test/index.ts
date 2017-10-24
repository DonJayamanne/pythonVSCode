import { initializePython, IS_MULTI_ROOT_TEST } from './initialize';
const testRunner = require('vscode/lib/testrunner');
process.env['VSC_PYTHON_CI_TEST'] = '1';

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
testRunner.configure({
    ui: 'tdd',
    useColors: true,
    timeout: 25000
});
module.exports = testRunner;
