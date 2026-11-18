/** Builds the status line's segments from session state. Pure: no pi imports. */

import { basename, fmtCost, fmtDuration, fmtPercent, fmtTokens, shortModel } from "./format.ts";
import type { SessionUsage } from "./usage.ts";
import type { Role, Segment, SegmentId } from "./types.ts";

export interface SegmentInput {
	cwd: string;
	modelId: string | undefined;
	thinkingLevel: string | undefined;
	/** Branch from pi's footer data; null outside a repository. */
	branch: string | null;
	repo: boolean;
	insertions: number;
	deletions: number;
	contextPercent: number | null;
	contextWindow: number | null;
	usage: SessionUsage;
	durationMs: number | null;
	/** Statuses other extensions publish with ctx.ui.setStatus(). */
	statuses: ReadonlyMap<string, string>;
}

export interface SegmentOptions {
	order: SegmentId[];
	modelNames: Record<string, string>;
	showStatuses: boolean;
}

const DEFAULT_ORDER: SegmentId[] = [
	"model",
	"thinking",
	"dir",
	"git",
	"context",
	"usage",
	"duration",
	"statuses",
];

export function buildSegments(input: SegmentInput, options: Partial<SegmentOptions> = {}): Segment[] {
	const order = options.order?.length ? options.order : DEFAULT_ORDER;
	const segments: Segment[] = [];
	const push = (id: SegmentId, text: string, role: Role, optional = false) => {
		if (text) segments.push({ id, text, role, optional });
	};

	for (const id of order) {
		switch (id) {
			case "model": {
				const mapped = lookupModelName(input.modelId, options.modelNames ?? {});
				push("model", mapped ?? shortModel(input.modelId), "accent");
				break;
			}
			case "thinking": {
				const level = input.thinkingLevel;
				if (level && level !== "off") push("thinking", level, "dim");
				break;
			}
			case "dir":
				push("dir", basename(input.cwd), "muted");
				break;
			case "git": {
				if (!input.branch || !input.repo) break;
				const counts =
					input.insertions || input.deletions
						? ` +${input.insertions} −${input.deletions}`
						: "";
				push("git", `${input.branch}${counts}`, "muted", true);
				break;
			}
			case "context": {
				if (input.contextPercent === null || !input.contextWindow) break;
				const window = fmtTokens(input.contextWindow);
				push("context", `${fmtPercent(input.contextPercent)}/${window}`, contextRole(input.contextPercent));
				break;
			}
			case "usage": {
				const { totals, cacheHitRate } = input.usage;
				const parts: string[] = [];
				const tokens = totals.input + totals.output;
				if (tokens > 0) parts.push(`${fmtTokens(tokens)} tok`);
				if (cacheHitRate !== null) parts.push(`${Math.round(cacheHitRate)}% cache`);
				if (totals.cost > 0) parts.push(fmtCost(totals.cost));
				push("usage", parts.join(" · "), "dim", true);
				break;
			}
			case "duration":
				if (input.durationMs !== null) push("duration", fmtDuration(input.durationMs), "dim", true);
				break;
			case "statuses": {
				if (options.showStatuses === false || input.statuses.size === 0) break;
				const text = [...input.statuses.values()].filter(Boolean).join(" · ");
				push("statuses", text, "muted", true);
				break;
			}
		}
	}

	return segments;
}

function contextRole(percent: number): Role {
	if (percent > 90) return "error";
	if (percent > 70) return "warning";
	return "dim";
}

function lookupModelName(id: string | undefined, names: Record<string, string>): string | null {
	if (!id) return null;
	if (names[id]) return names[id];
	const tail = id.split("/").pop();
	return tail && names[tail] ? names[tail] : null;
}
