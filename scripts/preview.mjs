#!/usr/bin/env node
/**
 * Generates the README preview from the real pipeline.
 *
 * `buildSegments` → `renderSegments` → `palette` produce the exact line the footer draws,
 * with the real colors; this script only turns those ANSI escapes into HTML. The HTML is
 * meant to be screenshotted in a browser, because the local SVG rasterisers
 * (rsvg-convert, QuickLook) fall back to LastResort for Nerd Font glyphs and draw boxes.
 *
 *   node scripts/preview.mjs        # then screenshot the printed file path
 *
 * The font is loaded from disk through @font-face. Point PI_PREVIEW_FONT_FILE at any Nerd
 * Font if the default is not installed.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { iconsFor } from "../src/icons.ts";
import { defaultSeparator, paintColor, resolveStyle } from "../src/palette.ts";
import { renderSegments } from "../src/render.ts";
import { buildSegments } from "../src/segments.ts";

const fontFile =
	process.env.PI_PREVIEW_FONT_FILE ?? join(homedir(), "Library/Fonts/0xProtoNerdFontMono-Regular.ttf");

const sample = {
	cwd: "/home/you/src/pi-statusline",
	modelId: "provider/chat-model",
	thinkingLevel: "max",
	branch: "main",
	repo: true,
	insertions: 12,
	deletions: 3,
	ahead: 2,
	behind: 1,
	contextPercent: 15,
	contextWindow: 1_000_000,
	cacheHitRate: 100,
	tokensPerSecond: 42.4,
	durationMs: 3_720_000,
	statuses: new Map(),
};

const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

function line(appearance) {
	const style = resolveStyle("text", appearance, "truecolor");
	const segments = buildSegments(sample, { icons: iconsFor("nerd") });
	return renderSegments(segments, {
		width: 400,
		separator: defaultSeparator("text"),
		paint: (parts) =>
			style.kind === "text" ? paintColor(parts, style.colors[parts[0].role]) : parts.map((p) => p.text).join(""),
		visibleWidth: (text) => strip(text).length,
		truncate: (text) => text,
	});
}

/** ANSI SGR → span runs; only foreground color and bold occur here. */
function toHtml(ansi) {
	const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	let html = "";
	let color = null;
	let bold = false;
	let index = 0;

	while (index < ansi.length) {
		const rest = ansi.slice(index);
		const match = /\x1b\[([0-9;]*)m/.exec(rest);
		const text = match ? rest.slice(0, match.index) : rest;
		if (text) {
			const style = [color ? `color:${color}` : null, bold ? "font-weight:700" : null].filter(Boolean).join(";");
			html += `<span style="${style}">${escapeHtml(text)}</span>`;
		}
		if (!match) break;

		const params = match[1].split(";").filter(Boolean).map(Number);
		for (let i = 0; i < params.length; i++) {
			const p = params[i];
			if (p === 0) {
				color = null;
				bold = false;
			} else if (p === 1) bold = true;
			else if (p === 22) bold = false;
			else if (p === 38 && params[i + 1] === 2) {
				color = `rgb(${params[i + 2]},${params[i + 3]},${params[i + 4]})`;
				i += 4;
			}
		}
		index += match.index + match[0].length;
	}
	return html;
}

const panels = [
	["#ffffff", "#1d2021", line("light")],
	["#1d2021", "#ebdbb2", line("dark")],
];

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: Preview; src: url("${pathToFileURL(fontFile).href}") format("truetype"); }
  body { margin: 0; font: 400 20px/1 Preview, monospace; }
  .row { padding: 18px 24px; white-space: pre; }
  .light { background: ${panels[0][0]}; color: ${panels[0][1]}; }
  .dark { background: ${panels[1][0]}; color: ${panels[1][1]}; }
</style>
<div class="row light">${toHtml(panels[0][2])}</div>
<div class="row dark">${toHtml(panels[1][2])}</div>
`;

const outDir = join(tmpdir(), "pi-statusline-preview");
mkdirSync(outDir, { recursive: true });
const file = join(outDir, "preview.html");
writeFileSync(file, html);

// Width of the widest line, for a tight screenshot.
const columns = Math.max(strip(panels[0][2]).length, strip(panels[1][2]).length);
console.log(file);
console.log(`${columns} columns · font ${fontFile}`);
console.log(`repo: ${dirname(dirname(fileURLToPath(import.meta.url)))}`);
