import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultSeparator, paintChip, paintColor, resolveStyle } from "../src/palette.ts";
import type { Part } from "../src/types.ts";

const part = (text: string, role: Part["role"] = "accent", bold = false): Part => ({ text, role, bold });

test("chips pick a light or dark palette from the appearance", () => {
	const dark = resolveStyle("chips", "dark", "truecolor");
	const light = resolveStyle("chips", "light", "truecolor");
	assert.equal(dark.kind, "chips");
	assert.equal(light.kind, "chips");
	if (dark.kind !== "chips" || light.kind !== "chips") return;

	assert.deepEqual(dark.chips.accent.bg, [69, 133, 136]);
	assert.deepEqual(light.chips.accent.bg, [7, 102, 120]);
	// Every role needs a background and a foreground with visible separation.
	for (const role of Object.keys(dark.chips) as Array<keyof typeof dark.chips>) {
		const { bg, fg } = dark.chips[role];
		const lum = (rgb: readonly number[]) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
		assert.ok(Math.abs(lum(bg) - lum(fg)) > 40, `${role} chip is too flat`);
	}
});

test("text style is foreground-only, theme style defers to pi", () => {
	const text = resolveStyle("text", "light", "truecolor");
	assert.equal(text.kind, "text");
	assert.equal(resolveStyle("theme", "light", "truecolor").kind, "theme");
});

test("anything below truecolor falls back to theme tokens", () => {
	assert.equal(resolveStyle("chips", "dark", "256").kind, "theme");
	assert.equal(resolveStyle("text", "light", "ansi").kind, "theme");
});

test("paintChip sets a background once and a foreground per part", () => {
	const out = paintChip([part("󰧑 ", "muted"), part("max", "muted")], { bg: [60, 56, 54], fg: [213, 196, 161] });
	assert.ok(out.startsWith("\x1b[48;2;60;56;54m"));
	assert.equal((out.match(/\x1b\[48;2;/g) ?? []).length, 1);
	assert.equal((out.match(/\x1b\[38;2;213;196;161m/g) ?? []).length, 2);
	assert.ok(out.endsWith("\x1b[0m"));
});

test("paintChip keeps bold on the parts that ask for it", () => {
	const out = paintChip([part("+12", "success", true)], { bg: [152, 151, 26], fg: [29, 32, 33] });
	assert.ok(out.includes("\x1b[1m"));
});

test("paintColor emits foregrounds only", () => {
	const out = paintColor([part("x", "accent")], [131, 165, 152]);
	assert.equal(out, "\x1b[38;2;131;165;152mx\x1b[0m");
	assert.ok(!out.includes("48;2;"));
});

test("chips are separated by a space, colored text by a dot", () => {
	assert.equal(defaultSeparator("chips"), " ");
	assert.equal(defaultSeparator("text"), " · ");
	assert.equal(defaultSeparator("theme"), " · ");
});
