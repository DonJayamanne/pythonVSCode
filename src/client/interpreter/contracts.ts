import { Architecture } from '../common/registry';
export interface PythonInterpreter {
    path: string;
    companyDisplayName?: string;
    displayName?: string;
    version?: string;
    architecture?: Architecture;
}

export interface PythonPathSuggestion {
    name: string; // myenvname
    path: string;  // /full/path/to/bin/python
    type: string;   // conda
}
