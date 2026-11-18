import assert from "node:assert/strict";
import { test } from "node:test";

import { paintRgb, resolvePalette } from "../src/palette.ts";

test("auto follows the terminal appearance", () => {
	const dark = resolvePalette("auto", "dark", "truecolor");
	const light = resolvePalette("auto", "light", "truecolor");
	assert.equal(dark.source, "rgb");
	assert.equal(light.source, "rgb");
	assert.notDeepEqual(dark, light);
	// Light terminals get the dark-on-white variants.
	assert.deepEqual(light.source === "rgb" ? light.colors.accent : null, [7, 102, 120]);
	assert.deepEqual(dark.source === "rgb" ? dark.colors.accent : null, [69, 133, 136]);
});

test("an explicit palette wins over appearance", () => {
	const forced = resolvePalette("gruvbox", "light", "truecolor");
	assert.deepEqual(forced.source === "rgb" ? forced.colors.accent : null, [69, 133, 136]);
	assert.deepEqual(
		resolvePalette("gruvbox-light", "dark", "truecolor").source === "rgb"
			? resolvePalette("gruvbox-light", "dark", "truecolor").colors.accent
			: null,
		[7, 102, 120],
	);
});

test("theme mode and low-color terminals fall back to theme tokens", () => {
	assert.equal(resolvePalette("theme", "light", "truecolor").source, "theme");
	assert.equal(resolvePalette("auto", "light", "256").source, "theme");
	assert.equal(resolvePalette("gruvbox", "dark", "ansi").source, "theme");
});

test("paintRgb emits a truecolor foreground and optional bold", () => {
	assert.equal(paintRgb("x", [1, 2, 3]), "\x1b[38;2;1;2;3mx\x1b[0m");
	assert.equal(paintRgb("x", [1, 2, 3], true), "\x1b[1;38;2;1;2;3mx\x1b[0m");
	assert.equal(paintRgb("", [1, 2, 3]), "");
});
