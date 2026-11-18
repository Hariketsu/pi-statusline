import assert from "node:assert/strict";
import { test } from "node:test";

import { TpsMeter, fmtTps } from "../src/tps.ts";

test("measures throughput between the first and last delta", () => {
	const meter = new TpsMeter();
	meter.start(1000);
	meter.delta(1400); // first delta, TTFT 400ms
	meter.delta(1600);
	meter.delta(2600); // 1.2s of generation
	meter.finish(60, 2600); // provider says 60 output tokens
	// 60 tokens over (2600 - 1400) ms = 1.2 s
	assert.equal(meter.get().tps, 50);
	assert.equal(meter.get().ttftMs, 400);
	assert.equal(meter.get().source, "deltas");
});

test("a single delta reports no rate yet and keeps the previous one", () => {
	const meter = new TpsMeter();
	meter.start(0);
	meter.delta(200);
	meter.finish(10, 200);
	assert.equal(meter.get().tps, null);

	meter.start(0);
	meter.delta(100);
	meter.delta(1100);
	meter.finish(20, 1100);
	assert.equal(meter.get().tps, 20);
});

test("without any stream delta the whole message window is used, and marked", () => {
	const meter = new TpsMeter();
	meter.start(1000);
	meter.finish(80, 3000); // no message_update at all
	assert.equal(meter.get().tps, 40); // 80 tokens over 2s
	assert.equal(meter.get().ttftMs, null);
	assert.equal(meter.get().source, "window");
	assert.equal(meter.estimated, true);
});

test("generation ends at the last delta, not at message_end", () => {
	const meter = new TpsMeter();
	meter.start(0);
	meter.delta(1000);
	meter.delta(2000); // 1s of generation
	meter.finish(60, 5000); // stream teardown takes another 3s
	assert.equal(meter.get().tps, 60); // 60 tokens over 1s, not 5s
	assert.equal(meter.get().source, "deltas");
});

test("without usage the delta count is the fallback", () => {
	const meter = new TpsMeter();
	meter.start(0);
	meter.delta(100);
	meter.delta(600);
	meter.delta(1100);
	meter.finish(null, 1100);
	// 3 deltas over 1s
	assert.equal(meter.get().tps, 3);
});

test("fmtTps keeps one decimal only below 100", () => {
	assert.equal(fmtTps(null), null);
	assert.equal(fmtTps(0), null);
	assert.equal(fmtTps(9.42), "9.4t/s");
	assert.equal(fmtTps(42.0), "42t/s");
	assert.equal(fmtTps(128.6), "129t/s");
});
