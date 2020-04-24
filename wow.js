const childprocess = require('child_process');

const proc = childprocess.spawn(
    // '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets/bin/python',
    '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForDS/bin/python',
    ['/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/wow.py'],
    // ['-m', 'ipykernel_launcher', '-f', '/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/wow.json'],
    {
        env: {
            // ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONPATH: '/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/pythonFiles'
        }
    }
);
proc.stdout.pipe(process.stdout);
proc.stderr.pipe(process.stderr);

setTimeout(() => console.log('exit'), 50000000);
