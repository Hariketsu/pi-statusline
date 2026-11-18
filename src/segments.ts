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
	contextPercent: number | null;
	contextWindow: number | null;
	/** Share of the prompt served from cache on the latest turn, 0-100. */
	cacheHitRate: number | null;
	tokensPerSecond: number | null;
	durationMs: number | null;
	/** Statuses other extensions publish with ctx.ui.setStatus(). */
	statuses: ReadonlyMap<string, string>;
}

export interface SegmentOptions {
	order?: SegmentId[];
	modelNames?: Record<string, string>;
	showStatuses?: boolean;
	icons?: Icons;
}

const DEFAULT_ORDER: SegmentId[] = [
	"model",
	"thinking",
	"dir",
	"git",
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

	const push = (id: SegmentId, parts: Part[], optional = false) => {
		const visible = parts.filter((part) => part.text.length > 0);
		if (visible.length === 0) return;
		if (!visible.some((part) => part.text.trim().length > 0)) return;
		segments.push({ id, parts: visible, optional });
	};

	for (const id of order) {
		switch (id) {
			case "model": {
				const mapped = lookupModelName(input.modelId, options.modelNames ?? {});
				push("model", [{ text: mapped ?? shortModel(input.modelId), role: "accent", bold: true }]);
				break;
			}
			case "thinking": {
				const level = input.thinkingLevel;
				if (!level || level === "off") break;
				push("thinking", withIcon(icons.thinking, { text: level, role: "text" }));
				break;
			}
			case "dir":
				push("dir", [{ text: basename(input.cwd), role: "text" }]);
				break;
			case "git": {
				if (!input.branch || !input.repo) break;
				const parts = withIcon(icons.git, { text: input.branch, role: "muted" });
				if (input.insertions > 0) parts.push({ text: ` +${input.insertions}`, role: "success", bold: true });
				if (input.deletions > 0) parts.push({ text: ` −${input.deletions}`, role: "error", bold: true });
				push("git", parts, true);
				break;
			}
			case "context": {
				if (input.contextPercent === null || !input.contextWindow) break;
				const percent = input.contextPercent;
				const role = contextRole(percent);
				const text = `${fmtPercent(percent)}/${fmtTokensShort(input.contextWindow)}`;
				push("context", withIcon(contextGauge(icons, percent), { text, role, bold: true }, role));
				break;
			}
			case "cache": {
				if (input.cacheHitRate === null) break;
				push(
					"cache",
					withIcon(icons.cache, { text: `${Math.round(input.cacheHitRate)}%`, role: cacheRole(input.cacheHitRate), bold: true }),
				);
				break;
			}
			case "tps": {
				const text = fmtTps(input.tokensPerSecond);
				if (!text) break;
				push("tps", [{ text, role: "text", bold: true }], true);
				break;
			}
			case "duration": {
				if (input.durationMs === null) break;
				push("duration", withIcon(icons.duration, { text: fmtDuration(input.durationMs), role: "dim" }), true);
				break;
			}
			case "statuses": {
				if (options.showStatuses === false || input.statuses.size === 0) break;
				const text = [...input.statuses.values()].filter(Boolean).join(" · ");
				if (text) push("statuses", [{ text, role: "muted" }], true);
				break;
			}
		}
	}

	return segments;
}

/** Prefixes a dim icon and a space when the icon set has one. */
function withIcon(icon: string, part: Part, iconRole: Role = "muted"): Part[] {
	if (!icon) return [{ ...part }];
	return [{ text: icon, role: iconRole }, { text: " ", role: iconRole }, { ...part }];
}

function contextRole(percent: number): Role {
	if (percent > 90) return "error";
	if (percent > 70) return "warning";
	return "text";
}

function cacheRole(percent: number): Role {
	if (percent >= 80) return "success";
	if (percent >= 50) return "text";
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
