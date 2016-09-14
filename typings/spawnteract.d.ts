declare module "spawnteract" {
    import * as child_process from 'child_process';
    interface LaunchSpecSpawnResult {
        spawn: child_process.ChildProcess;
        connectionFile: string;
        config: any;
        kernelSpec: any;
    }

    /**
     * Launch a kernel for a given kernelSpec
     * @public
     * @param  {object}       kernelSpec      describes a specific
     *                                        kernel, see the npm
     *                                        package `kernelspecs`
     * @param  {object}       [spawnOptions]  options for [child_process.spawn]{@link https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options}
     * @return {object}       spawnResults
     * @return {ChildProcess} spawnResults.spawn           spawned process
     * @return {string}       spawnResults.connectionFile  connection file path
     * @return {object}       spawnResults.config          connectionConfig
     *
     */
    export function launchSpec(kernelSpec: any, spawnOptions: child_process.SpawnOptions): Promise<LaunchSpecSpawnResult>;
    /**
     * Launch a kernel by name
     * @public
     * @param  {string}       kernelName
     * @param  {object[]}     [specs]                      array of kernelSpec
     *                                                     objects to look through.
     *                                                     See the npm package
     *                                                     `kernelspecs`
     * @param  {object}       [spawnOptions]  options for [child_process.spawn]{@link https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options}
     * @return {object}       spawnResults
     * @return {ChildProcess} spawnResults.spawn           spawned process
     * @return {string}       spawnResults.connectionFile  connection file path
     * @return {object}       spawnResults.config          connectionConfig
     */
    export function launch(kernelName: string, spawnOptions: child_process.SpawnOptions, specs): Promise<LaunchSpecSpawnResult>;
}
