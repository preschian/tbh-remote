import { bearerToken, newId, randomPairingCode, randomToken, sha256Hex } from './crypto';
import { error, json, type Env, type SubscriptionStatus } from './types';

const ACTIVE: SubscriptionStatus[] = ['active', 'grace'];

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
	await env.DB.prepare(
		`INSERT INTO device_tokens (token_hash, device_id, role) VALUES (?, ?, 'pc')`,
	)
		.bind(await sha256Hex(pcToken), deviceId)
		.run();

	let code = randomPairingCode();
	// Avoid accidental reuse while another code is live.
	for (let i = 0; i < 5; i++) {
		const hit = await env.PAIRING.get(`code:${code}`);
		if (!hit) break;
		code = randomPairingCode();
	}

	await env.PAIRING.put(`code:${code}`, deviceId, { expirationTtl: 120 });

	return json({ code, expiresIn: 120, deviceId, pcToken });
}

export async function pairClaim(request: Request, env: Env): Promise<Response> {
	const token = bearerToken(request);
	if (!token) return error(401, 'unauthorized', 'account token required');

	const account = await accountFromToken(env, token);
	if (!account) return error(401, 'unauthorized', 'invalid account token');
	if (!ACTIVE.includes(account.subscription_status)) {
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

	const deviceId = await env.PAIRING.get(`code:${code}`);
	if (!deviceId) return error(404, 'code_invalid_or_expired', 'Pairing code invalid or expired');

	await env.PAIRING.delete(`code:${code}`);

	const device = await env.DB.prepare('SELECT id, name FROM devices WHERE id = ?')
		.bind(deviceId)
		.first<{ id: string; name: string | null }>();
	if (!device) return error(404, 'device_not_found', 'Device not found');

	await env.DB.prepare(
		`UPDATE devices SET account_id = ?, paired_at = datetime('now'), last_seen_at = datetime('now') WHERE id = ?`,
	)
		.bind(account.id, deviceId)
		.run();

	const mobileToken = randomToken();
	await env.DB.prepare(
		`INSERT INTO device_tokens (token_hash, device_id, role, account_id) VALUES (?, ?, 'mobile', ?)`,
	)
		.bind(await sha256Hex(mobileToken), deviceId, account.id)
		.run();

	return json({
		deviceId,
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
		.all();

	return json({
		accountId: account.id,
		subscription: {
			status: account.subscription_status,
			productId: account.subscription_product_id,
			expiresAt: account.subscription_expires_at,
		},
		devices: results ?? [],
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

	return json({ ok: true });
}

/** Stub: verify secret and mark subscription active for matching app user. */
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

export async function authorizeWs(
	env: Env,
	role: 'pc' | 'mobile',
	deviceId: string,
	token: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
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

	// Unpaired PC may connect to mint presence before claim.
	if (row.account_id) {
		const status = row.subscription_status ?? 'none';
		if (!ACTIVE.includes(status)) {
			return {
				ok: false,
				response: error(402, 'subscription_required', 'Active subscription required'),
			};
		}
	} else if (role === 'mobile') {
		return {
			ok: false,
			response: error(402, 'subscription_required', 'Active subscription required'),
		};
	}

	return { ok: true };
}
