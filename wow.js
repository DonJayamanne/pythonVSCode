const childprocess = require('child_process');

const proc = childprocess.spawn(
    '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets/bin/python',
    ['wow.py'],
    {
        env: {
            PYTHONUNBUFFERED: '1',
            PYTHONPATH: '/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/pythonFiles'
        }
    }
);
proc.stdout.pipe(process.stdout);
proc.stderr.pipe(process.stderr);

setTimeout(() => console.log('exit'), 50000000);
