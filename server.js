var net = require('net');
var debug = require('debug')('tunnel-ssh:test-server-client');

function createServer(port, addr, callback) {
    var handleConnection = function (socket) {
        socket.on('data', function (data) {
            console.log('sending data');
            debug('server::data', data);
        });
        debug('server::write');
        socket.write('Echo server\r\n');
    };

    return net.createServer(handleConnection).listen(port, addr, callback);
}

function createClient(port, addr, callback) {
    var client = new net.Socket();

    client.on('error', function (e) {
        console.log('errortest', e);
    });

    client.connect(port, addr, function () {
        debug('client::write');
        console.log('Client write');
        client.write('alive !');
        setTimeout(function () {
            client.end();
            debug('client::end');
            callback(null, true);
        }, 300);
    });
    return client;
}

exports.createServer = createServer;
exports.createClient = createClient;
