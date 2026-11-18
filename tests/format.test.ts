import assert from "node:assert/strict";
import { test } from "node:test";

import { basename, fmtDuration, fmtPercent, fmtTokens, shortModel } from "../src/format.ts";

test("fmtTokens keeps small numbers exact and shortens large ones", () => {
	assert.equal(fmtTokens(0), "0");
	assert.equal(fmtTokens(999), "999");
	assert.equal(fmtTokens(1200), "1.2k");
	assert.equal(fmtTokens(15_400), "15k");
	assert.equal(fmtTokens(432_000), "432k");
	assert.equal(fmtTokens(1_500_000), "1.5M");
	assert.equal(fmtTokens(-5), "0");
});

test("fmtDuration drops empty units", () => {
	assert.equal(fmtDuration(0), "0s");
	assert.equal(fmtDuration(59_000), "59s");
	assert.equal(fmtDuration(90_000), "1m");
	assert.equal(fmtDuration(3_720_000), "1h2m");
	assert.equal(fmtDuration(7_200_000), "2h");
	assert.equal(fmtDuration(183_600_000), "2d3h");
});

test("fmtPercent rounds within a tier", () => {
	assert.equal(fmtPercent(null), "?");
	assert.equal(fmtPercent(undefined), "?");
	assert.equal(fmtPercent(4.25), "4.3%");
	assert.equal(fmtPercent(42.4), "42%");
});

test("basename tolerates trailing separators and Windows paths", () => {
	assert.equal(basename("/a/b/"), "b");
	assert.equal(basename("C:\\Users\\dd\\proj"), "proj");
	assert.equal(basename("/"), "/");
});

test("shortModel keeps the last path segment and drops snapshot dates", () => {
	assert.equal(shortModel("anthropic/claude-sonnet-4-5-20250929"), "claude-sonnet-4-5");
	assert.equal(shortModel("provider/chat-model"), "chat-model");
	assert.equal(shortModel(undefined), "no-model");
	assert.ok(shortModel("a".repeat(40)).length <= 24);
});
