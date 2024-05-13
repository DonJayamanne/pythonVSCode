"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipEnv = void 0;
const fs = require("fs");
const path = require("path");
const messaging_1 = require("./messaging");
function get_pipenv_project(env) {
    if (!env.path) {
        return;
    }
    const projectFile = path.join(env.path, '.project');
    if (fs.existsSync(projectFile)) {
        const contents = fs.readFileSync(projectFile, 'utf8');
        const projectFolder = contents.trim();
        if (fs.existsSync(projectFolder)) {
            return projectFolder;
        }
    }
    return undefined;
}
class PipEnv {
    resolve(env) {
        const projectPath = get_pipenv_project(env);
        if (projectPath) {
            return {
                python_executable_path: env.executable,
                version: env.version,
                category: messaging_1.PythonEnvironmentCategory.Pipenv,
                env_path: env.path,
                project_path: projectPath,
            };
        }
        return undefined;
    }
    find() {
        return undefined;
    }
}
exports.PipEnv = PipEnv;
//# sourceMappingURL=pipenv.js.map