/**
 * Joins segments into one line that fits the terminal width.
 *
 * Width handling is injected (pi-tui's visibleWidth/truncateToWidth in the
 * extension) so this module stays testable without pi installed.
 */

import type { Part, Segment } from "./types.ts";

export interface RenderOptions {
	width: number;
	separator: string;
	colorize(part: Part): string;
	visibleWidth(text: string): number;
	truncate(text: string, width: number): string;
}

/** Drops optional segments from the end until the line fits, then truncates. */
export function renderSegments(segments: Segment[], options: RenderOptions): string {
	const { width, separator, colorize, visibleWidth, truncate } = options;
	const kept = [...segments];

	const build = (): string =>
		kept.map((segment) => segment.parts.map(colorize).join("")).join(colorize({ text: separator, role: "dim" }));

	let line = build();
	while (visibleWidth(line) > width) {
		const index = findLastOptional(kept);
		if (index < 0) break;
		kept.splice(index, 1);
		line = build();
	}

	return visibleWidth(line) > width ? truncate(line, width) : line;
}

function findLastOptional(segments: Segment[]): number {
	for (let i = segments.length - 1; i >= 0; i--) {
		if (segments[i].optional) return i;
	}
	return -1;
}
