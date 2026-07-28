import { describe, expect, it } from 'vitest';

// Smoke placeholder — full D1/DO integration tests land in phase 1.
describe('tbh-remote worker module', () => {
	it('exports a fetch handler shape via dynamic import', async () => {
		const mod = await import('../src/index');
		expect(typeof mod.default.fetch).toBe('function');
		expect(mod.DeviceRoom).toBeTypeOf('function');
	});
});
