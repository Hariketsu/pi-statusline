import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { iconsFor } from "../src/icons.ts";

/**
 * The docs show rendered lines. One of them drifted from the implementation once already
 * (the README used U+F04C5, the code drew U+F0E4, which looks nothing alike), so every
 * private-use glyph in the documentation is checked against the icon set.
 */
const documents = ["README.md", "README.zh-CN.md", "docs/configuration.md", "docs/internals.md"].map((name) =>
	readFileSync(new URL(`../${name}`, import.meta.url), "utf8"),
);

const isPrivateUse = (code: number): boolean =>
	(code >= 0xe000 && code <= 0xf8ff) || (code >= 0xf0000 && code <= 0xffffd);

test("every glyph shown in the documentation is one the extension draws", () => {
	const icons = iconsFor("nerd");
	const known = new Set(
		[icons.thinking, icons.git, icons.cache, icons.tps, icons.duration, ...icons.context].filter(Boolean),
	);

	let checked = 0;
	for (const text of documents) {
		for (const char of text) {
			const code = char.codePointAt(0) ?? 0;
			if (!isPrivateUse(code)) continue;
			checked += 1;
			assert.ok(
				known.has(char),
				`U+${code.toString(16).toUpperCase()} appears in the docs but the extension never draws it`,
			);
		}
	}
	assert.ok(checked >= 4, "expected the docs to show the icons, not just describe them");
});

test("the documentation shows the throughput glyph the code uses", () => {
	const sample = documents.join("\n");
	assert.ok(sample.includes(iconsFor("nerd").tps), "the docs must show the current throughput glyph");
});
