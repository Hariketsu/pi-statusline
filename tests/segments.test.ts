import assert from "node:assert/strict";
import { test } from "node:test";

import { iconsFor } from "../src/icons.ts";
import { groupRuns, renderSegments } from "../src/render.ts";
import { type SegmentInput, buildSegments } from "../src/segments.ts";

function baseInput(overrides: Partial<SegmentInput> = {}): SegmentInput {
	return {
		cwd: "/home/you/src/pi-statusline",
		modelId: "provider/chat-model",
		thinkingLevel: "max",
		branch: "feat/pi-statusline-plugin",
		repo: true,
		insertions: 12,
		deletions: 3,
		contextPercent: 23,
		contextWindow: 1_000_000,
		cacheHitRate: 100,
		tokensPerSecond: 42.4,
		durationMs: 5_160_000,
		statuses: new Map(),
		...overrides,
	};
}

const plan = { icons: iconsFor("none") };

/** `id:text` per segment, for readable assertions. */
const texts = (input: SegmentInput, options = {}) =>
	buildSegments(input, { ...plan, ...options }).map(
		(segment) => `${segment.id}:${segment.parts.map((part) => part.text).join("").trim()}`,
	);

const roleOf = (segmentId: string, input: SegmentInput, options = {}) =>
	buildSegments(input, { ...plan, ...options }).find((s) => s.id === segmentId)?.parts.at(-1)?.role;

test("builds one segment per available fact, in the default order", () => {
	assert.deepEqual(texts(baseInput()), [
		"model:chat-model",
		"thinking:max",
		"dir:pi-statusline",
		"git:feat/pi-statusline-plugin",
		"diff:+12−3",
		"context:23%/1M",
		"cache:100%",
		"tps:42.4t/s",
		"duration:1h26m",
	]);
});

test("identity segments carry distinct roles, not just text", () => {
	assert.equal(roleOf("model", baseInput()), "accent");
	assert.equal(roleOf("dir", baseInput()), "path");
	assert.equal(roleOf("git", baseInput()), "vcs");
	assert.equal(roleOf("thinking", baseInput()), "dim");
	assert.equal(roleOf("tps", baseInput()), "muted");
});

test("diff splits into green additions and red deletions", () => {
	const parts = buildSegments(baseInput(), plan).find((s) => s.id === "diff")?.parts ?? [];
	assert.deepEqual(
		parts.map((part) => [part.text, part.role, part.bold === true]),
		[
			["+12", "success", false],
			["−3", "error", false],
		],
	);
});

test("an icon shares its value's role so both paint as one block", () => {
	const segments = buildSegments(baseInput(), { icons: iconsFor("nerd") });
	const context = segments.find((s) => s.id === "context");
	assert.ok(context);
	assert.equal(new Set(context.parts.map((part) => part.role)).size, 1);
	assert.equal(groupRuns(context.parts).length, 1);
	assert.ok(context.parts[0].text.startsWith("\u{F0873}") || context.parts[0].text.startsWith("\u{F0875}"));
});

test("git and diff disappear when there is nothing to show", () => {
	assert.ok(!texts(baseInput({ insertions: 0, deletions: 0 })).some((s) => s.startsWith("diff:")));
	assert.ok(texts(baseInput({ insertions: 0, deletions: 0 })).includes("git:feat/pi-statusline-plugin"));
	assert.ok(!texts(baseInput({ branch: null, repo: false })).some((s) => s.startsWith("git:")));
});

test("context and cache colors follow their tiers", () => {
	assert.equal(roleOf("context", baseInput({ contextPercent: 40 })), "dim");
	assert.equal(roleOf("context", baseInput({ contextPercent: 75 })), "warning");
	assert.equal(roleOf("context", baseInput({ contextPercent: 95 })), "error");

	assert.equal(roleOf("cache", baseInput({ cacheHitRate: 95 })), "muted");
	assert.equal(roleOf("cache", baseInput({ cacheHitRate: 60 })), "muted");
	assert.equal(roleOf("cache", baseInput({ cacheHitRate: 20 })), "warning");
});

test("missing data drops its segment instead of printing a placeholder", () => {
	assert.ok(!texts(baseInput({ thinkingLevel: "off" })).some((s) => s.startsWith("thinking:")));
	assert.ok(!texts(baseInput({ contextPercent: null })).some((s) => s.startsWith("context:")));
	assert.ok(!texts(baseInput({ cacheHitRate: null })).some((s) => s.startsWith("cache:")));
	assert.ok(!texts(baseInput({ tokensPerSecond: null })).some((s) => s.startsWith("tps:")));
	assert.ok(!texts(baseInput({ durationMs: null })).some((s) => s.startsWith("duration:")));
});

test("model names can be overridden and statuses appended", () => {
	const input = baseInput({ statuses: new Map([["bg", "2 jobs"]]) });
	assert.equal(texts(input, { modelNames: { "provider/chat-model": "chat model" } })[0], "model:chat model");
	assert.equal(texts(input).at(-1), "statuses:2 jobs");
	assert.ok(!texts(input, { showStatuses: false }).some((s) => s.startsWith("statuses:")));
});

test("a custom segment order is respected", () => {
	assert.deepEqual(texts(baseInput(), { order: ["dir", "model"] }), ["dir:pi-statusline", "model:chat-model"]);
});

test("rendering drops optional segments before truncating", () => {
	const segments = buildSegments(baseInput({ statuses: new Map([["x", "working"]]) }), plan);
	const line = renderSegments(segments, {
		width: 40,
		separator: " ",
		paint: (parts) => parts.map((part) => part.text).join(""),
		visibleWidth: (text) => text.length,
		truncate: (text, limit) => text.slice(0, limit),
	});
	assert.ok(line.length <= 40);
	assert.ok(line.startsWith("chat-model"));
	assert.ok(!line.includes("working"), "the optional statuses segment goes first");
});

test("a line that fits keeps every segment", () => {
	const line = renderSegments(buildSegments(baseInput(), plan), {
		width: 200,
		separator: " ",
		paint: (parts) => parts.map((part) => part.text).join(""),
		visibleWidth: (text) => text.length,
		truncate: (text, limit) => text.slice(0, limit),
	});
	assert.equal(line, "chat-model max pi-statusline feat/pi-statusline-plugin +12 −3 23%/1M 100% 42.4t/s 1h26m");
});
