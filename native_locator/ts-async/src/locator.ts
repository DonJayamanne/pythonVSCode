import { EnvManager, PythonEnvironment } from './messaging';
import { PythonEnv } from './utils';

export interface LocatorResult {
    managers?: EnvManager[];
    environments?: PythonEnvironment[];
}

export interface Locator {
    /**
     * Given a Python environment, this will convert it to a PythonEnvironment that can be supported by this locator.
     * If an environment is not supported by this locator, this will return undefined.
     *
     * I.e. use this to test whether an environment is of a specific type.
     */
    resolve(env: PythonEnv): PythonEnvironment | undefined;
    /**
     * Finds all environments specific to this locator.
     */
    find(): Promise<LocatorResult | undefined>;
}
