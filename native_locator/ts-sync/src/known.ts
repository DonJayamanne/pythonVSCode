// import { env } from 'process';
// import { PathLike } from 'fs';

// export interface Environment {
//     get_user_home(): string | undefined;
//     get_env_var(key: string): string | undefined;
//     get_known_global_search_locations(): PathLike[];
// }

// export class EnvironmentApi implements Environment {
//     get_user_home(): PathLike | undefined {
//         return get_user_home();
//     }

//     get_env_var(key: string): string | undefined {
//         return get_env_var(key);
//     }

//     get_known_global_search_locations(): PathLike[] {
//         return [];
//     }
// }

// function get_user_home(): PathLike | undefined {
//     const home = env.HOME || env.USERPROFILE;
//     return home ? home : undefined;
// }

// function get_env_var(key: string): string | undefined {
//     return env[key];
// }

export function getKnowGlobalSearchLocations(): string[] {
    return [
        '/usr/bin',
        '/usr/local/bin',
        '/bin',
        '/home/bin',
        '/sbin',
        '/usr/sbin',
        '/usr/local/sbin',
        '/home/sbin',
        '/opt',
        '/opt/bin',
        '/opt/sbin',
        '/opt/homebrew/bin',
    ];
}
