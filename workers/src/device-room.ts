import type { WsEnvelope, WsRole } from './types';

interface SessionMeta {
	role: WsRole;
}

interface PendingCommand {
	id: string;
	name: string;
	args?: unknown;
	expiresAt: string;
	enqueuedAt: string;
}

/**
 * One Durable Object per companion deviceId.
 * Holds last status, pending commands, and WebSocket fan-out.
 */
export class DeviceRoom implements DurableObject {
	private lastStatus: WsEnvelope | null = null;
	private pendingCommands: PendingCommand[] = [];
	private pcOnline = false;

	constructor(private readonly ctx: DurableObjectState) {
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/status' && request.method === 'GET') {
			return Response.json({
				lastStatus: this.lastStatus,
				pcOnline: this.pcOnline,
				pendingCommands: this.pendingCommands.length,
			});
		}

		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('expected websocket', { status: 426 });
		}

		const role = url.searchParams.get('role') as WsRole | null;
		if (role !== 'pc' && role !== 'mobile') {
			return new Response('role=pc|mobile required', { status: 400 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server, [role]);
		server.serializeAttachment({ role } satisfies SessionMeta);

		if (role === 'pc') {
			this.pcOnline = true;
			this.broadcast(
				{ type: 'presence', online: true, at: new Date().toISOString() },
				'mobile',
			);
			this.flushCommandsToPc(server);
		} else if (this.lastStatus) {
			server.send(JSON.stringify(this.lastStatus));
			server.send(
				JSON.stringify({
					type: 'presence',
					online: this.pcOnline,
					at: new Date().toISOString(),
				}),
			);
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') return;
		let msg: WsEnvelope;
		try {
			msg = JSON.parse(message) as WsEnvelope;
		} catch {
			ws.send(JSON.stringify({ type: 'error', code: 'bad_json', message: 'invalid JSON' }));
			return;
		}

		const meta = (ws.deserializeAttachment() ?? {}) as SessionMeta;
		const type = msg.type;

		if (type === 'hello') {
			ws.send(JSON.stringify({ type: 'hello', protocol: 1, role: meta.role }));
			return;
		}

		if (meta.role === 'pc') {
			if (type === 'status') {
				this.lastStatus = msg;
				this.broadcast(msg, 'mobile');
				return;
			}
			if (type === 'ack') {
				const id = String(msg.id ?? '');
				this.pendingCommands = this.pendingCommands.filter((c) => c.id !== id);
				this.broadcast(msg, 'mobile');
				return;
			}
			if (type === 'presence') {
				this.pcOnline = Boolean(msg.online);
				this.broadcast(msg, 'mobile');
				return;
			}
		}

		if (meta.role === 'mobile') {
			if (type === 'settings.set') {
				this.broadcast(msg, 'pc');
				return;
			}
			if (type === 'command') {
				const id = String(msg.id ?? crypto.randomUUID());
				const name = String(msg.name ?? '');
				if (!name) {
					ws.send(JSON.stringify({ type: 'error', code: 'bad_command', message: 'name required' }));
					return;
				}
				const expiresAt =
					typeof msg.expiresAt === 'string'
						? msg.expiresAt
						: new Date(Date.now() + 60_000).toISOString();
				const cmd: PendingCommand = {
					id,
					name,
					args: msg.args,
					expiresAt,
					enqueuedAt: new Date().toISOString(),
				};
				this.pendingCommands.push(cmd);
				this.pruneCommands();
				const envelope = { type: 'command', ...cmd };
				this.broadcast(envelope, 'pc');
				ws.send(JSON.stringify({ type: 'command.queued', id }));
				return;
			}
		}

		ws.send(JSON.stringify({ type: 'error', code: 'unsupported', message: `unsupported type ${type}` }));
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const meta = (ws.deserializeAttachment() ?? {}) as SessionMeta;
		if (meta.role === 'pc') {
			const stillPc = this.ctx.getWebSockets('pc').length > 0;
			this.pcOnline = stillPc;
			if (!stillPc) {
				this.broadcast(
					{ type: 'presence', online: false, at: new Date().toISOString() },
					'mobile',
				);
			}
		}
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		try {
			ws.close(1011, 'error');
		} catch {
			/* ignore */
		}
	}

	private pruneCommands(): void {
		const now = Date.now();
		this.pendingCommands = this.pendingCommands.filter((c) => Date.parse(c.expiresAt) > now);
	}

	private flushCommandsToPc(ws: WebSocket): void {
		this.pruneCommands();
		for (const cmd of this.pendingCommands) {
			ws.send(JSON.stringify({ type: 'command', ...cmd }));
		}
	}

	private broadcast(msg: WsEnvelope, tag: WsRole): void {
		const data = JSON.stringify(msg);
		for (const peer of this.ctx.getWebSockets(tag)) {
			try {
				peer.send(data);
			} catch {
				/* drop */
			}
		}
	}
}
