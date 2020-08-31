// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IPersistentState, Resource } from '../../common/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';

export enum AutoSelectionRule {
    all = 'all',
    currentPath = 'currentPath',
    workspaceVirtualEnvs = 'workspaceEnvs',
    settings = 'settings',
    cachedInterpreters = 'cachedInterpreters',
    systemWide = 'system',
    windowsRegistry = 'windowsRegistry'
}

export const IInterpreterAutoSelectionRule = Symbol('IInterpreterAutoSelectionRule');
export interface IInterpreterAutoSelectionRule {
    setNextRule(rule: IInterpreterAutoSelectionRule): void;
    getPreviouslyAutoSelectedInterpreter(resource: Resource): PythonEnvironment | undefined;
}

export const IInterpreterSecurityService = Symbol('IInterpreterSecurityService');
export interface IInterpreterSecurityService {
    readonly onDidChangeSafeInterpreters: Event<void>;
    evaluateAndRecordInterpreterSafety(interpreter: PythonEnvironment, resource: Resource): Promise<void>;
    isSafe(interpreter: PythonEnvironment, resource?: Resource): boolean | undefined;
}

export const IInterpreterSecurityStorage = Symbol('IInterpreterSecurityStorage');
export interface IInterpreterSecurityStorage extends IExtensionSingleActivationService {
    readonly unsafeInterpreterPromptEnabled: IPersistentState<boolean>;
    readonly unsafeInterpreters: IPersistentState<string[]>;
    readonly safeInterpreters: IPersistentState<string[]>;
    hasUserApprovedWorkspaceInterpreters(resource: Uri): IPersistentState<boolean | undefined>;
    storeKeyForWorkspace(resource: Uri): Promise<void>;
}

export const IInterpreterEvaluation = Symbol('IInterpreterEvaluation');
export interface IInterpreterEvaluation {
    evaluateIfInterpreterIsSafe(interpreter: PythonEnvironment, resource: Resource): Promise<boolean>;
    inferValueUsingCurrentState(interpreter: PythonEnvironment, resource: Resource): boolean | undefined;
}
