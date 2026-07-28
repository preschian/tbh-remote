export interface Env {
	DEVICE_ROOM: DurableObjectNamespace;
	DB: D1Database;
	PAIRING: KVNamespace;
	REVENUECAT_WEBHOOK_SECRET?: string;
}

export type SubscriptionStatus = 'none' | 'active' | 'grace' | 'expired';

export type WsRole = 'pc' | 'mobile';

export interface WsEnvelope {
	type: string;
	[key: string]: unknown;
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
		},
	});
}

export function error(status: number, code: string, message: string): Response {
	return json({ error: { code, message } }, status);
}
