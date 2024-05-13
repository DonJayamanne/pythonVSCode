"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualEnvWrapper = void 0;
const path = require("path");
const fs = require("fs-extra");
const os_1 = require("os");
const messaging_1 = require("./messaging");
const utils_1 = require("./utils");
const virtualenv_1 = require("./virtualenv");
function get_default_virtualenvwrapper_path() {
    if (process.platform === 'win32') {
        const home = (0, os_1.homedir)();
        if (home) {
            let homePath = path.join(home, 'Envs');
            if (fs.existsSync(homePath)) {
                return homePath;
            }
            homePath = path.join(home, 'virtualenvs');
            if (fs.existsSync(homePath)) {
                return homePath;
            }
        }
    }
    else {
        const home = (0, os_1.homedir)();
        if (home) {
            const homePath = path.join(home, 'virtualenvs');
            if (fs.existsSync(homePath)) {
                return homePath;
            }
        }
    }
    return null;
}
function get_work_on_home_path() {
    const work_on_home = process.env.WORKON_HOME;
    if (work_on_home) {
        const workOnHomePath = path.resolve(work_on_home);
        if (fs.existsSync(workOnHomePath)) {
            return workOnHomePath;
        }
    }
    return get_default_virtualenvwrapper_path();
}
function is_virtualenvwrapper(env) {
    if (!env.path) {
        return false;
    }
    const work_on_home_dir = get_work_on_home_path();
    if (work_on_home_dir && env.executable.startsWith(work_on_home_dir) && (0, virtualenv_1.isVirtualenv)(env)) {
        return true;
    }
    return false;
}
class VirtualEnvWrapper {
    resolve(env) {
        if (is_virtualenvwrapper(env)) {
            return {
                name: env.path && path.basename(env.path),
                python_executable_path: env.executable,
                version: env.version,
                category: messaging_1.PythonEnvironmentCategory.Venv,
                sys_prefix_path: env.path,
                env_path: env.path,
                python_run_command: [env.executable],
            };
        }
    }
    find() {
        const work_on_home = get_work_on_home_path();
        if (work_on_home) {
            const envs = (0, utils_1.listPythonEnvironments)(work_on_home) || [];
            const environments = [];
            envs.forEach((env) => {
                const resolvedEnv = this.resolve(env);
                if (resolvedEnv) {
                    environments.push(resolvedEnv);
                }
            });
            if (environments.length === 0) {
                return;
            }
            return { environments };
        }
    }
}
exports.VirtualEnvWrapper = VirtualEnvWrapper;
//# sourceMappingURL=virtualenvwrapper.js.map