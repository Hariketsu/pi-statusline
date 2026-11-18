/**
 * Working-tree line counts, cached.
 *
 * `git diff HEAD --shortstat` counts staged and unstaged changes against HEAD, so
 * a line edited both before and after `git add` counts once. Untracked files are
 * not counted, matching the Claude Code version of this status line.
 *
 * Rendering is synchronous, so this module only ever returns the last snapshot;
 * refreshes happen in the background and notify the caller when the result is new.
 * `--no-optional-locks` keeps every read from writing the index lock.
 */

import { execFile } from "node:child_process";

export interface DiffSnapshot {
	/** True when cwd is inside a git work tree. */
	repo: boolean;
	insertions: number;
	deletions: number;
	/** When the snapshot was taken, ms since epoch; 0 for the placeholder. */
	at: number;
}

const PLACEHOLDER: DiffSnapshot = { repo: false, insertions: 0, deletions: 0, at: 0 };

/** Parse `git diff --shortstat` output, e.g. " 2 files changed, 12 insertions(+), 3 deletions(-)". */
export function parseShortstat(text: string): { insertions: number; deletions: number } {
	const insertions = /(\d+) insertion/.exec(text);
	const deletions = /(\d+) deletion/.exec(text);
	return {
		insertions: insertions ? Number(insertions[1]) : 0,
		deletions: deletions ? Number(deletions[1]) : 0,
	};
}

function git(cwd: string, args: string[]): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["--no-optional-locks", "-C", cwd, ...args],
			{ timeout: 4000, maxBuffer: 1 << 20, windowsHide: true },
			(error, stdout) => resolve(error ? null : String(stdout)),
		);
	});
}

export class DiffStats {
	private snapshot: DiffSnapshot | null = null;
	private inFlight: Promise<boolean> | null = null;
	private cwd: string | null = null;
	private readonly ttlMs: number;

	constructor(ttlMs = 5000) {
		this.ttlMs = ttlMs;
	}

	/** Last known counts for `cwd`; schedules a refresh when the data is stale. */
	get(cwd: string): DiffSnapshot {
		if (cwd !== this.cwd) {
			this.cwd = cwd;
			this.snapshot = null;
			void this.refresh(cwd);
		} else if (this.isStale()) {
			void this.refresh(cwd);
		}
		return this.snapshot ?? { ...PLACEHOLDER };
	}

	isStale(): boolean {
		return !this.snapshot || Date.now() - this.snapshot.at > this.ttlMs;
	}

	/** Drop the snapshot so the next read starts from a fresh git call. */
	invalidate(): void {
		this.snapshot = null;
	}

	/** Refresh now; resolves true when the snapshot changed enough to redraw. */
	refresh(cwd: string): Promise<boolean> {
		if (this.inFlight) return this.inFlight;
		this.inFlight = this.read(cwd)
			.then((next) => {
				const changed =
					!this.snapshot ||
					this.snapshot.repo !== next.repo ||
					this.snapshot.insertions !== next.insertions ||
					this.snapshot.deletions !== next.deletions;
				this.snapshot = next;
				this.cwd = cwd;
				return changed;
			})
			.catch(() => false)
			.finally(() => {
				this.inFlight = null;
			});
		return this.inFlight;
	}

	private async read(cwd: string): Promise<DiffSnapshot> {
		const at = Date.now();
		const shortstat = await git(cwd, ["diff", "HEAD", "--shortstat"]);
		if (shortstat !== null) return { repo: true, ...parseShortstat(shortstat), at };

		// No HEAD yet (fresh repo) or a failed call: is this a work tree at all?
		const inside = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
		const repo = inside?.trim() === "true";
		return { repo, insertions: 0, deletions: 0, at };
	}
}
