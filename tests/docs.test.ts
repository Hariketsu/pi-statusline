import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { iconsFor } from "../src/icons.ts";

/**
 * The README shows a rendered sample line. It drifted from the implementation once
 * already (the doc used U+F04C5, the code U+F0E4, which look nothing alike), so the
 * sample is checked against the icon set.
 */
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const sample = readme.split("\n").find((line) => line.includes("pi-statusline ·") && line.includes("t/s"));

const isPrivateUse = (code: number): boolean =>
	(code >= 0xe000 && code <= 0xf8ff) || (code >= 0xf0000 && code <= 0xffffd);

test("the sample line in the README uses only glyphs from the icon set", () => {
	assert.ok(sample, "README has no sample line to check");
	const icons = iconsFor("nerd");
	const known = new Set(
		[icons.thinking, icons.git, icons.cache, icons.tps, icons.duration, ...icons.context].filter(Boolean),
	);

	const glyphs = [...(sample ?? "")].filter((char) => isPrivateUse(char.codePointAt(0) ?? 0));
	assert.ok(glyphs.length >= 4, "the sample should show the glyphs, not placeholder spaces");
	for (const glyph of glyphs) {
		assert.ok(known.has(glyph), `U+${(glyph.codePointAt(0) ?? 0).toString(16).toUpperCase()} in README is not an icon the extension draws`);
	}
	assert.ok(glyphs.includes(icons.tps), "the throughput glyph in the README must be the one the code uses");
});
