/**
 * Joins segments into one line that fits the terminal width.
 *
 * Parts that share a role are painted as one run, so a chip can contain an icon
 * and its value while `+12` and `−3` still become separate blocks. Width handling
 * and painting are injected, which keeps this module testable without pi.
 */

import type { Part, Segment } from "./types.ts";

export interface RenderOptions {
	width: number;
	separator: string;
	/** Paints one run of parts that share a role; `chip` is false for quiet segments. */
	paint(parts: Part[], chip: boolean): string;
	visibleWidth(text: string): number;
	truncate(text: string, width: number): string;
}

/** Consecutive parts with the same role form one run. */
export function groupRuns(parts: Part[]): Part[][] {
	const runs: Part[][] = [];
	for (const part of parts) {
		if (!part.text) continue;
		const current = runs.at(-1);
		if (current && current[0].role === part.role) current.push(part);
		else runs.push([part]);
	}
	return runs;
}

/** Drops optional segments from the end until the line fits, then truncates. */
export function renderSegments(segments: Segment[], options: RenderOptions): string {
	const { width, separator, paint, visibleWidth, truncate } = options;
	const kept = [...segments];

	const build = (): string =>
		kept
			.map((segment) => groupRuns(segment.parts).map((parts) => paint(parts, segment.chip !== false)).join(" "))
			.join(separator);

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
