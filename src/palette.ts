/**
 * Colors.
 *
 * pi's `system` theme derives its palette from the terminal and desaturates it for
 * contrast, which leaves a status line of `text`/`muted`/`dim` segments almost
 * monochrome. So the status line can also paint itself with a fixed Gruvbox palette:
 * the dark one for dark terminals, the light one for light terminals.
 *
 * `auto` (the default) picks by the theme's appearance, `theme` uses the theme's own
 * semantic tokens, and `gruvbox`/`gruvbox-light` force one palette. Fixed colors are
 * only used when the terminal reports truecolor support; otherwise the theme tokens
 * are used, so nothing renders unstyled on a 16-color terminal.
 */

import type { Role } from "./types.ts";

export type PaletteMode = "auto" | "theme" | "gruvbox" | "gruvbox-light";

export type Rgb = readonly [number, number, number];

/** Gruvbox dark, bright variants for the values that need to stand out. */
const GRUVBOX_DARK: Record<Role, Rgb> = {
	accent: [69, 133, 136], // #458588 blue
	text: [235, 219, 178], // #EBDBB2 fg1
	muted: [168, 153, 132], // #A89984 fg4
	dim: [124, 111, 100], // #7C6F64 fg4 dim
	success: [184, 187, 38], // #B8BB26 bright green
	error: [251, 73, 52], // #FB4934 bright red
	warning: [250, 189, 47], // #FABD2F bright yellow
};

/** Gruvbox light: the same hues, dark enough to read on a white terminal. */
const GRUVBOX_LIGHT: Record<Role, Rgb> = {
	accent: [7, 102, 120], // #076678 blue
	text: [60, 56, 54], // #3C3836 fg1
	muted: [124, 111, 100], // #7C6F64 fg4
	dim: [146, 131, 116], // #928374 gray
	success: [121, 116, 14], // #79740E green
	error: [157, 0, 6], // #9D0006 red
	warning: [181, 118, 20], // #B57614 yellow
};

export interface ThemePalette {
	source: "theme";
}

export interface RgbPalette {
	source: "rgb";
	colors: Record<Role, Rgb>;
}

export type Palette = ThemePalette | RgbPalette;

export function resolvePalette(mode: PaletteMode, appearance: string, colorMode: string): Palette {
	if (mode === "theme") return { source: "theme" };
	if (colorMode !== "truecolor") return { source: "theme" };

	if (mode === "gruvbox") return { source: "rgb", colors: GRUVBOX_DARK };
	if (mode === "gruvbox-light") return { source: "rgb", colors: GRUVBOX_LIGHT };
	// auto
	return { source: "rgb", colors: appearance === "light" ? GRUVBOX_LIGHT : GRUVBOX_DARK };
}

/** `\x1b[0m` at the end keeps parts independent: pi resets styling per line. */
export function paintRgb(text: string, rgb: Rgb, bold = false): string {
	if (!text) return "";
	const weight = bold ? "1;" : "";
	return `\x1b[${weight}38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[0m`;
}
