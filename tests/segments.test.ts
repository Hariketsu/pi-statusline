import assert from "node:assert/strict";
import { test } from "node:test";

import { iconsFor } from "../src/icons.ts";
import { renderSegments } from "../src/render.ts";
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
		contextPercent: 15,
		contextWindow: 1_000_000,
		cacheHitRate: 87,
		tokensPerSecond: 42.4,
		durationMs: 3_720_000,
		statuses: new Map(),
		...overrides,
	};
}

const plan = { icons: iconsFor("none") };

/** `id:text` per segment, whitespace collapsed, for readable assertions. */
const texts = (input: SegmentInput, options = {}) =>
	buildSegments(input, { ...plan, ...options }).map(
		(segment) => `${segment.id}:${segment.parts.map((part) => part.text).join("").trim()}`,
	);

test("builds one segment per available fact, in the default order", () => {
	assert.deepEqual(texts(baseInput()), [
		"model:chat-model",
		"thinking:max",
		"dir:pi-statusline",
		"git:feat/pi-statusline-plugin +12 −3",
		"context:15%/1M",
		"cache:87%",
		"tps:42.4t/s",
		"duration:1h2m",
	]);
});

test("nerd icons prefix the value but stay out of the number", () => {
	const segments = buildSegments(baseInput(), { icons: iconsFor("nerd") });
	const byId = new Map(segments.map((s) => [s.id, s.parts.map((p) => p.text).join("")]));
	assert.equal(byId.get("thinking"), "\uF09D1 max");
	assert.equal(byId.get("git"), "\uF418 feat/pi-statusline-plugin +12 −3");
	assert.ok(byId.get("context")?.startsWith("\uF0873"));
	assert.equal(byId.get("cache"), "\uF0E7 87%");
	assert.equal(byId.get("duration"), "\uF0150 1h2m");
});

test("git counts are colored independently from the branch", () => {
	const parts = buildSegments(baseInput(), plan).find((s) => s.id === "git")?.parts ?? [];
	assert.deepEqual(
		parts.map((part) => [part.text, part.role]),
		[
			["feat/pi-statusline-plugin", "muted"],
			[" +12", "success"],
			[" −3", "error"],
		],
	);
});

test("a clean tree shows the branch without counts", () => {
	assert.ok(texts(baseInput({ insertions: 0, deletions: 0 })).includes("git:feat/pi-statusline-plugin"));
});

test("outside a repository the git segment disappears", () => {
	assert.ok(!texts(baseInput({ branch: null, repo: false })).some((s) => s.startsWith("git:")));
});

test("context and cache colors follow their tiers", () => {
	const role = (id: "context" | "cache", overrides: Partial<SegmentInput>) =>
		buildSegments(baseInput(overrides), plan).find((s) => s.id === id)?.parts.at(-1)?.role;

	assert.equal(role("context", { contextPercent: 69 }), "text");
	assert.equal(role("context", { contextPercent: 71 }), "warning");
	assert.equal(role("context", { contextPercent: 91 }), "error");

	assert.equal(role("cache", { cacheHitRate: 95 }), "success");
	assert.equal(role("cache", { cacheHitRate: 60 }), "text");
	assert.equal(role("cache", { cacheHitRate: 20 }), "warning");
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
		width: 42,
		separator: " · ",
		colorize: (part) => part.text,
		visibleWidth: (text) => text.length,
		truncate: (text, limit) => text.slice(0, limit),
	});
	assert.ok(line.length <= 42);
	assert.ok(line.startsWith("chat-model"));
	assert.ok(!line.includes("working"), "the optional statuses segment goes first");
});

test("a line that fits keeps every segment, including separators", () => {
	const line = renderSegments(buildSegments(baseInput(), plan), {
		width: 200,
		separator: " · ",
		colorize: (part) => part.text,
		visibleWidth: (text) => text.length,
		truncate: (text, limit) => text.slice(0, limit),
	});
	assert.equal(
		line,
		"chat-model · max · pi-statusline · feat/pi-statusline-plugin +12 −3 · 15%/1M · 87% · 42.4t/s · 1h2m",
	);
});
