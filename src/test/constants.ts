// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
// import { IS_APPVEYOR, IS_CI_SERVER, IS_CI_SERVER_TEST_DEBUGGER,
//     IS_TRAVIS, IS_VSTS, MOCHA_CI_PROPERTIES, MOCHA_CI_REPORTFILE,
//     MOCHA_REPORTER_JUNIT } from './ciConstants';
import { IS_CI_SERVER, IS_CI_SERVER_TEST_DEBUGGER, IS_TRAVIS } from './ciConstants';

export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();

// If running on CI server, then run debugger tests ONLY if the corresponding flag is enabled.
export const TEST_DEBUGGER = IS_CI_SERVER ? IS_CI_SERVER_TEST_DEBUGGER : true;

// export { IS_APPVEYOR, IS_CI_SERVER, IS_CI_SERVER_TEST_DEBUGGER,
//     IS_TRAVIS, IS_VSTS, MOCHA_CI_PROPERTIES, MOCHA_CI_REPORTFILE,
//     MOCHA_REPORTER_JUNIT };

function isMultitrootTest() {
    return Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1;
}

export const IsAnalysisEngineTest = () =>
    !IS_TRAVIS && (process.env.VSC_PYTHON_ANALYSIS === '1' || !PythonSettings.getInstance().jediEnabled);
