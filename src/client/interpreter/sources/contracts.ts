import { PythonInterpreter } from "../index";
import { Architecture } from "../../common/registry";

export interface IInterpreterProvider {
    getInterpreters(): Promise<PythonInterpreter[]>;
}
export interface PythonInterpreter {
    path: string;
    companyDisplayName?: string;
    displayName?: string;
    version?: string;
    architecture?: Architecture;
}
