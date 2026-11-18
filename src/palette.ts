/**
 * Colors.
 *
 * Why not just use pi's theme tokens: the `system` theme derives its palette from
 * the terminal and desaturates it for contrast, so a status line built from
 * `text`/`muted`/`dim` collapses into one grey line — especially on a light
 * terminal. Peer packages solve this the same way: identity colors are fixed
 * values, and only state (clean/dirty, context tiers) follows the theme.
 *
 * Three styles:
 *
 * - `chips`  — each run is drawn as a colored block (background + foreground),
 *              picked from Gruvbox Light or Dark by the terminal's appearance.
 * - `text`   — the same palette as foreground colors, no backgrounds.
 * - `theme`  — pi's own theme tokens, for people who want full theme following.
 *
 * Fixed colors are only used on truecolor terminals; elsewhere we fall back to
 * theme tokens so nothing renders unstyled.
 */

import type { Part, Role } from "./types.ts";

export type Style = "chips" | "text" | "theme";

export type Rgb = readonly [number, number, number];

export interface ChipColor {
	bg: Rgb;
	fg: Rgb;
}

const DARK_BG: Rgb = [40, 40, 40];
const LIGHT_BG: Rgb = [251, 241, 199];
const INK: Rgb = [40, 40, 40];

/** Saturated chips for dark terminals. */
const CHIPS_DARK: Record<Role, ChipColor> = {
	accent: { bg: [69, 133, 136], fg: LIGHT_BG },
	path: { bg: [104, 157, 106], fg: [29, 32, 33] },
	vcs: { bg: [177, 98, 134], fg: LIGHT_BG },
	speed: { bg: [175, 58, 3], fg: LIGHT_BG },
	text: { bg: [80, 73, 69], fg: LIGHT_BG },
	muted: { bg: [60, 56, 54], fg: [213, 196, 161] },
	dim: { bg: [50, 48, 47], fg: [168, 153, 132] },
	success: { bg: [152, 151, 26], fg: [29, 32, 33] },
	error: { bg: [204, 36, 29], fg: LIGHT_BG },
	warning: { bg: [215, 153, 33], fg: [29, 32, 33] },
};

/** The same hues, deepened so they read as blocks on a white terminal. */
const CHIPS_LIGHT: Record<Role, ChipColor> = {
	accent: { bg: [7, 102, 120], fg: LIGHT_BG },
	path: { bg: [66, 123, 88], fg: LIGHT_BG },
	vcs: { bg: [143, 63, 113], fg: LIGHT_BG },
	speed: { bg: [175, 58, 3], fg: LIGHT_BG },
	text: { bg: [213, 196, 161], fg: [60, 56, 54] },
	muted: { bg: [235, 219, 178], fg: [124, 111, 100] },
	dim: { bg: [242, 229, 188], fg: [146, 131, 116] },
	success: { bg: [121, 116, 14], fg: LIGHT_BG },
	error: { bg: [157, 0, 6], fg: LIGHT_BG },
	warning: { bg: [181, 118, 20], fg: LIGHT_BG },
};

/** Foreground-only variants: bright on dark, deep on light. */
const TEXT_DARK: Record<Role, Rgb> = {
	accent: [131, 165, 152],
	path: [142, 192, 124],
	vcs: [211, 134, 155],
	speed: [254, 128, 25],
	text: [235, 219, 178],
	muted: [168, 153, 132],
	dim: [146, 131, 116],
	success: [184, 187, 38],
	error: [251, 73, 52],
	warning: [250, 189, 47],
};

const TEXT_LIGHT: Record<Role, Rgb> = {
	// Measured from the Claude Code bar on a light terminal: the identity colors are
	// the same Gruvbox values as on dark, and only the quiet text is a mid grey.
	accent: [69, 133, 136], // #458588
	path: [104, 157, 106], // #689D6A
	vcs: [177, 98, 134], // #B16286
	speed: [175, 58, 3], // #AF3A03
	text: [60, 56, 54], // #3C3836
	muted: [107, 107, 107], // #6B6B6B
	dim: [138, 138, 138], // #8A8A8A
	success: [152, 151, 26], // #98971A
	error: [204, 36, 29], // #CC241D
	warning: [215, 153, 33], // #D79921
};

export type ResolvedStyle =
	| { kind: "theme" }
	| { kind: "text"; colors: Record<Role, Rgb> }
	| { kind: "chips"; chips: Record<Role, ChipColor>; colors: Record<Role, Rgb> };

export function resolveStyle(style: Style, appearance: string, colorMode: string): ResolvedStyle {
	if (style === "theme" || colorMode !== "truecolor") return { kind: "theme" };
	const light = appearance === "light";
	if (style === "chips") {
		return { kind: "chips", chips: light ? CHIPS_LIGHT : CHIPS_DARK, colors: light ? TEXT_LIGHT : TEXT_DARK };
	}
	return { kind: "text", colors: light ? TEXT_LIGHT : TEXT_DARK };
}

/** Paints one run (parts sharing a role) as a chip: one background, per-part foregrounds. */
export function paintChip(parts: Part[], chip: ChipColor): string {
	const body = parts
		.map((part) => `${part.bold ? "\x1b[1m" : ""}\x1b[38;2;${chip.fg[0]};${chip.fg[1]};${chip.fg[2]}m${part.text}`)
		.join("");
	return `\x1b[48;2;${chip.bg[0]};${chip.bg[1]};${chip.bg[2]}m${body}\x1b[0m`;
}

/** Paints one run with foreground color only. */
export function paintColor(parts: Part[], rgb: Rgb): string {
	return parts
		.map((part) => `\x1b[${part.bold ? "1;" : ""}38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${part.text}\x1b[0m`)
		.join("");
}

/** Chip backgrounds are visible on their own; a single space between them is enough. */
export function defaultSeparator(style: Style): string {
	return style === "chips" ? " " : " · ";
}

export const BACKGROUNDS = { dark: DARK_BG, light: LIGHT_BG, ink: INK };
