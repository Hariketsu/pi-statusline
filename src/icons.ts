/**
 * Glyphs for each segment.
 *
 * `nerd` uses Nerd Font private-use codepoints; they need a patched font in the
 * terminal. `emoji` is a fallback for fonts that lack them, and `none` renders
 * the status line as plain text.
 */

export type IconSet = "nerd" | "emoji" | "none";

export interface Icons {
	thinking: string;
	git: string;
	/** Context gauge, from empty to full. */
	context: [string, string, string, string];
	cache: string;
	tps: string;
	duration: string;
}

const NERD: Icons = {
	thinking: "\uF09D1", // nf-md-brain
	git: "\uF418", // nf-oct-git_branch
	context: ["\uF0873", "\uF0875", "\uF029A", "\uF0874"], // nf-md-gauge_empty/low/mid/full
	cache: "\uF0E7", // nf-fa-bolt
	tps: "\uF0E4", // nf-fa-tachometer
	duration: "\uF0150", // nf-md-clock_outline
};

const EMOJI: Icons = {
	thinking: "🧠",
	git: "🌿",
	context: ["▁", "▃", "▅", "█"],
	cache: "⚡",
	tps: "🚀",
	duration: "⏱",
};

const NONE: Icons = {
	thinking: "",
	git: "",
	context: ["", "", "", ""],
	cache: "",
	tps: "",
	duration: "",
};

export function iconsFor(set: IconSet): Icons {
	if (set === "emoji") return EMOJI;
	if (set === "none") return NONE;
	return NERD;
}

/** Pick the gauge glyph for a context percentage. */
export function contextGauge(icons: Icons, percent: number): string {
	if (percent >= 85) return icons.context[3];
	if (percent >= 50) return icons.context[2];
	if (percent >= 20) return icons.context[1];
	return icons.context[0];
}
