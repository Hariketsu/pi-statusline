/**
 * pi-statusline — a compact, theme-aware status line for the pi coding agent.
 *
 * Replaces pi's footer with one line: model, thinking level, directory, git
 * branch and working-tree line counts, context usage, prompt cache hit rate,
 * generation throughput, and elapsed time. Colors come from the active pi theme,
 * so light, dark and system themes all work. Statuses other extensions publish
 * with ctx.ui.setStatus() are appended, so replacing the footer hides nothing.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { type StatuslineConfig, loadConfig } from "./src/config.ts";
import { ContextCache } from "./src/context.ts";
import { DiffStats } from "./src/git.ts";
import { iconsFor } from "./src/icons.ts";
import { paintChip, paintColor, resolveStyle } from "./src/palette.ts";
import { renderSegments } from "./src/render.ts";
import { type SegmentInput, buildSegments } from "./src/segments.ts";
import { TpsMeter } from "./src/tps.ts";
import type { Part } from "./src/types.ts";
import { SessionUsageCache, sessionStartMs } from "./src/usage.ts";

/** Structural views of pi's theme and footer data, so no runtime import is needed. */
interface ThemeLike {
	fg(color: string, text: string): string;
	bold(text: string): string;
	appearance?: string;
	getColorMode?(): string;
}

interface FooterDataLike {
	getGitBranch(): string | null;
	getExtensionStatuses(): ReadonlyMap<string, string>;
	onBranchChange(callback: () => void): () => void;
}

/** Width helpers come from pi-tui, which is imported lazily so the module can be tested without it. */
export interface WidthTools {
	visibleWidth(text: string): number;
	truncateToWidth(text: string, width: number, ellipsis?: string): string;
}

export interface StatuslineOptions {
	/** Injected width helpers, for tests; the real host loads pi-tui. */
	width?: WidthTools;
}

/** Streaming redraws are cheap but not free; 4 per second is plenty. */
const TPS_REDRAW_MS = 250;

