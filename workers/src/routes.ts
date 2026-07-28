import { bearerToken, newId, randomPairingCode, randomToken, sha256Hex } from './crypto';
import {
	error,
	isActiveSub,
	json,
	PC_ONLINE_WINDOW_MS,
	type DeviceRole,
	type Env,
	type SubscriptionStatus,
} from './types';

export async function bootstrapAccount(request: Request, env: Env): Promise<Response> {
	let body: { clientId?: string };
	try {
		body = (await request.json()) as { clientId?: string };
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}
	const clientId = body.clientId?.trim();
	if (!clientId) return error(400, 'bad_request', 'clientId required');

	const existing = await env.DB.prepare(
		'SELECT id, subscription_status, subscription_product_id FROM accounts WHERE client_id = ?',
	)
		.bind(clientId)
		.first<{ id: string; subscription_status: SubscriptionStatus; subscription_product_id: string | null }>();

	let accountId = existing?.id;
	if (!accountId) {
		accountId = newId('acc');
		await env.DB.prepare('INSERT INTO accounts (id, client_id) VALUES (?, ?)').bind(accountId, clientId).run();
	}

	const accountToken = randomToken();
	await env.DB.prepare('INSERT INTO account_tokens (token_hash, account_id) VALUES (?, ?)')
		.bind(await sha256Hex(accountToken), accountId)
		.run();

	const status = existing?.subscription_status ?? 'none';
	return json({
		accountId,
		accountToken,
		subscription: {
			status,
			productId: existing?.subscription_product_id ?? null,
		},
	});
}

export async function pairStart(request: Request, env: Env): Promise<Response> {
	let body: { deviceId?: string; deviceName?: string };
	try {
		body = (await request.json()) as { deviceId?: string; deviceName?: string };
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}
	const deviceId = body.deviceId?.trim();
	if (!deviceId) return error(400, 'bad_request', 'deviceId required');
	const deviceName = body.deviceName?.trim() || null;

	const row = await env.DB.prepare('SELECT id FROM devices WHERE id = ?').bind(deviceId).first();
	if (!row) {
		await env.DB.prepare('INSERT INTO devices (id, name) VALUES (?, ?)').bind(deviceId, deviceName).run();
	} else if (deviceName) {
		await env.DB.prepare('UPDATE devices SET name = ? WHERE id = ?').bind(deviceName, deviceId).run();
	}

	const pcToken = randomToken();
	await env.DB.prepare(`INSERT INTO device_tokens (token_hash, device_id, role) VALUES (?, ?, 'pc')`)
		.bind(await sha256Hex(pcToken), deviceId)
		.run();

	await env.DB.prepare(`DELETE FROM pairing_codes WHERE expires_at < datetime('now')`).run();

	let code = randomPairingCode();
	for (let i = 0; i < 5; i++) {
		const hit = await env.DB.prepare('SELECT code FROM pairing_codes WHERE code = ?').bind(code).first();
		if (!hit) break;
		code = randomPairingCode();
	}

	await env.DB.prepare(
		`INSERT INTO pairing_codes (code, device_id, expires_at)
     VALUES (?, ?, datetime('now', '+120 seconds'))
     ON CONFLICT(code) DO UPDATE SET device_id = excluded.device_id, expires_at = excluded.expires_at`,
	)
		.bind(code, deviceId)
		.run();

	return json({ code, expiresIn: 120, deviceId, pcToken });
}

export async function pairClaim(request: Request, env: Env): Promise<Response> {
	const token = bearerToken(request);
	if (!token) return error(401, 'unauthorized', 'account token required');

	const account = await accountFromToken(env, token);
	if (!account) return error(401, 'unauthorized', 'invalid account token');
	if (!isActiveSub(account.subscription_status)) {
		return error(402, 'subscription_required', 'Active subscription required to pair');
	}

	let body: { code?: string };
	try {
		body = (await request.json()) as { code?: string };
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}
	const code = body.code?.trim();
	if (!code || !/^\d{6}$/.test(code)) return error(400, 'bad_request', '6-digit code required');

	const pair = await env.DB.prepare(
		`SELECT device_id FROM pairing_codes
     WHERE code = ? AND expires_at >= datetime('now')`,
	)
		.bind(code)
		.first<{ device_id: string }>();
	if (!pair) return error(404, 'code_invalid_or_expired', 'Pairing code invalid or expired');

	await env.DB.prepare('DELETE FROM pairing_codes WHERE code = ?').bind(code).run();

	const device = await env.DB.prepare('SELECT id, name FROM devices WHERE id = ?')
		.bind(pair.device_id)
		.first<{ id: string; name: string | null }>();
	if (!device) return error(404, 'device_not_found', 'Device not found');

	await env.DB.prepare(
		`UPDATE devices SET account_id = ?, paired_at = datetime('now'), last_seen_at = datetime('now') WHERE id = ?`,
	)
		.bind(account.id, device.id)
		.run();

	const mobileToken = randomToken();
	await env.DB.prepare(
		`INSERT INTO device_tokens (token_hash, device_id, role, account_id) VALUES (?, ?, 'mobile', ?)`,
	)
		.bind(await sha256Hex(mobileToken), device.id, account.id)
		.run();

	return json({
		deviceId: device.id,
		deviceName: device.name,
		mobileToken,
	});
}

