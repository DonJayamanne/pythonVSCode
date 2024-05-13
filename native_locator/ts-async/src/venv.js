"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Venv = exports.isVenv = void 0;
const path = require("path");
const messaging_1 = require("./messaging");
const utils_1 = require("./utils");
function isVenv(env) {
    if (!env.path) {
        return false;
    }
    return (0, utils_1.findPyvenvConfigPath)(env.executable) !== undefined;
}
exports.isVenv = isVenv;
class Venv {
    resolve(env) {
        if (isVenv(env)) {
            return {
                name: env.path && path.basename(env.path),
                python_executable_path: env.executable,
                version: env.version,
                category: messaging_1.PythonEnvironmentCategory.Venv,
                sys_prefix_path: env.path,
                env_path: env.path,
                env_manager: undefined,
                project_path: undefined,
                python_run_command: [env.executable],
            };
        }
        return undefined;
    }
    find() {
        return undefined;
    }
}
exports.Venv = Venv;
//# sourceMappingURL=venv.js.map