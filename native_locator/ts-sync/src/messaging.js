"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create_dispatcher = exports.get_manager_key = exports.get_environment_key = exports.send_message = exports.JsonRpcDispatcher = exports.createExitMessage = exports.createPythonEnvironmentMessage = exports.PythonEnvironmentCategory = exports.createEnvManagerMessage = exports.EnvManagerType = void 0;
var EnvManagerType;
(function (EnvManagerType) {
    EnvManagerType[EnvManagerType["Conda"] = 0] = "Conda";
    EnvManagerType[EnvManagerType["Pyenv"] = 1] = "Pyenv";
})(EnvManagerType = exports.EnvManagerType || (exports.EnvManagerType = {}));
function createEnvManagerMessage(params) {
    return {
        jsonrpc: '2.0',
        method: 'envManager',
        params,
    };
}
exports.createEnvManagerMessage = createEnvManagerMessage;
var PythonEnvironmentCategory;
(function (PythonEnvironmentCategory) {
    PythonEnvironmentCategory[PythonEnvironmentCategory["System"] = 0] = "System";
    PythonEnvironmentCategory[PythonEnvironmentCategory["Homebrew"] = 1] = "Homebrew";
    PythonEnvironmentCategory[PythonEnvironmentCategory["Conda"] = 2] = "Conda";
    PythonEnvironmentCategory[PythonEnvironmentCategory["Pyenv"] = 3] = "Pyenv";
    PythonEnvironmentCategory[PythonEnvironmentCategory["PyenvVirtualEnv"] = 4] = "PyenvVirtualEnv";
    PythonEnvironmentCategory[PythonEnvironmentCategory["WindowsStore"] = 5] = "WindowsStore";
    PythonEnvironmentCategory[PythonEnvironmentCategory["Pipenv"] = 6] = "Pipenv";
    PythonEnvironmentCategory[PythonEnvironmentCategory["VirtualEnvWrapper"] = 7] = "VirtualEnvWrapper";
    PythonEnvironmentCategory[PythonEnvironmentCategory["Venv"] = 8] = "Venv";
    PythonEnvironmentCategory[PythonEnvironmentCategory["VirtualEnv"] = 9] = "VirtualEnv";
})(PythonEnvironmentCategory = exports.PythonEnvironmentCategory || (exports.PythonEnvironmentCategory = {}));
function createPythonEnvironmentMessage(params) {
    return {
        jsonrpc: '2.0',
        method: 'pythonEnvironment',
        params,
    };
}
exports.createPythonEnvironmentMessage = createPythonEnvironmentMessage;
function createExitMessage() {
    return {
        jsonrpc: '2.0',
        method: 'exit',
    };
}
exports.createExitMessage = createExitMessage;
class JsonRpcDispatcher {
    constructor() {
        this.reported_managers = new Set();
        this.reported_environments = new Set();
    }
    was_environment_reported(env) {
        if (env.executable) {
            const key = env.executable.toString();
            return this.reported_environments.has(key);
        }
        return false;
    }
    report_environment_manager(env) {
        const key = env.executable_path.toString();
        if (!this.reported_managers.has(key)) {
            this.reported_managers.add(key);
            send_message(createEnvManagerMessage(env));
        }
    }
    report_environment(env) {
        var _a, _b;
        const key = ((_a = env.python_executable_path) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = env.env_path) === null || _b === void 0 ? void 0 : _b.toString());
        if (key && !this.reported_environments.has(key)) {
            this.reported_environments.add(key);
            send_message(createPythonEnvironmentMessage(env));
        }
        if (env.env_manager) {
            this.report_environment_manager(env.env_manager);
        }
    }
    exit() {
        send_message(createExitMessage());
    }
}
exports.JsonRpcDispatcher = JsonRpcDispatcher;
function send_message(message) {
    const serializedMessage = JSON.stringify(message);
    const contentLength = serializedMessage.length;
    console.log(`Content-Length: ${contentLength}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n${serializedMessage}`);
}
exports.send_message = send_message;
function get_environment_key(env) {
    if (env.python_executable_path) {
        return env.python_executable_path.toString();
    }
    if (env.env_path) {
        return env.env_path.toString();
    }
    return undefined;
}
exports.get_environment_key = get_environment_key;
function get_manager_key(manager) {
    return manager.executable_path.toString();
}
exports.get_manager_key = get_manager_key;
function create_dispatcher() {
    return new JsonRpcDispatcher();
}
exports.create_dispatcher = create_dispatcher;
//# sourceMappingURL=messaging.js.map