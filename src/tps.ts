/**
 * Live generation throughput.
 *
 * pi emits `message_start`, a stream of `message_update` events and one
 * `message_end` per assistant message. Wall time between the first and last
 * delta is the generation window; dividing the output tokens by it gives the
 * tokens per second shown in the footer. The previous turn's value stays
 * visible until the new one completes, so the segment does not flicker empty.
 */

export interface TpsReading {
	tps: number | null;
	ttftMs: number | null;
	/**
	 * `deltas` when the rate came from the stream itself (first to last delta),
	 * `window` when no stream update arrived and the whole message window had to
	 * stand in. Window figures include time to first token, so they read low and
	 * are shown with a leading "~".
	 */
	source: "deltas" | "window" | null;
}

export class TpsMeter {
	private startedAt = 0;
	private firstDeltaAt = 0;
	private lastDeltaAt = 0;
	private deltas = 0;
	private reading: TpsReading = { tps: null, ttftMs: null, source: null };

	/** A new assistant message began. */
	start(now = Date.now()): void {
		this.startedAt = now;
		this.firstDeltaAt = 0;
		this.lastDeltaAt = 0;
		this.deltas = 0;
	}

	/** A stream update arrived. Returns the live estimate. */
	delta(now = Date.now()): TpsReading {
		if (!this.firstDeltaAt) this.firstDeltaAt = now;
		this.lastDeltaAt = now;
		this.deltas += 1;

		const window = (this.lastDeltaAt - this.firstDeltaAt) / 1000;
		const ttftMs = this.startedAt ? this.firstDeltaAt - this.startedAt : null;
		this.reading = {
			// Before the second delta there is no interval to measure yet.
			tps: this.deltas > 1 && window > 0 ? this.deltas / window : this.reading.tps,
			ttftMs,
			source: this.deltas > 1 && window > 0 ? "deltas" : this.reading.source,
		};
		return this.reading;
	}

	/**
	 * The message finished: prefer the provider's own output count.
	 *
	 * Generation ends at the last delta, not when `message_end` fires — the gap
	 * between them is stream teardown, not model time. Only when the host delivered
	 * no stream updates at all does the whole message window stand in, and the
	 * reading is marked `window` so the footer can show it as an estimate.
	 */
	finish(outputTokens: number | null, now = Date.now()): TpsReading {
		const tokens = outputTokens && outputTokens > 0 ? outputTokens : this.deltas;

		if (this.firstDeltaAt && this.lastDeltaAt) {
			const window = (this.lastDeltaAt - this.firstDeltaAt) / 1000;
			const tps = window > 0 && tokens > 0 ? tokens / window : this.reading.tps;
			const ttftMs = this.startedAt ? this.firstDeltaAt - this.startedAt : this.reading.ttftMs;
			this.reading = { tps, ttftMs, source: tps === null ? this.reading.source : "deltas" };
			return this.reading;
		}

		if (this.startedAt) {
			const window = (now - this.startedAt) / 1000;
			const tps = window > 0 && tokens > 0 ? tokens / window : this.reading.tps;
			this.reading = { tps, ttftMs: this.reading.ttftMs, source: tps === null ? this.reading.source : "window" };
			return this.reading;
		}

		return this.reading;
	}

	get(): TpsReading {
		return this.reading;
	}

	/** Raw counters, for `/statusline debug`. */
	snapshot(): TpsReading & { deltas: number; startedAt: number; firstDeltaAt: number } {
		return { ...this.reading, deltas: this.deltas, startedAt: this.startedAt, firstDeltaAt: this.firstDeltaAt };
	}

	get estimated(): boolean {
		return this.reading.source === "window";
	}
}

/** One decimal below 100, integer above: `9.4t/s`, `42t/s`, `128t/s`. */
export function fmtTps(tps: number | null): string | null {
	if (tps === null || !Number.isFinite(tps) || tps <= 0) return null;
	const value = tps >= 100 ? String(Math.round(tps)) : tps.toFixed(1);
	return `${value.replace(/\.0$/, "")}t/s`;
}
