import { IVirtualEnvironment } from './contracts';

export class VirtualEnvironmentManager {
    constructor(private envs: IVirtualEnvironment[]) {
    }
    public detect(pythonPath: string): Promise<IVirtualEnvironment | void> {
        const promises = this.envs
            .map(item => item.detect(pythonPath)
                .then(result => {
                    return { env: item, result };
                }));

        return Promise.all(promises)
            .then(results => {
                const env = results.find(items => items.result === true);
                return env ? env.env : undefined;
            });
    }
}
