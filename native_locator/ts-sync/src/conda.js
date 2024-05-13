"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.find = exports.isPythonCondaEnv = void 0;
const path = require("path");
const fs = require("fs");
const os_1 = require("os");
const known_1 = require("./known");
const messaging_1 = require("./messaging");
const utils_1 = require("./utils");
function getCondaMetaPath(anyPath) {
    if (anyPath.endsWith('bin/python')) {
        const parent = path.dirname(anyPath);
        const grandParent = path.dirname(parent);
        return path.join(grandParent, 'conda-meta');
    }
    else if (anyPath.endsWith('bin')) {
        const parent = path.dirname(anyPath);
        return path.join(parent, 'conda-meta');
    }
    else {
        return path.join(anyPath, 'conda-meta');
    }
}
function isCondaEnvironment(anyPath) {
    const condaMetaPath = getCondaMetaPath(anyPath);
    return condaMetaPath !== undefined && fs.existsSync(condaMetaPath);
}
function getVersionFromMetaJson(jsonFile) {
    const fileName = path.basename(jsonFile);
    const regex = /([\d\w\-]*)-([\d\.]*)-.*\.json/;
    const match = fileName.match(regex);
    return match ? match[2] : undefined;
}
function getCondaPackageJsonPath(anyPath, packageName) {
    const packagePrefix = `${packageName}-`;
    const condaMetaPath = getCondaMetaPath(anyPath);
    const entries = fs.readdirSync(condaMetaPath);
    for (const entry of entries) {
        const filePath = path.join(condaMetaPath, entry);
        const fileName = path.basename(filePath);
        if (fileName.startsWith(packagePrefix) && fileName.endsWith('.json')) {
            return filePath;
        }
    }
    return undefined;
}
function isPythonCondaEnv(anyPath) {
    const condaPythonJsonPath = getCondaPackageJsonPath(anyPath, 'python');
    return condaPythonJsonPath !== undefined && fs.existsSync(condaPythonJsonPath);
}
exports.isPythonCondaEnv = isPythonCondaEnv;
function getCondaPythonVersion(anyPath) {
    const condaPythonJsonPath = getCondaPackageJsonPath(anyPath, 'python');
    return condaPythonJsonPath ? getVersionFromMetaJson(condaPythonJsonPath) : undefined;
}
function getCondaBinNames() {
    return process.platform === 'win32' ? ['conda.exe', 'conda.bat'] : ['conda'];
}
function findCondaBinaryOnPath() {
    var _a;
    const paths = ((_a = process.env.PATH) === null || _a === void 0 ? void 0 : _a.split(path.delimiter)) || [];
    const condaBinNames = getCondaBinNames();
    for (const pathEntry of paths) {
        for (const binName of condaBinNames) {
            const condaPath = path.join(pathEntry, binName);
            try {
                const stats = fs.statSync(condaPath);
                if (stats.isFile() || stats.isSymbolicLink()) {
                    return condaPath;
                }
            }
            catch (error) {
            }
        }
    }
    return undefined;
}
function getKnownCondaLocations() {
    const knownPaths = [
        '/opt/anaconda3/bin',
        '/opt/miniconda3/bin',
        '/usr/local/anaconda3/bin',
        '/usr/local/miniconda3/bin',
        '/usr/anaconda3/bin',
        '/usr/miniconda3/bin',
        '/home/anaconda3/bin',
        '/home/miniconda3/bin',
        '/anaconda3/bin',
        '/miniconda3/bin',
    ];
    const home = (0, os_1.homedir)();
    if (home) {
        knownPaths.push(path.join(home, 'anaconda3/bin'));
        knownPaths.push(path.join(home, 'miniconda3/bin'));
    }
    knownPaths.push(...(0, known_1.getKnowGlobalSearchLocations)());
    return knownPaths;
}
function findCondaBinaryInKnownLocations() {
    const condaBinNames = getCondaBinNames();
    const knownLocations = getKnownCondaLocations();
    for (const location of knownLocations) {
        for (const binName of condaBinNames) {
            const condaPath = path.join(location, binName);
            try {
                const stats = fs.statSync(condaPath);
                if (stats.isFile() || stats.isSymbolicLink()) {
                    return condaPath;
                }
            }
            catch (error) {
            }
        }
    }
    return undefined;
}
function findCondaBinary() {
    const condaBinaryOnPath = findCondaBinaryOnPath();
    return condaBinaryOnPath || findCondaBinaryInKnownLocations();
}
function getCondaVersion(condaBinary) {
    let parent = path.dirname(condaBinary);
    if (parent.endsWith('bin')) {
        parent = path.dirname(parent);
    }
    if (parent.endsWith('Library')) {
        parent = path.dirname(parent);
    }
    const condaPythonJsonPath = getCondaPackageJsonPath(parent, 'conda') || getCondaPackageJsonPath(path.dirname(parent), 'conda');
    return condaPythonJsonPath ? getVersionFromMetaJson(condaPythonJsonPath) : undefined;
}
function getCondaEnvsFromEnvironmentTxt() {
    const envs = [];
    const home = process.env.USERPROFILE;
    if (home) {
        const environmentTxt = path.join(home, '.conda', 'environments.txt');
        try {
            const content = fs.readFileSync(environmentTxt, 'utf-8');
            envs.push(...content.split('\n'));
        }
        catch (error) {
        }
    }
    return envs;
}
function getKnownEnvLocations(condaBin) {
    const paths = [];
    const home = process.env.USERPROFILE;
    if (home) {
        const condaEnvs = path.join(home, '.conda', 'envs');
        paths.push(condaEnvs);
    }
    const parent = path.dirname(condaBin);
    if (parent) {
        paths.push(parent);
        const condaEnvs = path.join(parent, 'envs');
        paths.push(condaEnvs);
        const grandParent = path.dirname(parent);
        if (grandParent) {
            paths.push(grandParent);
            paths.push(path.join(grandParent, 'envs'));
        }
    }
    return paths;
}
function getCondaEnvsFromKnownEnvLocations(condaBin) {
    const envs = [];
    const locations = getKnownEnvLocations(condaBin);
    for (const location of locations) {
        if (isCondaEnvironment(location)) {
            envs.push(location);
        }
        try {
            const entries = fs.readdirSync(location);
            for (const entry of entries) {
                const entryPath = path.join(location, entry);
                const stats = fs.statSync(entryPath);
                if (stats.isDirectory() && isCondaEnvironment(entryPath)) {
                    envs.push(entryPath);
                }
            }
        }
        catch (error) {
        }
    }
    return envs;
}
function getDistinctCondaEnvs(condaBin) {
    const envs = getCondaEnvsFromEnvironmentTxt().concat(getCondaEnvsFromKnownEnvLocations(condaBin));
    envs.sort();
    const distinctEnvs = [];
    const locations = getKnownEnvLocations(condaBin);
    for (const env of envs) {
        let named = false;
        let name = '';
        for (const location of locations) {
            const envPath = path.resolve(env);
            const locationPath = path.resolve(location);
            if (envPath.startsWith(locationPath)) {
                named = true;
                name = path.relative(locationPath, envPath) || 'base';
                break;
            }
        }
        distinctEnvs.push({ named, name, path: env });
    }
    return distinctEnvs;
}
function find() {
    const condaBinary = findCondaBinary();
    if (!condaBinary) {
        return undefined;
    }
    const condaVersion = getCondaVersion(condaBinary);
    const manager = {
        executable_path: condaBinary,
        version: condaVersion,
        tool: messaging_1.EnvManagerType.Conda,
    };
    const envs = getDistinctCondaEnvs(condaBinary);
    if (envs.length === 0) {
        return { managers: [manager] };
    }
    else {
        const environments = [];
        for (const env of envs) {
            const python_executable_path = (0, utils_1.findPythonBinaryPath)(env.path);
            const environment = {
                name: env.name,
                env_path: env.path,
                python_executable_path,
                category: messaging_1.PythonEnvironmentCategory.Conda,
                version: getCondaPythonVersion(env.path),
                env_manager: manager,
                python_run_command: env.named
                    ? [condaBinary, 'run', '-n', env.name, 'python']
                    : [condaBinary, 'run', '-p', env.path, 'python'],
            };
            environments.push(environment);
        }
        return { environments };
    }
}
exports.find = find;
//# sourceMappingURL=conda.js.map