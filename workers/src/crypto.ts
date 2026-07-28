/** Hash a bearer token for storage (never store raw tokens in D1). */
export async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomPairingCode(): string {
	const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
	return n.toString().padStart(6, '0');
}

export function newId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function bearerToken(request: Request): string | null {
	const h = request.headers.get('authorization');
	if (!h) return null;
	const m = /^Bearer\s+(.+)$/i.exec(h.trim());
	return m?.[1]?.trim() || null;
}
