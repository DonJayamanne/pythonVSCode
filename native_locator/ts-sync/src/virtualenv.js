"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualEnv = exports.isVirtualenv = void 0;
const fs = require("fs-extra");
const path = require("path");
const messaging_1 = require("./messaging");
function isVirtualenv(env) {
    if (!env.path) {
        return false;
    }
    const file_path = path.dirname(env.executable);
    if (file_path) {
        if (fs.pathExistsSync(path.join(file_path, 'activate')) ||
            fs.pathExistsSync(path.join(file_path, 'activate.bat'))) {
            return true;
        }
        try {
            const files = fs.readdirSync(file_path);
            for (const file of files) {
                if (file.startsWith('activate')) {
                    return true;
                }
            }
        }
        catch (error) {
            return false;
        }
    }
    return false;
}
exports.isVirtualenv = isVirtualenv;
class VirtualEnv {
    resolve(env) {
        var _a, _b;
        if (isVirtualenv(env)) {
            return {
                name: env.path && path.dirname(env.path),
                python_executable_path: (_a = env.executable) === null || _a === void 0 ? void 0 : _a.toString(),
                version: env.version,
                category: messaging_1.PythonEnvironmentCategory.VirtualEnv,
                sys_prefix_path: env.path,
                env_path: env.path,
                env_manager: undefined,
                project_path: undefined,
                python_run_command: [(_b = env.executable) === null || _b === void 0 ? void 0 : _b.toString()],
            };
        }
        return undefined;
    }
    find() {
        return undefined;
    }
}
exports.VirtualEnv = VirtualEnv;
//# sourceMappingURL=virtualenv.js.map