import assert from "node:assert/strict";
import { test } from "node:test";

import { collectUsage, emptyTotals, sessionStartMs } from "../src/usage.ts";

const assistant = (usage: Record<string, unknown>, timestamp = "2026-11-18T10:00:00.000Z") => ({
	type: "message",
	id: "x",
	parentId: null,
	timestamp,
	message: { role: "assistant", usage },
});

test("collectUsage sums every entry type pi's footer counts", () => {
	const entries = [
		assistant({ input: 100, output: 20, cacheRead: 300, cacheWrite: 50 }),
		{ type: "usage", usage: { input: 10, output: 5 } },
		{ type: "message", message: { role: "toolResult", usage: { input: 7, output: 0 } } },
		{ type: "compaction", usage: { input: 1000, output: 100 } },
		{ type: "message", message: { role: "user" } },
	];

	const { totals, cacheHitRate } = collectUsage(entries);
	assert.deepEqual(totals, {
		input: 1117,
		output: 125,
		cacheRead: 300,
		cacheWrite: 50,
	});
	// Only the assistant message above has a prompt, so it sets the hit rate.
	assert.equal(cacheHitRate, 300 / 450 * 100);
});

test("the cache hit rate follows the latest assistant message", () => {
	const { cacheHitRate } = collectUsage([
		assistant({ input: 0, output: 1, cacheRead: 100, cacheWrite: 0 }),
		assistant({ input: 100, output: 1, cacheRead: 0, cacheWrite: 0 }),
	]);
	assert.equal(cacheHitRate, 0);
});

test("a prompt without cached tokens reports no hit rate", () => {
	assert.equal(collectUsage([assistant({ input: 0, output: 0 })]).cacheHitRate, null);
	assert.deepEqual(collectUsage([]).totals, emptyTotals());
});

test("sessionStartMs uses the first parseable timestamp", () => {
	const entries = [
		{ type: "info", timestamp: "not a date" },
		{ type: "message", message: { role: "user" }, timestamp: "2026-11-18T10:00:00.000Z" },
	];
	assert.equal(sessionStartMs(entries), Date.parse("2026-11-18T10:00:00.000Z"));
	assert.equal(sessionStartMs([], 42), 42);
});
