/**
 * Caches `ctx.getContextUsage()`, which walks the branch and is too expensive to
 * call on every render. The cache is keyed by the session leaf id: a new leaf
 * means the context changed, so the value is read again. A short TTL covers
 * streaming updates within the same leaf.
 */

export interface ContextUsage {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
}

export interface ContextSource {
	getContextUsage(): ContextUsage | undefined;
	sessionManager: { getLeafId(): string | null };
}

export class ContextCache {
	private leafId: string | null | undefined;
	private readAt = 0;
	private value: ContextUsage | null = null;

	get(source: ContextSource | null | undefined, ttlMs = 1000): ContextUsage | null {
		if (!source || typeof source.getContextUsage !== "function") return null;

		const leafId = source.sessionManager?.getLeafId?.() ?? null;
		const stale = this.leafId !== leafId || Date.now() - this.readAt > ttlMs;
		if (stale) {
			this.leafId = leafId;
			this.readAt = Date.now();
			this.value = source.getContextUsage() ?? null;
		}
		return this.value;
	}

	reset(): void {
		this.leafId = undefined;
		this.readAt = 0;
		this.value = null;
	}
}
