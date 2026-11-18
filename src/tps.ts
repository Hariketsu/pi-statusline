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
}

export class TpsMeter {
	private startedAt = 0;
	private firstDeltaAt = 0;
	private lastDeltaAt = 0;
	private deltas = 0;
	private reading: TpsReading = { tps: null, ttftMs: null };

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
		};
		return this.reading;
	}

	/** The message finished: prefer the provider's own output count. */
	finish(outputTokens: number | null, now = Date.now()): TpsReading {
		const window = (now - this.firstDeltaAt) / 1000;
		const tokens = outputTokens && outputTokens > 0 ? outputTokens : this.deltas;
		const tps = this.firstDeltaAt && window > 0 && tokens > 0 ? tokens / window : this.reading.tps;
		const ttftMs = this.startedAt && this.firstDeltaAt ? this.firstDeltaAt - this.startedAt : this.reading.ttftMs;
		this.reading = { tps, ttftMs };
		return this.reading;
	}

	get(): TpsReading {
		return this.reading;
	}
}

/** One decimal below 100, integer above: `9.4t/s`, `42t/s`, `128t/s`. */
export function fmtTps(tps: number | null): string | null {
	if (tps === null || !Number.isFinite(tps) || tps <= 0) return null;
	const value = tps >= 100 ? String(Math.round(tps)) : tps.toFixed(1);
	return `${value.replace(/\.0$/, "")}t/s`;
}
