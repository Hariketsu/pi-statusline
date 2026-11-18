/** Builds the status line's segments from session state. Pure: no pi imports. */

import { basename, fmtDuration, fmtPercent, shortModel } from "./format.ts";
import { contextGauge, type Icons, iconsFor } from "./icons.ts";
import { fmtTps } from "./tps.ts";
import type { Part, Role, Segment, SegmentId } from "./types.ts";

export interface SegmentInput {
	cwd: string;
	modelId: string | undefined;
	thinkingLevel: string | undefined;
	/** Branch from pi's footer data; null outside a repository. */
	branch: string | null;
	repo: boolean;
	insertions: number;
	deletions: number;
	/** Commits ahead of and behind the upstream branch. */
	ahead: number;
	behind: number;
	contextPercent: number | null;
	contextWindow: number | null;
	/** Share of the prompt served from cache on the latest turn, 0-100. */
	cacheHitRate: number | null;
	tokensPerSecond: number | null;
	/** True when the rate had to be taken over the whole message window. */
	tpsEstimated?: boolean;
	durationMs: number | null;
	/** Statuses other extensions publish with ctx.ui.setStatus(). */
	statuses: ReadonlyMap<string, string>;
}

export interface SegmentOptions {
	order?: SegmentId[];
	modelNames?: Record<string, string>;
	showStatuses?: boolean;
	icons?: Icons;
	/** Draw context usage as a ten-cell bar before the numbers. */
	contextBar?: boolean;
}

const DEFAULT_ORDER: SegmentId[] = [
	"model",
	"thinking",
	"dir",
	"git",
	"diff",
	"context",
	"cache",
	"tps",
	"duration",
	"statuses",
];

export function buildSegments(input: SegmentInput, options: SegmentOptions = {}): Segment[] {
	const order = options.order?.length ? options.order : DEFAULT_ORDER;
	const icons = options.icons ?? iconsFor("nerd");
	const segments: Segment[] = [];

	const push = (id: SegmentId, parts: Part[], optional = false, chip = true) => {
		if (!parts.some((part) => part.text.trim().length > 0)) return;
		segments.push({ id, parts: parts.filter((part) => part.text.length > 0), optional, chip });
	};

	for (const id of order) {
		switch (id) {
			case "model": {
				const mapped = lookupModelName(input.modelId, options.modelNames ?? {});
				push("model", [{ text: mapped ?? shortModel(input.modelId), role: "accent" }]);
				break;
			}
			case "thinking": {
				const level = input.thinkingLevel;
				if (!level || level === "off") break;
				push("thinking", withIcon(icons.thinking, { text: level, role: "dim" }), false, false);
				break;
			}
			case "dir":
				push("dir", [{ text: basename(input.cwd), role: "path" }]);
				break;
			case "git": {
				if (!input.branch || !input.repo) break;
				const parts = withIcon(icons.git, { text: input.branch, role: "vcs" });
				if (input.ahead > 0) parts.push({ text: ` ↑${input.ahead}`, role: "dim" });
				if (input.behind > 0) parts.push({ text: ` ↓${input.behind}`, role: "dim" });
				push("git", parts, true);
				break;
			}
			case "diff": {
				if (!input.repo || (input.insertions === 0 && input.deletions === 0)) break;
				const parts: Part[] = [];
				if (input.insertions > 0) parts.push({ text: `+${input.insertions}`, role: "success" });
				if (input.deletions > 0) parts.push({ text: `−${input.deletions}`, role: "error" });
				push("diff", parts, true);
				break;
			}
			case "context": {
				if (input.contextPercent === null || !input.contextWindow) break;
				const percent = input.contextPercent;
				const role = contextRole(percent);
				const numbers = `${fmtPercent(percent)}/${fmtTokensShort(input.contextWindow)}`;
				const text = options.contextBar ? `${contextBarCells(percent)} ${numbers}` : numbers;
				push("context", withIcon(contextGauge(icons, percent), { text, role }));
				break;
			}
			case "cache": {
				// A healthy cache is silent; only a miss rate worth acting on is shown.
				if (input.cacheHitRate === null || input.cacheHitRate >= 50) break;
				push(
					"cache",
					withIcon(icons.cache, { text: `${Math.round(input.cacheHitRate)}%`, role: cacheRole(input.cacheHitRate) }),
					false,
					false,
				);
				break;
			}
			case "tps": {
				const text = fmtTps(input.tokensPerSecond);
				if (text) push("tps", withIcon(icons.tps, { text: `${input.tpsEstimated ? "~" : ""}${text}`, role: "dim" }), true, false);
				break;
			}
			case "duration": {
				if (input.durationMs === null) break;
				push("duration", withIcon(icons.duration, { text: fmtDuration(input.durationMs), role: "dim" }), true, false);
				break;
			}
			case "statuses": {
				if (options.showStatuses === false || input.statuses.size === 0) break;
				const text = [...input.statuses.values()].filter(Boolean).join(" · ");
				if (text) push("statuses", [{ text, role: "dim" }], true, false);
				break;
			}
		}
	}

	return segments;
}

function contextBarCells(percent: number): string {
	const filled = Math.min(10, Math.max(0, Math.round(percent / 10)));
	return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

/** The icon takes the value's role, so both land in one chip (or one colored run). */
function withIcon(icon: string, part: Part): Part[] {
	if (!icon) return [{ ...part }];
	return [{ text: icon, role: part.role }, { text: " ", role: part.role }, { ...part }];
}

function contextRole(percent: number): Role {
	if (percent > 90) return "error";
	if (percent > 70) return "warning";
	return "dim";
}

function cacheRole(_percent: number): Role {
	return "warning";
}

/** Context windows are round numbers: 500k, 1M. */
function fmtTokensShort(n: number): string {
	if (n >= 1_000_000) return `${trimZero((n / 1_000_000).toFixed(1))}M`;
	if (n >= 1000) return `${Math.round(n / 1000)}k`;
	return String(n);
}

function trimZero(value: string): string {
	return value.replace(/\.0$/, "");
}

function lookupModelName(id: string | undefined, names: Record<string, string>): string | null {
	if (!id) return null;
	if (names[id]) return names[id];
	const tail = id.split("/").pop();
	return tail && names[tail] ? names[tail] : null;
}