export async function me(request: Request, env: Env): Promise<Response> {
	const token = bearerToken(request);
	if (!token) return error(401, 'unauthorized', 'account token required');
	const account = await accountFromToken(env, token);
	if (!account) return error(401, 'unauthorized', 'invalid account token');

	const { results } = await env.DB.prepare(
		`SELECT id, name, paired_at, last_seen_at FROM devices WHERE account_id = ? ORDER BY paired_at DESC`,
	)
		.bind(account.id)
		.all<{ id: string; name: string | null; paired_at: string | null; last_seen_at: string | null }>();

	const devices = (results ?? []).map((d) => ({
		...d,
		pcOnline: isPcOnline(d.last_seen_at),
	}));

	return json({
		accountId: account.id,
		subscription: {
			status: account.subscription_status,
			productId: account.subscription_product_id,
			expiresAt: account.subscription_expires_at,
		},
		devices,
	});
}

export async function unpairDevice(request: Request, env: Env, deviceId: string): Promise<Response> {
	const token = bearerToken(request);
	if (!token) return error(401, 'unauthorized', 'account token required');
	const account = await accountFromToken(env, token);
	if (!account) return error(401, 'unauthorized', 'invalid account token');

	const device = await env.DB.prepare('SELECT id FROM devices WHERE id = ? AND account_id = ?')
		.bind(deviceId, account.id)
		.first();
	if (!device) return error(404, 'device_not_found', 'Device not found');

	await env.DB.prepare(`UPDATE device_tokens SET revoked_at = datetime('now') WHERE device_id = ?`)
		.bind(deviceId)
		.run();
	await env.DB.prepare(`UPDATE devices SET account_id = NULL, paired_at = NULL WHERE id = ?`)
		.bind(deviceId)
		.run();
	await env.DB.prepare('DELETE FROM device_status WHERE device_id = ?').bind(deviceId).run();
	await env.DB.prepare('DELETE FROM device_commands WHERE device_id = ?').bind(deviceId).run();

	return json({ ok: true });
}

export async function putStatus(request: Request, env: Env, deviceId: string): Promise<Response> {
	const auth = await authorizeDevice(env, 'pc', deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}

	const text = JSON.stringify(payload);
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO device_status (device_id, payload, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(device_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
		).bind(deviceId, text),
		env.DB.prepare(`UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?`).bind(deviceId),
	]);

	return json({ ok: true });
}

