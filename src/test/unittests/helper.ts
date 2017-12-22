// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { Tests } from '../../client/unittests/common/types';

export function lookForTestFile(tests: Tests, testFile: string) {
    let found: boolean;
    // Perform case insensitive search on windows.
    if (IS_WINDOWS) {
        found = tests.testFiles.some(t => t.name.toUpperCase() === testFile.toUpperCase() && t.nameToRun.toUpperCase() === t.name.toUpperCase());
    } else {
        found = tests.testFiles.some(t => t.name === testFile && t.nameToRun === t.name);
    }
    assert.equal(found, true, `Test File not found '${testFile}'`);
}
