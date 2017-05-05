"use strict";

import * as net from "net";
import { EventEmitter } from 'events';
import { verbose } from './pythonDebug';


export class Server extends EventEmitter {
	private _port: number;
	private server: net.Server;
	private buffer: Buffer;
	private socket: net.Socket;
	private bytesRead: number = 0;
	private messages: string[] = [];

	constructor(port: number) {
		super();

		this._port = port;
		this.buffer = new Buffer('');
	}

	public get port(): number {
		if (this.server) {
			return this.server.address().port;
		} else {
			return this._port;
		}
	}

	public listen(): void {
		let that = this;

		this.server = net.createServer((socket: net.Socket) => {
			that.socket = socket;
			that.WriteAll();

			verbose('Connected client on port ' + this.port);
			socket.on('data', chunk => {
				// First, append the data to the buffer
				this.Append(chunk);

				// Then read and handle commands until no commands are left
				let response = this.Read();
				while (response != '') {
					that.emit('message', response);
					response = this.Read();
				}
			})

			socket.on('disconnect', () => {
				verbose('Client disconnected');
			});
		});

		this.server.listen(this._port, function () {
			that.emit('connect');
		});
	}

	// TODO: Clean this up.

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


	// FIXME: Read/Append should be optimized.
	private Read(): string {
		let bytesRead = this.bytesRead; // Do not update bytes read until we have hit a linefeed
		let currentByte = this.buffer.slice(bytesRead, bytesRead + 1).toString();

		while (currentByte != "\n") {
			bytesRead++;
			if (bytesRead > this.buffer.length) {
				return ''; // No message available
			}
			currentByte = this.buffer.slice(bytesRead, bytesRead + 1).toString();
		}

		let msg = this.buffer.slice(this.bytesRead, bytesRead).toString();
		this.bytesRead = bytesRead;

		return msg;
	}

	private Append(chunk: Buffer) {
		if (this.buffer.length === 0) {
			this.buffer = chunk;
			return;
		}
		let replacement = new Buffer(this.buffer.length + chunk.length);
		this.buffer.copy(replacement);
		chunk.copy(replacement, this.buffer.length);
		this.buffer = replacement;
	}

}