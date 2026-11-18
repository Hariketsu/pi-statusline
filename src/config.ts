/**
 * Configuration.
 *
 * Read from pi's settings under the `statusline` key, so it lives next to the
 * rest of your pi settings:
 *
 *   { "statusline": { "segments": ["model", "git", "context"], "separator": " | " } }
 *
 * Unknown keys and wrong types are ignored rather than failing the extension.
 */

import type { SegmentId } from "./types.ts";

export interface StatuslineConfig {
	enabled: boolean;
	segments: SegmentId[];
	separator: string;
	modelNames: Record<string, string>;
	showStatuses: boolean;
	/** How often the elapsed-time segment redraws. */
	tickMs: number;
	/** How long a git snapshot stays fresh. */
	gitTtlMs: number;
}

export const KNOWN_SEGMENTS: SegmentId[] = [
	"model",
	"thinking",
	"dir",
	"git",
	"context",
	"usage",
	"duration",
	"statuses",
];

export const DEFAULTS: StatuslineConfig = {
	enabled: true,
	segments: [...KNOWN_SEGMENTS],
	separator: " · ",
	modelNames: {},
	showStatuses: true,
	tickMs: 1000,
	gitTtlMs: 5000,
};

export function loadConfig(pi: { getSettings?: () => unknown }): StatuslineConfig {
	const settings = safeCall(pi);
	const raw = settings?.statusline;
	if (!raw || typeof raw !== "object") return { ...DEFAULTS };
	const value = raw as Record<string, unknown>;

	return {
		enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULTS.enabled,
		segments: parseSegments(value.segments) ?? DEFAULTS.segments,
		separator: typeof value.separator === "string" ? value.separator : DEFAULTS.separator,
		modelNames: parseModelNames(value.modelNames),
		showStatuses: typeof value.showStatuses === "boolean" ? value.showStatuses : DEFAULTS.showStatuses,
		tickMs: clampMs(value.tickMs, DEFAULTS.tickMs, 250, 10_000),
		gitTtlMs: clampMs(value.gitTtlMs, DEFAULTS.gitTtlMs, 500, 60_000),
	};
}

function safeCall(pi: { getSettings?: () => unknown }): Record<string, unknown> | null {
	try {
		const settings = pi.getSettings?.();
		return settings && typeof settings === "object" ? (settings as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function parseSegments(value: unknown): SegmentId[] | null {
	if (!Array.isArray(value)) return null;
	const seen = new Set<SegmentId>();
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const id = entry as SegmentId;
		if (KNOWN_SEGMENTS.includes(id)) seen.add(id);
	}
	return seen.size > 0 ? [...seen] : null;
}

function parseModelNames(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object") return {};
	const out: Record<string, string> = {};
	for (const [key, name] of Object.entries(value as Record<string, unknown>)) {
		if (typeof name === "string" && name) out[key] = name;
	}
	return out;
}

function clampMs(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}
