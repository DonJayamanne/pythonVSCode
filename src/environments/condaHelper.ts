import * as fs from 'fs-extra';
import * as path from 'path';
import { traceError, traceVerbose } from '../client/logging';
import { Conda } from '../client/pythonEnvironments/common/environmentManagers/conda';
import { getPyenvDir } from '../client/pythonEnvironments/common/environmentManagers/pyenv';
import { exec } from '../client/pythonEnvironments/common/externalDependencies';
import { EnvironmentType, PythonEnvironment } from '../client/pythonEnvironments/info';

type CondaPackageInfo = {
    // eslint-disable-next-line camelcase
    base_url?: string;
    // eslint-disable-next-line camelcase
    build_number?: number;
    // eslint-disable-next-line camelcase
    build_string?: string;
    channel?: string;
    // eslint-disable-next-line camelcase
    dist_name?: string;
    name: string;
    platform?: string;
    version: string;
};

type PipPackageInfo = {
    name: string;
    version: string;
};
export type PackageInfo = PipPackageInfo | CondaPackageInfo;
export async function getPackages(env: PythonEnvironment) {
    try {
        const [pipPackages, condaPackages] = await Promise.all([getPipPackages(env), getCondaPackages(env)]);
        const packages = new Map<string, PackageInfo>();
        (pipPackages || []).forEach((pkg) => packages.set(pkg.name, pkg));
        // Use conda packages as source of truth, as we might have more information
        // when getting conda packages.
        (condaPackages || []).forEach((pkg) => packages.set(pkg.name, pkg));
        return Array.from(packages.values()).sort((a, b) =>
            a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()),
        );
    } catch (ex) {
        traceError(`Failed to get package information for ${env.displayName})`, ex);
        return [];
    }
}
export async function getPipPackages(env: PythonEnvironment) {
    if (env.envType === EnvironmentType.Conda) {
        return;
    }

    const result = await exec(env.path, ['-m', 'pip', 'list', '--format', 'json'], { timeout: 60_000 });
    traceVerbose(`conda info --json: ${result.stdout}`);
    const stdout = result.stdout.trim();
    return stdout ? (JSON.parse(result.stdout) as PipPackageInfo[]) : [];
}
export async function getCondaPackages(env: PythonEnvironment) {
    if (env.envType !== EnvironmentType.Conda || (!env.envName && !env.envPath)) {
        return;
    }
    const conda = await Conda.getConda();
    if (!conda) {
        return;
    }
    const args = env.envName ? ['list', '-n', env.envName] : ['list', '-p', env.envPath!];
    const result = await exec(conda.command, args.concat(['--json']), { timeout: 60_000 });
    const stdout = result.stdout.trim();
    traceVerbose(`conda info --json: ${result.stdout}`);
    return stdout ? (JSON.parse(result.stdout) as CondaPackageInfo[]) : [];
}

export async function getCondaVersion() {
    const conda = await Conda.getConda();
    if (!conda) {
        return;
    }
    return conda.getInfo().catch((ex) => traceError('Failed to get conda info', ex));
}

export async function getPyEnvVersion() {
    const dir = getPyenvDir();
    const changelogFile = path.join(dir, 'CHANGELOG.md');
    try {
        if (await fs.pathExists(changelogFile)) {
            const textFile = await fs.readFile(changelogFile, 'utf-8');
            const versionStart = textFile.indexOf('## Release ');
            if (versionStart === -1) {
                traceError(
                    `Failed to identify pyenv version from ${changelogFile}, with text ${textFile.substring(0, 100)}`,
                );
                return;
            }

            const start = versionStart + '## Release '.length;
            const verionLines = textFile
                .substring(start, start + 20)
                .splitLines()
                .map((line) => line.trim())
                .filter((line) => line.length);

            return verionLines.length === 0 ? '' : verionLines[0];
        }
    } catch (ex) {
        traceError('Failed to get pyenv version', ex);
    }
}