export async function getStatus(request: Request, env: Env, deviceId: string): Promise<Response> {
	const auth = await authorizeMobileOrAccount(env, deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	const device = await env.DB.prepare('SELECT last_seen_at, desired_settings FROM devices WHERE id = ?')
		.bind(deviceId)
		.first<{ last_seen_at: string | null; desired_settings: string | null }>();
	if (!device) return error(404, 'device_not_found', 'Device not found');

	const row = await env.DB.prepare('SELECT payload, updated_at FROM device_status WHERE device_id = ?')
		.bind(deviceId)
		.first<{ payload: string; updated_at: string }>();

	let status: unknown = null;
	if (row) {
		try {
			status = JSON.parse(row.payload);
		} catch {
			status = null;
		}
	}

	let desiredSettings: unknown = null;
	if (device.desired_settings) {
		try {
			desiredSettings = JSON.parse(device.desired_settings);
		} catch {
			desiredSettings = null;
		}
	}

	return json({
		pcOnline: isPcOnline(device.last_seen_at),
		updatedAt: row?.updated_at ?? null,
		status,
		desiredSettings,
	});
}

export async function putSettings(request: Request, env: Env, deviceId: string): Promise<Response> {
	const auth = await authorizeMobileOrAccount(env, deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}

	await env.DB.prepare(`UPDATE devices SET desired_settings = ? WHERE id = ?`)
		.bind(JSON.stringify(payload), deviceId)
		.run();

	return json({ ok: true });
}

export async function getSettings(request: Request, env: Env, deviceId: string): Promise<Response> {
	const auth = await authorizeDevice(env, 'pc', deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	const device = await env.DB.prepare('SELECT desired_settings FROM devices WHERE id = ?')
		.bind(deviceId)
		.first<{ desired_settings: string | null }>();
	if (!device) return error(404, 'device_not_found', 'Device not found');

	let desiredSettings: unknown = null;
	if (device.desired_settings) {
		try {
			desiredSettings = JSON.parse(device.desired_settings);
		} catch {
			desiredSettings = null;
		}
	}

	await env.DB.prepare(`UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?`).bind(deviceId).run();

	return json({ desiredSettings });
}

export async function enqueueCommand(request: Request, env: Env, deviceId: string): Promise<Response> {
	const auth = await authorizeMobileOrAccount(env, deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	let body: { id?: string; name?: string; args?: unknown; expiresInSec?: number };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}

	const name = body.name?.trim();
	if (!name) return error(400, 'bad_request', 'name required');
	const id = body.id?.trim() || newId('cmd');
	const expiresInSec =
		typeof body.expiresInSec === 'number' && body.expiresInSec > 0 && body.expiresInSec <= 300
			? Math.floor(body.expiresInSec)
			: 60;

	await env.DB.prepare(
		`INSERT INTO device_commands (id, device_id, name, args, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', ?))`,
	)
		.bind(id, deviceId, name, body.args === undefined ? null : JSON.stringify(body.args), `+${expiresInSec} seconds`)
		.run();

	return json({ id, name, expiresInSec }, 201);
}

export async function listCommands(request: Request, env: Env, deviceId: string): Promise<Response> {
	const auth = await authorizeDevice(env, 'pc', deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	await env.DB.prepare(`UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?`).bind(deviceId).run();

	const { results } = await env.DB.prepare(
		`SELECT id, name, args, expires_at, created_at FROM device_commands
     WHERE device_id = ? AND acked_at IS NULL AND expires_at >= datetime('now')
     ORDER BY created_at ASC
     LIMIT 50`,
	)
		.bind(deviceId)
		.all<{ id: string; name: string; args: string | null; expires_at: string; created_at: string }>();

	const commands = (results ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		args: c.args ? safeJson(c.args) : null,
		expiresAt: c.expires_at,
		createdAt: c.created_at,
	}));

	return json({ commands });
}

export async function ackCommand(
	request: Request,
	env: Env,
	deviceId: string,
	commandId: string,
): Promise<Response> {
	const auth = await authorizeDevice(env, 'pc', deviceId, bearerToken(request));
	if (!auth.ok) return auth.response;

	let body: { ok?: boolean; error?: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}

	const existing = await env.DB.prepare(
		`SELECT id FROM device_commands WHERE id = ? AND device_id = ? AND acked_at IS NULL`,
	)
		.bind(commandId, deviceId)
		.first();
	if (!existing) return error(404, 'command_not_found', 'Command not found or already acked');

	await env.DB.prepare(
		`UPDATE device_commands
     SET acked_at = datetime('now'), ack_ok = ?, ack_error = ?
     WHERE id = ?`,
	)
		.bind(body.ok === false ? 0 : 1, body.error ?? null, commandId)
		.run();

	return json({ ok: true });
}

export async function revenueCatWebhook(request: Request, env: Env): Promise<Response> {
	const secret = env.REVENUECAT_WEBHOOK_SECRET;
	if (secret) {
		const auth = request.headers.get('authorization');
		if (auth !== `Bearer ${secret}`) return error(401, 'unauthorized', 'bad webhook secret');
	}

	let body: {
		event?: { app_user_id?: string; type?: string; expiration_at_ms?: number; product_id?: string };
	};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, 'bad_request', 'JSON body required');
	}

	const appUserId = body.event?.app_user_id;
	if (!appUserId) return error(400, 'bad_request', 'app_user_id required');

	const type = body.event?.type ?? '';
	const activeTypes = new Set([
		'INITIAL_PURCHASE',
		'RENEWAL',
		'UNCANCELLATION',
		'PRODUCT_CHANGE',
		'NON_RENEWING_PURCHASE',
	]);
	const expiredTypes = new Set(['EXPIRATION', 'REFUND']);

	let status: SubscriptionStatus = 'none';
	if (activeTypes.has(type)) status = 'active';
	else if (type === 'BILLING_ISSUE') status = 'grace';
	else if (expiredTypes.has(type)) status = 'expired';
	else return json({ ok: true, ignored: true });

	const expiresAt =
		typeof body.event?.expiration_at_ms === 'number'
			? new Date(body.event.expiration_at_ms).toISOString()
			: null;

	await env.DB.prepare(
		`UPDATE accounts
     SET subscription_status = ?,
         subscription_product_id = COALESCE(?, subscription_product_id),
         subscription_expires_at = ?,
         revenuecat_app_user_id = ?
     WHERE id = ? OR revenuecat_app_user_id = ? OR client_id = ?`,
	)
		.bind(status, body.event?.product_id ?? null, expiresAt, appUserId, appUserId, appUserId, appUserId)
		.run();

	return json({ ok: true, status });
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function isPcOnline(lastSeenAt: string | null | undefined): boolean {
	if (!lastSeenAt) return false;
	// D1 datetime('now') is UTC-ish SQLite time; parse as UTC when no zone.
	const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(lastSeenAt) ? lastSeenAt : `${lastSeenAt.replace(' ', 'T')}Z`;
	const t = Date.parse(normalized);
	if (Number.isNaN(t)) return false;
	return Date.now() - t <= PC_ONLINE_WINDOW_MS;
}

