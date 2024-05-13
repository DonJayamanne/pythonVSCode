"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPythonEnvironments = exports.findPythonBinaryPath = exports.getVersion = exports.findAndParsePyvenvCfg = exports.findPyvenvConfigPath = exports.PyEnvCfg = exports.PythonEnv = void 0;
const fs = require("fs");
const path = require("path");
class PythonEnv {
    constructor(executable, envPath, version) {
        this.executable = executable;
        this.path = envPath;
        this.version = version;
    }
}
exports.PythonEnv = PythonEnv;
class PyEnvCfg {
    constructor(version) {
        this.version = version;
    }
}
exports.PyEnvCfg = PyEnvCfg;
const PYVENV_CONFIG_FILE = 'pyvenv.cfg';
function findPyvenvConfigPath(pythonExecutable) {
    const cfg = path.join(path.dirname(pythonExecutable), PYVENV_CONFIG_FILE);
    if (fs.existsSync(cfg)) {
        return cfg;
    }
    const cfg2 = path.join(path.dirname(path.dirname(pythonExecutable)), PYVENV_CONFIG_FILE);
    if (fs.existsSync(cfg2)) {
        return cfg2;
    }
    return undefined;
}
exports.findPyvenvConfigPath = findPyvenvConfigPath;
function findAndParsePyvenvCfg(pythonExecutable) {
    const cfgPath = findPyvenvConfigPath(pythonExecutable);
    if (!cfgPath || !fs.existsSync(cfgPath)) {
        return undefined;
    }
    const contents = fs.readFileSync(cfgPath, 'utf8');
    const versionRegex = /^version\s*=\s*(\d+\.\d+\.\d+)$/m;
    const versionInfoRegex = /^version_info\s*=\s*(\d+\.\d+\.\d+.*)$/m;
    for (const line of contents.split('\n')) {
        if (!line.includes('version')) {
            continue;
        }
        const versionMatch = line.match(versionRegex);
        if (versionMatch && versionMatch[1]) {
            return new PyEnvCfg(versionMatch[1]);
        }
        const versionInfoMatch = line.match(versionInfoRegex);
        if (versionInfoMatch && versionInfoMatch[1]) {
            return new PyEnvCfg(versionInfoMatch[1]);
        }
    }
    return undefined;
}
exports.findAndParsePyvenvCfg = findAndParsePyvenvCfg;
function getVersion(pythonExecutable) {
    const parentFolder = path.dirname(pythonExecutable);
    const pyenvCfg = findAndParsePyvenvCfg(parentFolder);
    if (pyenvCfg) {
        return pyenvCfg.version;
    }
}
exports.getVersion = getVersion;
function findPythonBinaryPath(envPath) {
    const pythonBinName = process.platform === 'win32' ? 'python.exe' : 'python';
    const paths = [
        path.join(envPath, 'bin', pythonBinName),
        path.join(envPath, 'Scripts', pythonBinName),
        path.join(envPath, pythonBinName),
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return undefined;
}
exports.findPythonBinaryPath = findPythonBinaryPath;
function listPythonEnvironments(envPath) {
    const pythonEnvs = [];
    try {
        const venvDirs = fs.readdirSync(envPath);
        for (const venvDir of venvDirs) {
            const venvDirPath = path.join(envPath, venvDir);
            if (!fs.statSync(venvDirPath).isDirectory()) {
                continue;
            }
            const executable = findPythonBinaryPath(venvDirPath);
            if (executable) {
                pythonEnvs.push({
                    executable,
                    path: venvDirPath,
                    version: getVersion(executable),
                });
            }
        }
        return pythonEnvs;
    }
    catch (error) {
        return undefined;
    }
}
exports.listPythonEnvironments = listPythonEnvironments;
//# sourceMappingURL=utils.js.map