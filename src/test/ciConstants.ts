// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

//
// Constants that pertain to CI processes/tests only. No dependencies on vscode!
//
const IS_VSTS = process.env.TF_BUILD !== undefined;
const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
export const IS_CI_SERVER = IS_VSTS || IS_GITHUB_ACTIONS;

export const IS_CI_SERVER_TEST_DEBUGGER = process.env.IS_CI_SERVER_TEST_DEBUGGER === '1';
