import {
	ackCommand,
	bootstrapAccount,
	enqueueCommand,
	getSettings,
	getStatus,
	listCommands,
	me,
	pairClaim,
	pairStart,
	putSettings,
	putStatus,
	revenueCatWebhook,
	unpairDevice,
} from './routes';
import { error, json, type Env } from './types';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;
		const method = request.method;

		if (method === 'GET' && pathname === '/') {
			return json({
				service: 'tbh-remote',
				transport: 'http+d1',
				docs: 'https://github.com/preschian/tbh-remote',
			});
		}

		if (method === 'GET' && pathname === '/health') {
			return json({ ok: true });
		}

		if (method === 'POST' && pathname === '/v1/accounts/bootstrap') {
			return bootstrapAccount(request, env);
		}
		if (method === 'POST' && pathname === '/v1/pair/start') {
			return pairStart(request, env);
		}
		if (method === 'POST' && pathname === '/v1/pair/claim') {
			return pairClaim(request, env);
		}
		if (method === 'GET' && pathname === '/v1/me') {
			return me(request, env);
		}
		if (method === 'POST' && pathname === '/v1/webhooks/revenuecat') {
			return revenueCatWebhook(request, env);
		}

		const deviceMatch = /^\/v1\/devices\/([^/]+)(?:\/(.*))?$/.exec(pathname);
		if (deviceMatch) {
			const deviceId = decodeURIComponent(deviceMatch[1]!);
			const rest = deviceMatch[2] ?? '';

			if (method === 'DELETE' && rest === '') {
				return unpairDevice(request, env, deviceId);
			}
			if (rest === 'status' && method === 'PUT') {
				return putStatus(request, env, deviceId);
			}
			if (rest === 'status' && method === 'GET') {
				return getStatus(request, env, deviceId);
			}
			if (rest === 'settings' && method === 'PUT') {
				return putSettings(request, env, deviceId);
			}
			if (rest === 'settings' && method === 'GET') {
				return getSettings(request, env, deviceId);
			}
			if (rest === 'commands' && method === 'POST') {
				return enqueueCommand(request, env, deviceId);
			}
			if (rest === 'commands' && method === 'GET') {
				return listCommands(request, env, deviceId);
			}
			const ackMatch = /^commands\/([^/]+)\/ack$/.exec(rest);
			if (ackMatch && method === 'POST') {
				return ackCommand(request, env, deviceId, decodeURIComponent(ackMatch[1]!));
			}
		}

		return error(404, 'not_found', 'not found');
	},
} satisfies ExportedHandler<Env>;
