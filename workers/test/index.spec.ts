import { describe, expect, it } from 'vitest';

describe('tbh-remote worker module', () => {
	it('exports a fetch handler', async () => {
		const mod = await import('../src/index');
		expect(typeof mod.default.fetch).toBe('function');
	});
});
