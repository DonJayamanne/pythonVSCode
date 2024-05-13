"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGlobalVirtualEnvs = exports.getGlobalVirtualenvDirs = void 0;
const fs = require("fs");
const path = require("path");
const os_1 = require("os");
const utils_1 = require("./utils");
function getGlobalVirtualenvDirs() {
    const venvDirs = [];
    const workOnHome = process.env.WORKON_HOME;
    if (workOnHome) {
        const canonicalizedPath = fs.realpathSync(workOnHome);
        if (fs.existsSync(canonicalizedPath)) {
            venvDirs.push(canonicalizedPath);
        }
    }
    const home = (0, os_1.homedir)();
    if (home) {
        const homePath = path.resolve(home);
        const dirs = [
            path.resolve(homePath, 'envs'),
            path.resolve(homePath, '.direnv'),
            path.resolve(homePath, '.venvs'),
            path.resolve(homePath, '.virtualenvs'),
            path.resolve(homePath, '.local', 'share', 'virtualenvs'),
        ];
        for (const dir of dirs) {
            if (fs.existsSync(dir)) {
                venvDirs.push(dir);
            }
        }
        if (process.platform === 'linux') {
            const envs = path.resolve(homePath, 'Envs');
            if (fs.existsSync(envs)) {
                venvDirs.push(envs);
            }
        }
    }
    return venvDirs;
}
exports.getGlobalVirtualenvDirs = getGlobalVirtualenvDirs;
function listGlobalVirtualEnvs() {
    const pythonEnvs = [];
    const venvDirs = getGlobalVirtualenvDirs();
    for (const rootDir of venvDirs) {
        const dirs = fs.readdirSync(rootDir);
        for (const venvDir of dirs) {
            const venvPath = path.resolve(rootDir, venvDir);
            if (!fs.statSync(venvPath).isDirectory()) {
                continue;
            }
            const executable = (0, utils_1.findPythonBinaryPath)(venvPath);
            if (executable) {
                pythonEnvs.push({
                    executable,
                    path: venvPath,
                    version: (0, utils_1.getVersion)(executable),
                });
            }
        }
    }
    return pythonEnvs;
}
exports.listGlobalVirtualEnvs = listGlobalVirtualEnvs;
//# sourceMappingURL=global_virtualenvs.js.map