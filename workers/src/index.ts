import { DeviceRoom } from './device-room';
import {
	authorizeWs,
	bootstrapAccount,
	me,
	pairClaim,
	pairStart,
	revenueCatWebhook,
	unpairDevice,
} from './routes';
import { error, json, type Env } from './types';

export { DeviceRoom };

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;

		if (request.method === 'GET' && pathname === '/') {
			return json({
				service: 'tbh-remote',
				docs: 'https://github.com/preschian/tbh-remote',
			});
		}

		if (request.method === 'GET' && pathname === '/health') {
			return json({ ok: true });
		}

		if (request.method === 'POST' && pathname === '/v1/accounts/bootstrap') {
			return bootstrapAccount(request, env);
		}
		if (request.method === 'POST' && pathname === '/v1/pair/start') {
			return pairStart(request, env);
		}
		if (request.method === 'POST' && pathname === '/v1/pair/claim') {
			return pairClaim(request, env);
		}
		if (request.method === 'GET' && pathname === '/v1/me') {
			return me(request, env);
		}
		if (request.method === 'DELETE' && pathname.startsWith('/v1/devices/')) {
			const deviceId = decodeURIComponent(pathname.slice('/v1/devices/'.length));
			return unpairDevice(request, env, deviceId);
		}
		if (request.method === 'POST' && pathname === '/v1/webhooks/revenuecat') {
			return revenueCatWebhook(request, env);
		}

		if (pathname === '/v1/ws') {
			const role = url.searchParams.get('role');
			const deviceId = url.searchParams.get('deviceId');
			const token = url.searchParams.get('token');
			if ((role !== 'pc' && role !== 'mobile') || !deviceId || !token) {
				return error(400, 'bad_request', 'role, deviceId, and token are required');
			}

			const auth = await authorizeWs(env, role, deviceId, token);
			if (!auth.ok) return auth.response;

			const id = env.DEVICE_ROOM.idFromName(deviceId);
			const stub = env.DEVICE_ROOM.get(id);
			const doUrl = new URL(request.url);
			doUrl.pathname = '/';
			return stub.fetch(new Request(doUrl, request));
		}

		return error(404, 'not_found', 'not found');
	},
} satisfies ExportedHandler<Env>;