async function accountFromToken(env: Env, token: string) {
	const hash = await sha256Hex(token);
	return env.DB.prepare(
		`SELECT a.id, a.subscription_status, a.subscription_product_id, a.subscription_expires_at
     FROM account_tokens t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.token_hash = ? AND t.revoked_at IS NULL`,
	)
		.bind(hash)
		.first<{
			id: string;
			subscription_status: SubscriptionStatus;
			subscription_product_id: string | null;
			subscription_expires_at: string | null;
		}>();
}

async function authorizeDevice(
	env: Env,
	role: DeviceRole,
	deviceId: string,
	token: string | null,
): Promise<{ ok: true } | { ok: false; response: Response }> {
	if (!token) return { ok: false, response: error(401, 'unauthorized', 'token required') };
	const hash = await sha256Hex(token);
	const row = await env.DB.prepare(
		`SELECT dt.role, d.account_id, a.subscription_status
     FROM device_tokens dt
     JOIN devices d ON d.id = dt.device_id
     LEFT JOIN accounts a ON a.id = d.account_id
     WHERE dt.token_hash = ? AND dt.device_id = ? AND dt.revoked_at IS NULL`,
	)
		.bind(hash, deviceId)
		.first<{ role: string; account_id: string | null; subscription_status: SubscriptionStatus | null }>();

	if (!row || row.role !== role) {
		return { ok: false, response: error(401, 'unauthorized', 'invalid device token') };
	}

	if (row.account_id && !isActiveSub(row.subscription_status)) {
		return {
			ok: false,
			response: error(402, 'subscription_required', 'Active subscription required'),
		};
	}
	if (!row.account_id && role === 'mobile') {
		return {
			ok: false,
			response: error(402, 'subscription_required', 'Active subscription required'),
		};
	}

	return { ok: true };
}

/** Mobile device token or owning account token. */
async function authorizeMobileOrAccount(
	env: Env,
	deviceId: string,
	token: string | null,
): Promise<{ ok: true } | { ok: false; response: Response }> {
	if (!token) return { ok: false, response: error(401, 'unauthorized', 'token required') };

	const asMobile = await authorizeDevice(env, 'mobile', deviceId, token);
	if (asMobile.ok) return asMobile;

	const account = await accountFromToken(env, token);
	if (!account) return { ok: false, response: error(401, 'unauthorized', 'invalid token') };
	if (!isActiveSub(account.subscription_status)) {
		return {
			ok: false,
			response: error(402, 'subscription_required', 'Active subscription required'),
		};
	}

	const owned = await env.DB.prepare('SELECT id FROM devices WHERE id = ? AND account_id = ?')
		.bind(deviceId, account.id)
		.first();
	if (!owned) return { ok: false, response: error(404, 'device_not_found', 'Device not found') };
	return { ok: true };
}
