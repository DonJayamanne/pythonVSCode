"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Homebrew = exports.isSymlinkedPythonExecutable = void 0;
const fs = require("fs");
const path = require("path");
const messaging_1 = require("./messaging");
function isSymlinkedPythonExecutable(file) {
    const name = path.basename(file);
    if (!name.startsWith('python') || name.endsWith('-config') || name.endsWith('-build')) {
        return undefined;
    }
    const metadata = fs.lstatSync(file);
    if (metadata.isFile() || !metadata.isSymbolicLink()) {
        return undefined;
    }
    return fs.realpathSync(file);
}
exports.isSymlinkedPythonExecutable = isSymlinkedPythonExecutable;
class Homebrew {
    resolve(env) {
        return;
    }
    find() {
        var _a;
        const homebrewPrefix = process.env.HOMEBREW_PREFIX;
        if (!homebrewPrefix) {
            return undefined;
        }
        const homebrewPrefixBin = path.join(homebrewPrefix, 'bin');
        const reported = new Set();
        const pythonRegex = new RegExp(/\/(\d+\.\d+\.\d+)\//);
        const environments = [];
        for (const file of fs.readdirSync(homebrewPrefixBin)) {
            const exe = isSymlinkedPythonExecutable(file);
            if (exe) {
                const pythonVersion = exe;
                const version = (_a = pythonRegex.exec(pythonVersion)) === null || _a === void 0 ? void 0 : _a[1];
                if (reported.has(exe)) {
                    continue;
                }
                reported.add(exe);
                const env = {
                    python_executable_path: exe,
                    category: messaging_1.PythonEnvironmentCategory.Homebrew,
                    version,
                    python_run_command: [exe],
                };
                environments.push(env);
            }
        }
        if (environments.length === 0) {
            return undefined;
        }
        return { environments };
    }
}
exports.Homebrew = Homebrew;
//# sourceMappingURL=homebrew.js.map