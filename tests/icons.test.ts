import assert from "node:assert/strict";
import { test } from "node:test";

import { contextGauge, iconsFor } from "../src/icons.ts";

const codepoint = (glyph: string): number => {
	assert.equal([...glyph].length, 1, `"${glyph}" is not a single code point`);
	return glyph.codePointAt(0) ?? 0;
};

test("nerd glyphs are single private-use code points, not escapes plus digits", () => {
	const icons = iconsFor("nerd");
	const expected: Array<[string, number]> = [
		[icons.thinking, 0xf09d1],
		[icons.git, 0xf418],
		[icons.context[0], 0xf0873],
		[icons.context[1], 0xf0875],
		[icons.context[2], 0xf029a],
		[icons.context[3], 0xf0874],
		[icons.cache, 0xf0e7],
		[icons.tps, 0xf0e4],
		[icons.duration, 0xf0150],
	];
	for (const [glyph, code] of expected) {
		assert.equal(codepoint(glyph), code, `expected U+${code.toString(16).toUpperCase()}`);
	}
});

test("the gauge steps through its four glyphs by usage", () => {
	const icons = iconsFor("nerd");
	assert.equal(contextGauge(icons, 5), icons.context[0]);
	assert.equal(contextGauge(icons, 21), icons.context[1]);
	assert.equal(contextGauge(icons, 60), icons.context[2]);
	assert.equal(contextGauge(icons, 90), icons.context[3]);
});

test("emoji and none sets are usable stand-ins", () => {
	assert.equal(codepoint(iconsFor("emoji").thinking), 0x1f9e0);
	assert.equal(iconsFor("none").git, "");
	assert.equal(contextGauge(iconsFor("none"), 90), "");
});
