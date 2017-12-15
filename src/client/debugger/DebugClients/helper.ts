import { IPathUtils } from '../../common/types';
import { EnvironmentVariables, IEnvironmentVariablesService } from '../../common/variables/types';
import { LaunchRequestArguments } from '../Common/Contracts';

export class DebugClientHelper {
    constructor(private envParser: IEnvironmentVariablesService, private pathUtils: IPathUtils) { }
    public async getEnvironmentVariables(args: LaunchRequestArguments): Promise<EnvironmentVariables> {
        // Check if we have custom environment variables in a file.
        let envFileVars = await this.envParser.parseFile(args.envFile);
        if (!envFileVars) {
            envFileVars = {};
        }

        if (args.console === 'none') {
            // For debugging, when not using any terminal, then we need to provide all env variables.
            this.mergeProcessEnvironmentVariables(envFileVars);
        }

        // Check if we have custom environment variables as plain old json.
        const debugLaunchEnvVars = (args.env && Object.keys(args.env).length > 0) ? { ...args.env } as EnvironmentVariables : {};

        // Merge the two sets of environment variables.
        const env = { ...envFileVars };
        this.envParser.mergeVariables(debugLaunchEnvVars, env);

        if (!env.hasOwnProperty('PYTHONIOENCODING')) {
            env.PYTHONIOENCODING = 'UTF-8';
        }
        if (!env.hasOwnProperty('PYTHONUNBUFFERED')) {
            env.PYTHONUNBUFFERED = '1';
        }

        return env;
    }
    private mergeProcessEnvironmentVariables(env: EnvironmentVariables) {
        // As we're spawning the process, we need to ensure all env variables are passed.
        // Including those from the current process (i.e. everything, not just custom vars).
        this.envParser.mergeVariables(process.env as EnvironmentVariables, env);

        // If we didn't get any variables form the file, then the PATH variables wouldn't be appended.
        if (Object.keys(env).length === 0) {
            const pathVariableName = this.pathUtils.getPathVariableName();
            this.envParser.appendPythonPath(env, process.env.PYTHONPATH);
            this.envParser.appendPath(env, process.env[pathVariableName]);
        }
    }
}
