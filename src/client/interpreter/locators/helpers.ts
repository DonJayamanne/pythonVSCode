import { PythonInterpreter } from "../contracts";
import { IS_WINDOWS, fsReaddirAsync } from "../../common/utils";
import * as path from 'path';
import { getArchitectureDislayName } from "../../common/registry";

const CheckPythonInterpreterRegEx = IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

export function lookForInterpretersInDirectory(pathToCheck: string): Promise<string[]> {
    return fsReaddirAsync(pathToCheck)
        .then(subDirs => subDirs.filter(fileName => CheckPythonInterpreterRegEx.test(path.basename(fileName))));
}

export function fixInterpreterDisplayName(item: PythonInterpreter) {
    if (!item.displayName) {
        const arch = getArchitectureDislayName(item.architecture);
        const version = item.version || '';
        item.displayName = ['Python', version, arch].filter(item => item.length > 0).join(' ').trim();
    }
    return item;
}
export function fixInterpreterPath(item: PythonInterpreter) {
    // For some reason anaconda seems to use \\ in the registry path
    item.path = IS_WINDOWS ? item.path.replace(/\\\\/g, "\\") : item.path;
    // Also ensure paths have back slashes instead of forward
    item.path = IS_WINDOWS ? item.path.replace(/\//g, "\\") : item.path;
    return item;
}
