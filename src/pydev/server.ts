"use strict";

import * as net from "net";
import { EventEmitter } from 'events';
import { verbose } from './pythonDebug';
import { ReadLine, createInterface } from "readline";


export class Server extends EventEmitter {
	private requestedPort: number;
	private server: net.Server;
	private buffer: Buffer;
	private socket: net.Socket;
	private bytesRead: number = 0;
	private messages: string[] = [];

	constructor(port: number) {
		super();

		this.requestedPort = port;
		this.buffer = new Buffer('');
	}

	public get port(): number {
		if (this.server) {
			return this.server.address().port;
		} else {
			return null;
		}
	}

	public listen(): void {
		let that = this;

		this.server = net.createServer((socket: net.Socket) => {
			that.socket = socket;
			that.WriteAll();

			verbose('Connected client on port ' + this.port);

			let i = createInterface(socket, socket);
			i.on('line', function (line) {
				that.emit('message', line);
			});

			socket.on('disconnect', () => {
				verbose('Client disconnected');
			});
		});

		this.server.listen(this.requestedPort, function () {
			that.emit('connect');
		});
	}
	public Write(message: string) {
		this.messages.push(message);
		this.WriteAll();
	}

	public WriteAll() {
		let that = this;
		if (this.socket != null) {
			this.messages.forEach(message => {
				that.socket.write(new Buffer(message + '\n'));
			});
			this.messages = [];
		}
	}
}