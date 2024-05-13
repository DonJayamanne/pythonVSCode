const esbuild = require('esbuild');

esbuild
    .build({
        entryPoints: ['src/main.ts'],
        bundle: true,
        platform: 'node',
        target: 'node20', // target version of Node.js
        outfile: 'dist/index.js',
        external: ['node_modules'],
        sourcemap: true,
        loader: {
            '.ts': 'ts',
        },
        format: 'cjs', // commonjs format for Node.js
    })
    .catch(() => process.exit(1));
