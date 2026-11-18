import assert from "node:assert/strict";
import { test } from "node:test";

import { type SegmentInput, buildSegments } from "../src/segments.ts";
import { renderSegments } from "../src/render.ts";
import { emptyTotals } from "../src/usage.ts";

function baseInput(overrides: Partial<SegmentInput> = {}): SegmentInput {
	return {
		cwd: "/home/you/src/pi-statusline",
		modelId: "provider/chat-model",
		thinkingLevel: "max",
		branch: "feat/pi-statusline-plugin",
		repo: true,
		insertions: 12,
		deletions: 3,
		contextPercent: 15,
		contextWindow: 500_000,
		usage: { totals: { ...emptyTotals(), input: 30_000, output: 8200, cost: 0.42 }, cacheHitRate: 87 },
		durationMs: 3_720_000,
		statuses: new Map(),
		...overrides,
	};
}

const texts = (input: SegmentInput, options = {}) =>
	buildSegments(input, options).map((segment) => `${segment.id}:${segment.text}`);

test("builds one segment per available fact, in the default order", () => {
	assert.deepEqual(texts(baseInput()), [
		"model:chat-model",
		"thinking:max",
		"dir:pi-statusline",
		"git:feat/pi-statusline-plugin +12 −3",
		"context:15%/500k",
		"usage:38k tok · 87% cache · $0.42",
		"duration:1h2m",
	]);
});

test("context color warns at 70% and errors above 90%", () => {
	const role = (percent: number) =>
		buildSegments(baseInput({ contextPercent: percent })).find((s) => s.id === "context")?.role;
	assert.equal(role(69), "dim");
	assert.equal(role(71), "warning");
	assert.equal(role(91), "error");
});

test("a clean tree shows the branch without counts", () => {
	assert.ok(texts(baseInput({ insertions: 0, deletions: 0 })).includes("git:feat/pi-statusline-plugin"));
});

test("outside a repository the git segment disappears", () => {
	assert.ok(!texts(baseInput({ branch: null, repo: false })).some((s) => s.startsWith("git:")));
});

test("thinking level off and missing values drop out", () => {
	assert.ok(!texts(baseInput({ thinkingLevel: "off" })).some((s) => s.startsWith("thinking:")));
	assert.ok(!texts(baseInput({ contextPercent: null })).some((s) => s.startsWith("context:")));
	assert.ok(!texts(baseInput({ durationMs: null })).some((s) => s.startsWith("duration:")));
});

test("model names can be overridden and statuses appended", () => {
	const input = baseInput({ statuses: new Map([["bg", "2 jobs"]]) });
	assert.deepEqual(texts(input, { modelNames: { "provider/chat-model": "chat model" } })[0], "model:chat model");
	assert.equal(texts(input).at(-1), "statuses:2 jobs");
	assert.ok(!texts(input, { showStatuses: false }).some((s) => s.startsWith("statuses:")));
});

test("a custom segment order is respected", () => {
	assert.deepEqual(texts(baseInput(), { order: ["dir", "model"] }), ["dir:pi-statusline", "model:chat-model"]);
});

test("rendering drops optional segments before truncating", () => {
	const segments = buildSegments(baseInput({ statuses: new Map([["x", "working"]]) }));
	const line = renderSegments(segments, {
		width: 40,
		separator: " · ",
		colorize: (_role, text) => text,
		visibleWidth: (text) => text.length,
		truncate: (text, limit) => text.slice(0, limit),
	});
	assert.ok(line.length <= 40);
	assert.ok(!line.includes("working"), "the optional statuses segment goes first");
	assert.ok(line.startsWith("chat-model"));
});

test("a line that fits keeps every segment", () => {
	const segments = buildSegments(baseInput());
	const line = renderSegments(segments, {
		width: 200,
		separator: " · ",
		colorize: (_role, text) => text,
		visibleWidth: (text) => text.length,
		truncate: (text, limit) => text.slice(0, limit),
	});
	assert.ok(line.includes("87% cache"));
	assert.ok(line.includes("1h2m"));
});
