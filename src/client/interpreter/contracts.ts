import { Disposable, Event, Uri } from 'vscode';
import { GetInterpreterLocatorOptions } from '../pythonEnvironments/discovery/locators/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
// import { GetInterpreterOptions } from './interpreterService';
// import * as apiTypes from '../api/types';
export * from '../api/types';

export const INTERPRETER_LOCATOR_SERVICE = 'IInterpreterLocatorService';

export const IInterpreterLocatorService = Symbol('IInterpreterLocatorService');

export interface IInterpreterLocatorService extends Disposable {
    readonly onLocating: Event<Promise<PythonEnvironment[]>>;
    readonly hasInterpreters: Promise<boolean>;
    didTriggerInterpreterSuggestions?: boolean;
    getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]>;
}

// export const IInterpreterService =apiTypes.IExtensionActivationManager;
// export interface IInterpreterService {

// }
