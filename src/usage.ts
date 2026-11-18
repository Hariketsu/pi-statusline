/**
 * Session token totals.
 *
 * Mirrors what pi's built-in footer counts, so the numbers agree: usage entries,
 * assistant messages, tool results that report usage, and compaction/branch
 * summaries. The cache hit rate is taken from the latest assistant message only,
 * because that describes the current prompt, not the whole session.
 *
 * Cost is deliberately not accumulated: the footer does not show it, and pi's
 * `/session` is the place to look for a bill.
 */

export interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface SessionUsage {
	totals: UsageTotals;
	/** cacheRead / (input + cacheRead + cacheWrite) of the latest assistant message. */
	cacheHitRate: number | null;
}

export function emptyTotals(): UsageTotals {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

function num(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addUsage(totals: UsageTotals, usage: unknown): void {
	if (!usage || typeof usage !== "object") return;
	const u = usage as Record<string, unknown>;
	totals.input += num(u.input);
	totals.output += num(u.output);
	totals.cacheRead += num(u.cacheRead);
	totals.cacheWrite += num(u.cacheWrite);
}

export function collectUsage(entries: readonly unknown[]): SessionUsage {
	const totals = emptyTotals();
	let cacheHitRate: number | null = null;

	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const e = entry as Record<string, unknown>;
		const type = e.type;

		if (type === "usage") {
			addUsage(totals, e.usage);
			continue;
		}
		if (type === "branch_summary" || type === "compaction") {
			addUsage(totals, e.usage);
			continue;
		}
		if (type !== "message") continue;

		const message = e.message as Record<string, unknown> | undefined;
		if (!message) continue;
		addUsage(totals, message.usage);
		if (message.role !== "assistant") continue;

		const usage = message.usage as Record<string, unknown> | undefined;
		if (!usage) continue;
		const prompt = num(usage.input) + num(usage.cacheRead) + num(usage.cacheWrite);
		cacheHitRate = prompt > 0 ? (num(usage.cacheRead) / prompt) * 100 : null;
	}

	return { totals, cacheHitRate };
}

/** Timestamp of the first session entry, used for the elapsed-time segment. */
export function sessionStartMs(entries: readonly unknown[], fallback = Date.now()): number {
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const timestamp = (entry as Record<string, unknown>).timestamp;
		if (typeof timestamp !== "string") continue;
		const parsed = Date.parse(timestamp);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

/**
 * Caches the session totals by leaf id. Reading the branch copies every entry,
 * which is too much work for a footer that also redraws while tokens stream in.
 */
export class SessionUsageCache {
	private leafId: string | null | undefined;
	private value: SessionUsage = { totals: emptyTotals(), cacheHitRate: null };

	get(source: { sessionManager: { getLeafId(): string | null; getBranch(): unknown[] } }): SessionUsage {
		const leafId = source.sessionManager.getLeafId();
		if (leafId !== this.leafId) {
			this.leafId = leafId;
			this.value = collectUsage(source.sessionManager.getBranch());
		}
		return this.value;
	}

	reset(): void {
		this.leafId = undefined;
	}
}
