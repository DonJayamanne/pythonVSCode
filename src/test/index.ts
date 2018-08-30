// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import { IS_CI_SERVER, IS_CI_SERVER_TEST_DEBUGGER,
         IS_MULTI_ROOT_TEST, IS_VSTS, MOCHA_CI_PROPERTIES,
         MOCHA_CI_REPORTFILE, MOCHA_REPORTER_JUNIT } from './constants';
import * as testRunner from './testRunner';

process.env.VSC_PYTHON_CI_TEST = '1';
process.env.IS_MULTI_ROOT_TEST = IS_MULTI_ROOT_TEST.toString();

// If running on CI server and we're running the debugger tests, then ensure we only run debug tests.
// We do this to ensure we only run debugger test, as debugger tests are very flaky on CI.
// So the solution is to run them separately and first on CI.
const grep = IS_CI_SERVER && IS_CI_SERVER_TEST_DEBUGGER ? 'Debug' : undefined;
const testFilesSuffix = process.env.TEST_FILES_SUFFIX;

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
// Hack, as retries is not supported as setting in tsd.
const options: testRunner.SetupOptions & { retries: number } = {
    ui: 'tdd',
    useColors: true,
    timeout: 25000,
    retries: 3,
    grep,
    testFilesSuffix
};

// VSTS CI doesn't display colours correctly (yet).
if (IS_VSTS) {
    options.useColors = false;
}

// CI can ask for a JUnit reporter if the environment variable
// 'MOCHA_REPORTER_JUNIT' is defined, further control is afforded
// by other 'MOCHA_CI_...' variables. See constants.ts for info.
if (MOCHA_REPORTER_JUNIT) {
    options.reporter = 'mocha-junit-reporter';
    options.reporterOptions = {
        mochaFile: MOCHA_CI_REPORTFILE,
        properties: MOCHA_CI_PROPERTIES
    };
}

testRunner.configure(options, { coverageConfig: '../coverconfig.json' });
module.exports = testRunner;
