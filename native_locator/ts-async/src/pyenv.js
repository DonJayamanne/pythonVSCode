"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyEnv = exports.listPyenvEnvironments = exports.getBinaryFromKnownPaths = exports.getHomePyenvDir = void 0;
const fs = require("fs");
const path = require("path");
const os_1 = require("os");
const messaging_1 = require("./messaging");
const utils_1 = require("./utils");
const known_1 = require("./known");
function getHomePyenvDir() {
    const home = (0, os_1.homedir)();
    if (home) {
        return path.join(home, '.pyenv');
    }
}
exports.getHomePyenvDir = getHomePyenvDir;
function getBinaryFromKnownPaths() {
    const knownPaths = (0, known_1.getKnowGlobalSearchLocations)();
    for (const knownPath of knownPaths) {
        const bin = path.join(knownPath, 'pyenv');
        if (fs.existsSync(bin)) {
            return bin;
        }
    }
}
exports.getBinaryFromKnownPaths = getBinaryFromKnownPaths;
function getPyenvDir() {
    const pyenvRoot = process.env.PYENV_ROOT;
    if (pyenvRoot) {
        return pyenvRoot;
    }
    const pyenv = process.env.PYENV;
    if (pyenv) {
        return pyenv;
    }
    return getHomePyenvDir();
}
function getPyenvBinary() {
    const dir = getPyenvDir();
    if (dir) {
        const exe = path.join(dir, 'bin', 'pyenv');
        if (fs.existsSync(exe)) {
            return exe;
        }
    }
    return getBinaryFromKnownPaths();
}
function getPyenvVersion(folderName) {
    const pythonRegex = /^(\d+\.\d+\.\d+)$/;
    const match = pythonRegex.exec(folderName);
    if (match) {
        return match[1];
    }
    const devRegex = /^(\d+\.\d+-dev)$/;
    const devMatch = devRegex.exec(folderName);
    if (devMatch) {
        return devMatch[1];
    }
    const alphaRegex = /^(\d+\.\d+.\d+\w\d+)/;
    const alphaMatch = alphaRegex.exec(folderName);
    if (alphaMatch) {
        return alphaMatch[1];
    }
}
function getPurePythonEnvironment(executable, folderPath, manager) {
    const version = getPyenvVersion(path.basename(folderPath));
    if (version) {
        return {
            python_executable_path: executable,
            category: messaging_1.PythonEnvironmentCategory.Pyenv,
            version,
            env_path: folderPath,
            sys_prefix_path: folderPath,
            env_manager: manager,
            python_run_command: [executable],
        };
    }
}
function getVirtualEnvEnvironment(executable, folderPath, manager) {
    const pyenvCfg = (0, utils_1.findAndParsePyvenvCfg)(executable);
    if (pyenvCfg) {
        const folderName = path.basename(folderPath);
        return {
            name: folderName,
            python_executable_path: executable,
            category: messaging_1.PythonEnvironmentCategory.PyenvVirtualEnv,
            version: pyenvCfg.version,
            env_path: folderPath,
            sys_prefix_path: folderPath,
            env_manager: manager,
            python_run_command: [executable],
        };
    }
}
function listPyenvEnvironments(manager) {
    const pyenvDir = getPyenvDir();
    if (!pyenvDir) {
        return;
    }
    const envs = [];
    const versionsDir = path.join(pyenvDir, 'versions');
    try {
        const entries = fs.readdirSync(versionsDir);
        for (const entry of entries) {
            const folderPath = path.join(versionsDir, entry);
            const stats = fs.statSync(folderPath);
            if (stats.isDirectory()) {
                const executable = (0, utils_1.findPythonBinaryPath)(folderPath);
                if (executable) {
                    const purePythonEnv = getPurePythonEnvironment(executable, folderPath, manager);
                    if (purePythonEnv) {
                        envs.push(purePythonEnv);
                    }
                    else {
                        const virtualEnv = getVirtualEnvEnvironment(executable, folderPath, manager);
                        if (virtualEnv) {
                            envs.push(virtualEnv);
                        }
                    }
                }
            }
        }
    }
    catch (error) {
        console.error(`Failed to read directory: ${versionsDir}`);
    }
    return envs;
}
exports.listPyenvEnvironments = listPyenvEnvironments;
class PyEnv {
    resolve(_env) {
        return undefined;
    }
    find() {
        const pyenvBinary = getPyenvBinary();
        if (!pyenvBinary) {
            return undefined;
        }
        const manager = { executable_path: pyenvBinary, tool: messaging_1.EnvManagerType.Pyenv };
        const environments = [];
        const envs = listPyenvEnvironments(manager);
        if (envs) {
            environments.push(...envs);
        }
        if (environments.length === 0) {
            return { managers: [manager] };
        }
        return { environments };
    }
}
exports.PyEnv = PyEnv;
//# sourceMappingURL=pyenv.js.map