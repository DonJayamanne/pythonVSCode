import * as fs from 'fs';

export function parseEnvFile(envFile: string): any {
    const buffer = fs.readFileSync(envFile, 'utf8');
    const env = {};
    buffer.split('\n').forEach(line => {
        const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (r !== null) {
            let value = r[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.replace(/\\n/gm, '\n');
            }
            env[r[1]] = value.replace(/(^['"]|['"]$)/g, '');
        }
    });
    return mergeEnvVariables(env);
}

export function mergeEnvVariables(newVariables: { [key: string]: string }, mergeWith: any = process.env): any {
    for (let setting in mergeWith) {
        if (!newVariables[setting]) {
            newVariables[setting] = mergeWith[setting];
        }
    }

    return newVariables;
}
