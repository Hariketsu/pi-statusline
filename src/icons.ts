/**
 * Glyphs for each segment.
 *
 * `nerd` uses Nerd Font private-use codepoints. They are five hex digits, so the
 * escapes must be `\u{...}`: `"\uF09D1"` would be parsed as `\uF09D` followed by
 * the character "1", which renders as the wrong glyph plus a stray digit.
 *
 * `emoji` is a fallback for fonts without Nerd Font, and `none` renders plain text.
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
	thinking: "\u{F09D1}", // nf-md-brain
	git: "\u{F418}", // nf-oct-git_branch
	context: ["\u{F0873}", "\u{F0875}", "\u{F029A}", "\u{F0874}"], // nf-md-gauge_empty/low/mid/full
	cache: "\u{F0E7}", // nf-fa-bolt
	tps: "\u{F04C5}", // nf-md-speedometer
	duration: "\u{F0150}", // nf-md-clock_outline
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
