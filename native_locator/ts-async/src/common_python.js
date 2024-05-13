"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonOnPath = exports.get_env_path = void 0;
const path = require("path");
const fs = require("fs-extra");
const messaging_1 = require("./messaging");
const utils_1 = require("./utils");
function get_env_path(python_executable_path) {
    const parent = path.dirname(python_executable_path);
    if (path.basename(parent) === 'Scripts') {
        return path.dirname(parent);
    }
    else {
        return parent;
    }
}
exports.get_env_path = get_env_path;
class PythonOnPath {
    resolve(env) {
        const bin = process.platform === 'win32' ? 'python.exe' : 'python';
        if (path.basename(env.executable) !== bin) {
            return undefined;
        }
        return {
            name: undefined,
            python_executable_path: env.executable,
            version: env.version,
            category: messaging_1.PythonEnvironmentCategory.System,
            sys_prefix_path: undefined,
            env_path: env.path,
            env_manager: undefined,
            project_path: undefined,
            python_run_command: [env.executable],
        };
    }
    find() {
        const env_paths = process.env.PATH || '';
        const bin = process.platform === 'win32' ? 'python.exe' : 'python';
        const environments = [];
        env_paths
            .split(path.delimiter)
            .map((p) => path.join(p, bin))
            .filter((p) => fs.existsSync(p))
            .forEach((full_path) => {
            const version = (0, utils_1.getVersion)(full_path);
            const env_path = get_env_path(full_path);
            const env = this.resolve(new utils_1.PythonEnv(full_path, env_path, version));
            if (env) {
                environments.push(env);
            }
        });
        if (environments.length === 0) {
            return undefined;
        }
        else {
            return { environments };
        }
    }
}
exports.PythonOnPath = PythonOnPath;
//# sourceMappingURL=common_python.js.map