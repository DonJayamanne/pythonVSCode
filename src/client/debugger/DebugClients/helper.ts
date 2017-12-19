import { ICurrentProcess, IPathUtils } from '../../common/types';
import { EnvironmentVariables, IEnvironmentVariablesService } from '../../common/variables/types';
import { LaunchRequestArguments } from '../Common/Contracts';

export class DebugClientHelper {
    constructor(private envParser: IEnvironmentVariablesService, private pathUtils: IPathUtils,
        private process: ICurrentProcess) { }
    public async getEnvironmentVariables(args: LaunchRequestArguments): Promise<EnvironmentVariables> {
        // Check if we have custom environment variables in a file.
        let envFileVars = await this.envParser.parseFile(args.envFile);
        if (!envFileVars) {
            envFileVars = {};
        }

        const pathVariableName = this.pathUtils.getPathVariableName();

        // Keep track of whether we have values for PATH and PYTHONPATH
        const hasValuesForPATH = envFileVars[pathVariableName] !== undefined;
        const hasValuesForPYTHONPATH = envFileVars.PYTHONPATH !== undefined;

        // Check if we have custom environment variables as plain old json.
        const debugLaunchEnvVars = (args.env && Object.keys(args.env).length > 0) ? { ...args.env } as EnvironmentVariables : {};

        // Merge the two sets of environment variables.
        const env = { ...envFileVars };
        this.envParser.mergeVariables(debugLaunchEnvVars, env);

        // Append the PYTHONPATH and PATH variables
        this.envParser.appendPath(env, debugLaunchEnvVars[pathVariableName]);
        this.envParser.appendPythonPath(env, debugLaunchEnvVars.PYTHONPATH);

        if (env[pathVariableName] !== undefined && !hasValuesForPATH && this.process.env[pathVariableName] !== undefined) {
            // We didn't have a value for PATH earlier and now we do.
            // Now merge this path with the current system path.
            // We need to do this to ensure the PATH variable always has the system PATHs as well.
            this.envParser.appendPath(env, this.process.env[pathVariableName]);
        }
        if (env.PYTHONPATH !== undefined && !hasValuesForPYTHONPATH && this.process.env.PYTHONPATH !== undefined) {
            // We didn't have a value for PATH earlier and now we do.
            // Now merge this path with the current system path.
            // We need to do this to ensure the PATH variable always has the system PATHs as well.
            this.envParser.appendPythonPath(env, this.process.env.PYTHONPATH);
        }

        if (args.console === 'none') {
            // For debugging, when not using any terminal, then we need to provide all env variables.
            // As we're spawning the process, we need to ensure all env variables are passed.
            // Including those from the current process (i.e. everything, not just custom vars).
            this.envParser.mergeVariables(this.process.env as EnvironmentVariables, env);

            if (env[pathVariableName] === undefined && this.process.env[pathVariableName] !== undefined) {
                env[pathVariableName] = this.process.env[pathVariableName];
            }
            if (env.PYTHONPATH === undefined && this.process.env.PYTHONPATH !== undefined) {
                env.PYTHONPATH = this.process.env.PYTHONPATH;
            }
        }

        if (!env.hasOwnProperty('PYTHONIOENCODING')) {
            env.PYTHONIOENCODING = 'UTF-8';
        }
        if (!env.hasOwnProperty('PYTHONUNBUFFERED')) {
            env.PYTHONUNBUFFERED = '1';
        }

        return env;
    }
    // private mergeProcessEnvironmentVariables(env: EnvironmentVariables) {
    //     // If we didn't get any variables form the file, then the PATH variables wouldn't be appended.
    //     if (Object.keys(env).length === 0) {
    //         const pathVariableName = this.pathUtils.getPathVariableName();
    //         this.envParser.appendPythonPath(env, this.process.env.PYTHONPATH);
    //         this.envParser.appendPath(env, this.process.env[pathVariableName]);
    //     }

    //     // As we're spawning the process, we need to ensure all env variables are passed.
    //     // Including those from the current process (i.e. everything, not just custom vars).
    //     this.envParser.mergeVariables(this.process.env as EnvironmentVariables, env);
    // }
}