export default function piStatusline(pi: ExtensionAPI, options: StatuslineOptions = {}): void {
	let width: WidthTools | null = options.width ?? null;

	async function ensureWidth(): Promise<WidthTools | null> {
		if (width) return width;
		try {
			const mod = await import("@earendil-works/pi-tui");
			width = { visibleWidth: mod.visibleWidth, truncateToWidth: mod.truncateToWidth };
		} catch {
			width = null; // the footer stays blank rather than breaking the host
		}
		return width;
	}

	const config: StatuslineConfig = loadConfig(pi);
	const icons = iconsFor(config.icons);
	const diff = new DiffStats(config.gitTtlMs);
	const contextCache = new ContextCache();
	const usageCache = new SessionUsageCache();
	const tps = new TpsMeter();

	let ctx: ExtensionContext | null = null;
	let redraw: (() => void) | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let enabled = config.enabled;
	let sessionKey: string | null = null;
	let startMs: number | null = null;
	let lastTpsRedraw = 0;

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

	function paint(parts: Part[], chip: boolean, theme: ThemeLike, style: ReturnType<typeof resolveStyle>): string {
		if (style.kind === "chips") {
			return chip ? paintChip(parts, style.chips[parts[0].role]) : paintColor(parts, style.colors[parts[0].role]);
		}
		if (style.kind === "text") return paintColor(parts, style.colors[parts[0].role]);
		return parts
			.map((part) => {
				const text = theme.fg(part.role, part.text);
				return part.bold ? theme.bold(text) : text;
			})
			.join("");
	}

	function buildLine(columns: number, theme: ThemeLike, footerData: FooterDataLike): string {
		const current = ctx;
		const tools = width;
		if (!current || !tools) return "";

		const key = `${current.sessionManager.getSessionId()}:${current.cwd}`;
		if (key !== sessionKey) {
			sessionKey = key;
			startMs = null;
			contextCache.reset();
			usageCache.reset();
		}
		startMs ??= sessionStartMs(current.sessionManager.getEntries());

		const stats = diff.get(current.cwd);
		const branch = footerData.getGitBranch();
		const context = contextCache.get(current);
		const usage = usageCache.get(current);
		const style = resolveStyle(config.style, theme.appearance ?? "dark", theme.getColorMode?.() ?? "truecolor");
		const input: SegmentInput = {
			cwd: current.cwd,
			modelId: current.model?.id,
			thinkingLevel: current.thinkingLevel,
			branch,
			// pi's branch watcher only reports inside a repository, so it settles the
			// first frame before the background git read has answered.
			repo: stats.repo || branch !== null,
			insertions: stats.insertions,
			deletions: stats.deletions,
			ahead: stats.ahead,
			behind: stats.behind,
			contextPercent: context?.percent ?? null,
			contextWindow: context?.contextWindow ?? current.model?.contextWindow ?? null,
			cacheHitRate: usage.cacheHitRate,
			tokensPerSecond: tps.get().tps,
			tpsEstimated: tps.estimated,
			durationMs: startMs === null ? null : Date.now() - startMs,
			statuses: footerData.getExtensionStatuses(),
		};

		const segments = buildSegments(input, {
			order: config.segments,
			modelNames: config.modelNames,
			showStatuses: config.showStatuses,
			icons,
			contextBar: config.contextBar,
		});

		return renderSegments(segments, {
			width: columns,
			separator: config.separator,
			paint: (parts, chip) => paint(parts, chip, theme, style),
			visibleWidth: tools.visibleWidth,
			truncate: (text, limit) => tools.truncateToWidth(text, limit, "…"),
		});
	}

	function install(current: ExtensionContext): void {
		ctx = current;
		if (!enabled || current.mode !== "tui" || !current.hasUI) return;

		current.ui.setFooter((tui, theme, footerData) => {
			footerStatuses = () => footerData.getExtensionStatuses();
			redraw = () => tui.requestRender();
			stopTicker();
			ticker = setInterval(() => {
				if (diff.isStale()) refreshGit();
				tui.requestRender();
			}, config.tickMs);
			// Never keep a host (or a test runner) alive just for the clock.
			(ticker as { unref?: () => void }).unref?.();

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

	pi.on("session_start", async (_event, current) => {
		await ensureWidth();
		install(current);
		refreshGit();
	});

	// Throughput comes from the stream itself: the window between the first and
	// the last delta of an assistant message, divided into its output tokens.
	pi.on("message_start", (event) => {
		const message = event.message as { role?: string } | undefined;
		if (message?.role === "assistant") tps.start();
	});

	pi.on("message_update", () => {
		tps.delta();
		const now = Date.now();
		if (now - lastTpsRedraw < TPS_REDRAW_MS) return;
		lastTpsRedraw = now;
		redraw?.();
	});

	pi.on("message_end", (event) => {
		const message = event.message as { role?: string; usage?: { output?: number } } | undefined;
		if (message?.role !== "assistant") return;
		const output = message.usage?.output;
		tps.finish(typeof output === "number" ? output : null);
		redraw?.();
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

	/** `/statusline debug`: the raw numbers behind the footer, for when something looks off. */
	function debugText(current: ExtensionContext): string {
		const reading = tps.snapshot();
		const usage = usageCache.get(current);
		const context = contextCache.get(current);
		const stats = diff.get(current.cwd);
		const tpsText = reading.tps === null ? "none" : `${reading.tps.toFixed(1)}t/s`;
		const parts = [
			`style=${config.style}`,
			`icons=${config.icons}`,
			`tps=${tpsText} (${reading.source ?? "none"}, deltas=${reading.deltas})`,
			`cache=${usage.cacheHitRate === null ? "none" : `${Math.round(usage.cacheHitRate)}%`}`,
			`context=${context?.percent ?? "?"}%/${context?.contextWindow ?? "?"}`,
			`git=${stats.repo ? `${stats.insertions}+/${stats.deletions}-` : "none"}`,
			`statuses=${footerStatuses().size}`,
		];
		return parts.join(" | ");
	}

	let footerStatuses: () => ReadonlyMap<string, string> = () => new Map();

	pi.registerCommand("statusline", {
		description: "Toggle the status line footer, or show its raw numbers with 'debug'",
		handler: async (args, current) => {
			if (args.trim() === "debug") {
				current.ui.notify(debugText(current as ExtensionContext), "info");
				return;
			}
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
