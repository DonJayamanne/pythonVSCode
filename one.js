// var Client = require('ssh2').Client;

// var conn = new Client();
// conn.on('ready', function () {
//     console.log('Client :: ready');
//     conn.forwardOut('192.168.0.15', 5000, '127.0.0.1', 5000, function (err, stream) {
//         if (err) throw err;
//         stream.on('close', function () {
//             console.log('TCP :: CLOSED');
//             conn.end();
//         }).on('data', function (data) {
//             console.log('TCP :: DATA: ' + data);
//         });
//     });
// }).connect({
//     host: '192.168.0.15',
//     port: 22,
//     username: 'donjayamanne',
//     password: '2997'
// });

var tunnel = require('tunnel-ssh');
var helper = require('./server');


/**
make sure you can connect to your own machine with the current user without password.
Example:  ssh $USER@127.0.0.1
Remember to add your privateKey to your ssh-agent (ssh-add)
**/

var config = {
    host: '192.168.0.15', username: 'donjayamanne', dstPort: 5678, localPort: 5001, password: '29973', keepAlive: true,
    tryKeyboard: true, xreadyTimeout:100
};

function testTunnel() {
    var fakeServer = helper.createServer(config.dstPort, '127.0.0.1', function () {
        tunnel(config, function () {
            console.log('Tunnel open');
            // helper.createClient(7000, '127.0.0.1', console.log);
            // helper.createClient(7000, '127.0.0.1', console.log);
        }).on('error', function (e) {
            console.log('error', e);
        });
    });
    fakeServer.unref();
}

function testSsh2() {
    return new Promise(resolve => {
        var Connection = require('ssh2');
        var sshConnection = new Connection();
        sshConnection.on('close', function () { console.log('close'); });
        sshConnection.on('error', function (ex) { console.error(ex); });
        sshConnection.on('ready', function () {
            console.log('ready');
        });
        sshConnection.on('keyboard-interactive', function (name, instructions, lang, prompts, finish) {
            console.log('int');
            console.log(name);
            console.log(instructions);
            console.log(prompts);
            finish('2997');
            // ctx.
        });
        sshConnection.on('authentication', function (ctx) {
            // ctx.
            console.log('auth');
        });
        console.log(config);
        sshConnection.connect(config);
        console.log('2');

    });
}

// testTunnel();
testSsh2();
