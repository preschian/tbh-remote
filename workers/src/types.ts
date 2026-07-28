export interface Env {
	DB: D1Database;
	REVENUECAT_WEBHOOK_SECRET?: string;
}

export type SubscriptionStatus = 'none' | 'active' | 'grace' | 'expired';

export type DeviceRole = 'pc' | 'mobile';

/** PC is considered online if it posted status within this window. */
export const PC_ONLINE_WINDOW_MS = 20_000;

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

export function isActiveSub(status: SubscriptionStatus | null | undefined): boolean {
	return status === 'active' || status === 'grace';
}
