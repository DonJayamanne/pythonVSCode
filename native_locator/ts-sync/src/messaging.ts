/* eslint-disable class-methods-use-this */
/* eslint-disable lines-between-class-members */
/* eslint-disable camelcase */
import { PathLike } from 'fs';
import type { PythonEnv } from './utils';

export interface EnvManager {
    executable_path: PathLike;
    version?: string;
    tool: EnvManagerType;
}

export enum EnvManagerType {
    Conda,
    Pyenv,
}

export interface EnvManagerMessage {
    jsonrpc: string;
    method: string;
    params: EnvManager;
}

export function createEnvManagerMessage(params: EnvManager): EnvManagerMessage {
    return {
        jsonrpc: '2.0',
        method: 'envManager',
        params,
    };
}

export enum PythonEnvironmentCategory {
    System,
    Homebrew,
    Conda,
    Pyenv,
    PyenvVirtualEnv,
    WindowsStore,
    Pipenv,
    VirtualEnvWrapper,
    Venv,
    VirtualEnv,
}

export interface PythonEnvironment {
    name?: string;
    python_executable_path?: string;
    category: PythonEnvironmentCategory;
    version?: string;
    env_path?: string;
    sys_prefix_path?: string;
    env_manager?: EnvManager;
    python_run_command?: string[];
    project_path?: string;
}

export interface PythonEnvironmentMessage {
    jsonrpc: string;
    method: string;
    params: PythonEnvironment;
}

export function createPythonEnvironmentMessage(params: PythonEnvironment): PythonEnvironmentMessage {
    return {
        jsonrpc: '2.0',
        method: 'pythonEnvironment',
        params,
    };
}

export interface ExitMessage {
    jsonrpc: string;
    method: string;
    params?: undefined;
}

export function createExitMessage(): ExitMessage {
    return {
        jsonrpc: '2.0',
        method: 'exit',
    };
}

export interface MessageDispatcher {
    was_environment_reported(env: PythonEnv): boolean;
    report_environment_manager(env: EnvManager): void;
    report_environment(env: PythonEnvironment): void;
    exit(): void;
}

export class JsonRpcDispatcher implements MessageDispatcher {
    reported_managers: Set<string>;
    reported_environments: Set<string>;

    constructor() {
        this.reported_managers = new Set();
        this.reported_environments = new Set();
    }

    was_environment_reported(env: PythonEnv): boolean {
        if (env.executable) {
            const key = env.executable.toString();
            return this.reported_environments.has(key);
        }
        return false;
    }

    report_environment_manager(env: EnvManager): void {
        const key = env.executable_path.toString();
        if (!this.reported_managers.has(key)) {
            this.reported_managers.add(key);
            send_message(createEnvManagerMessage(env));
        }
    }

    report_environment(env: PythonEnvironment): void {
        const key = env.python_executable_path?.toString() || env.env_path?.toString();
        if (key && !this.reported_environments.has(key)) {
            this.reported_environments.add(key);
            send_message(createPythonEnvironmentMessage(env));
        }
        if (env.env_manager) {
            this.report_environment_manager(env.env_manager);
        }
    }

    exit(): void {
        send_message(createExitMessage());
    }
}

export function send_message<T>(message: T): void {
    const serializedMessage = JSON.stringify(message);
    const contentLength = serializedMessage.length;
    console.log(
        `Content-Length: ${contentLength}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n${serializedMessage}`,
    );
}

export function get_environment_key(env: PythonEnvironment): string | undefined {
    if (env.python_executable_path) {
        return env.python_executable_path.toString();
    }
    if (env.env_path) {
        return env.env_path.toString();
    }
    return undefined;
}

export function get_manager_key(manager: EnvManager): string | undefined {
    return manager.executable_path.toString();
}

export function create_dispatcher(): JsonRpcDispatcher {
    return new JsonRpcDispatcher();
}
