import { ICurrentProcess, IPathUtils } from '../../common/types';
import { EnvironmentVariables, IEnvironmentVariablesService } from '../../common/variables/types';
import { LaunchRequestArguments } from '../Common/Contracts';

export class DebugClientHelper {
    constructor(private envParser: IEnvironmentVariablesService, private pathUtils: IPathUtils,
        private process: ICurrentProcess) { }
    public async getEnvironmentVariables(args: LaunchRequestArguments): Promise<EnvironmentVariables> {
        const pathVariableName = this.pathUtils.getPathVariableName();

        // Merge variables from both .env file and env json variables.
        const envFileVars = await this.envParser.parseFile(args.envFile);
        // tslint:disable-next-line:no-any
        const debugLaunchEnvVars: {[key: string]: string} = (args.env && Object.keys(args.env).length > 0) ? { ...args.env } as any : {} as any;
        const env = envFileVars ? { ...envFileVars! } : {};
        this.envParser.mergeVariables(debugLaunchEnvVars, env);

        // Append the PYTHONPATH and PATH variables.
        this.envParser.appendPath(env, debugLaunchEnvVars[pathVariableName]);
        this.envParser.appendPythonPath(env, debugLaunchEnvVars.PYTHONPATH);

        if (typeof env[pathVariableName] === 'string' && env[pathVariableName].length > 0) {
            // Now merge this path with the current system path.
            // We need to do this to ensure the PATH variable always has the system PATHs as well.
            this.envParser.appendPath(env, this.process.env[pathVariableName]);
        }
        if (typeof env.PYTHONPATH === 'string' && env.PYTHONPATH.length > 0) {
            // We didn't have a value for PATH earlier and now we do.
            // Now merge this path with the current system path.
            // We need to do this to ensure the PATH variable always has the system PATHs as well.
            this.envParser.appendPythonPath(env, this.process.env.PYTHONPATH);
        }

        if (typeof args.console !== 'string' || args.console === 'none') {
            // For debugging, when not using any terminal, then we need to provide all env variables.
            // As we're spawning the process, we need to ensure all env variables are passed.
            // Including those from the current process (i.e. everything, not just custom vars).
            this.envParser.mergeVariables(this.process.env, env);

            if (env[pathVariableName] === undefined && typeof this.process.env[pathVariableName] === 'string') {
                env[pathVariableName] = this.process.env[pathVariableName];
            }
            if (env.PYTHONPATH === undefined && typeof this.process.env.PYTHONPATH === 'string') {
                env.PYTHONPATH = this.process.env.PYTHONPATH;
            }
        }

        if (!env.hasOwnProperty('PYTHONIOENCODING')) {
            env.PYTHONIOENCODING = 'UTF-8';
        }
        if (!env.hasOwnProperty('PYTHONUNBUFFERED')) {
            env.PYTHONUNBUFFERED = '1';
        }

        if (args.gevent) {
            env.GEVENT_SUPPORT = 'True';  // this is read in pydevd_constants.py
        }

        return env;
    }
}
