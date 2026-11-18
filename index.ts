/**
 * pi-statusline — a compact, theme-aware status line for the pi coding agent.
 *
 * Replaces pi's footer with one line: model, thinking level, directory, git
 * branch and working-tree line counts, context usage, session tokens/cost, and
 * elapsed time. Colors come from the active pi theme, so light, dark and system
 * themes all work. Statuses other extensions publish with ctx.ui.setStatus()
 * are appended, so replacing the footer hides nothing.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

import { type StatuslineConfig, loadConfig } from "./src/config.ts";
import { ContextCache } from "./src/context.ts";
import { DiffStats } from "./src/git.ts";
import { renderSegments } from "./src/render.ts";
import { type SegmentInput, buildSegments } from "./src/segments.ts";
import { collectUsage, sessionStartMs } from "./src/usage.ts";

/** Structural views of pi's theme and footer data, so no runtime import is needed. */
interface ThemeLike {
	fg(color: string, text: string): string;
}

interface FooterDataLike {
	getGitBranch(): string | null;
	getExtensionStatuses(): ReadonlyMap<string, string>;
	onBranchChange(callback: () => void): () => void;
}

export default function piStatusline(pi: ExtensionAPI): void {
	const config: StatuslineConfig = loadConfig(pi);
	const diff = new DiffStats(config.gitTtlMs);
	const contextCache = new ContextCache();

	let ctx: ExtensionContext | null = null;
	let redraw: (() => void) | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let enabled = config.enabled;
	let sessionKey: string | null = null;
	let startMs: number | null = null;

	function stopTicker(): void {
		if (ticker) clearInterval(ticker);
		ticker = null;
	}

	/** Git data is read in the background; a change triggers one more render. */
	function refreshGit(): void {
		const current = ctx;
		if (!current) return;
		void diff.refresh(current.cwd).then((changed) => {
			if (changed) redraw?.();
		});
	}

	function buildLine(width: number, theme: ThemeLike, footerData: FooterDataLike): string {
		const current = ctx;
		if (!current) return "";

		const key = `${current.sessionManager.getSessionId()}:${current.cwd}`;
		if (key !== sessionKey) {
			sessionKey = key;
			startMs = null;
			contextCache.reset();
		}
		startMs ??= sessionStartMs(current.sessionManager.getEntries());

		const stats = diff.get(current.cwd);
		const context = contextCache.get(current);
		const input: SegmentInput = {
			cwd: current.cwd,
			modelId: current.model?.id,
			thinkingLevel: current.thinkingLevel,
			branch: footerData.getGitBranch(),
			repo: stats.repo,
			insertions: stats.insertions,
			deletions: stats.deletions,
			contextPercent: context?.percent ?? null,
			contextWindow: context?.contextWindow ?? current.model?.contextWindow ?? null,
			usage: collectUsage(current.sessionManager.getBranch()),
			durationMs: startMs === null ? null : Date.now() - startMs,
			statuses: footerData.getExtensionStatuses(),
		};

		const segments = buildSegments(input, {
			order: config.segments,
			modelNames: config.modelNames,
			showStatuses: config.showStatuses,
		});

		return renderSegments(segments, {
			width,
			separator: config.separator,
			colorize: (role, text) => theme.fg(role, text),
			visibleWidth,
			truncate: (text, limit) => truncateToWidth(text, limit),
		});
	}

	function install(current: ExtensionContext): void {
		ctx = current;
		if (!enabled || current.mode !== "tui" || !current.hasUI) return;

		current.ui.setFooter((tui, theme, footerData) => {
			redraw = () => tui.requestRender();
			stopTicker();
			ticker = setInterval(() => {
				if (diff.isStale()) refreshGit();
				tui.requestRender();
			}, config.tickMs);

			const offBranch = footerData.onBranchChange(() => {
				diff.invalidate();
				tui.requestRender();
			});

			return {
				dispose() {
					offBranch();
					stopTicker();
					redraw = null;
				},
				invalidate() {},
				render(width: number): string[] {
					return [buildLine(width, theme as ThemeLike, footerData as FooterDataLike)];
				},
			};
		});
	}

	pi.on("session_start", (_event, current) => {
		install(current);
		refreshGit();
	});

	// The working tree and token totals change with every turn; the elapsed-time
	// segment is refreshed by the ticker, which is why these only nudge a render.
	for (const event of ["turn_end", "agent_settled"] as const) {
		pi.on(event, () => {
			refreshGit();
			redraw?.();
		});
	}
	for (const event of ["model_select", "thinking_level_select"] as const) {
		pi.on(event, () => redraw?.());
	}

	pi.registerCommand("statusline", {
		description: "Toggle the status line footer on or off",
		handler: async (_args, current) => {
			enabled = !enabled;
			if (!enabled) {
				stopTicker();
				redraw = null;
				current.ui.setFooter(undefined);
				current.ui.notify("statusline off: built-in footer restored", "info");
				return;
			}
			install(current as ExtensionContext);
			current.ui.notify("statusline on", "info");
		},
	});
}
