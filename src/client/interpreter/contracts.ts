import { Architecture } from "../common/registry";

export interface IInterpreterLocatorService {
    getInterpreters(): Promise<PythonInterpreter[]>;
}
export interface PythonInterpreter {
    path: string;
    companyDisplayName?: string;
    displayName?: string;
    version?: string;
    architecture?: Architecture;
}
