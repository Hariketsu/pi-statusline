/**
 * Integration tests for the extension wiring: no pi, no pi-tui, no terminal.
 *
 * Everything that broke so far broke here rather than in the pure modules — a bad
 * glyph, a footer that was not replaced, a segment that never received data. These
 * tests drive the real entry point through a fake host and read the rendered line.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import piStatusline, { type WidthTools } from "../index.ts";

/** Strips the fake theme's `<role>…` markers, which are not display width. */
const strip = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "").replace(/<\/?[a-z]+>/g, "");

/** Width handling as pi-tui does it, minus the ANSI maths these tests do not exercise. */
const width: WidthTools = {
	visibleWidth: (text) => strip(text).length,
	truncateToWidth: (text, limit, ellipsis = "") => {
		const plain = strip(text);
		return plain.length <= limit ? text : plain.slice(0, Math.max(0, limit - ellipsis.length)) + ellipsis;
	},
};

/** The line without color markers, for assertions about text. */
const plain = strip;

const theme = {
	fg: (role: string, text: string) => `<${role}>${text}`,
	bold: (text: string) => `*${text}*`,
	appearance: "light",
	// 256-color terminals fall back to theme tokens, which keeps the assertions readable.
	getColorMode: () => "256",
};

function fakeHost(settings: Record<string, unknown> = {}, mode = "tui") {
	const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => unknown>>();
	const commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
	const notifications: string[] = [];
	const footers: unknown[] = [];

	const pi = {
		on(event: string, handler: (event: unknown, ctx: unknown) => unknown) {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
			return () => {};
		},
		registerCommand(name: string, options: { handler: (args: string, ctx: unknown) => Promise<void> }) {
			commands.set(name, options);
		},
		getSettings: () => settings,
	};

	const ctx = {
		mode,
		hasUI: mode === "tui" || mode === "rpc",
		cwd: "/tmp/pi-statusline-test",
		model: { id: "provider/chat-model", contextWindow: 1_000_000 },
		thinkingLevel: "max",
		getContextUsage: () => ({ tokens: 230_000, contextWindow: 1_000_000, percent: 23 }),
		sessionManager: {
			getSessionId: () => "session-1",
			getEntries: () => [{ type: "message", timestamp: new Date(Date.now() - 3_600_000).toISOString() }],
			getBranch: () => [],
			getLeafId: () => "leaf-1",
		},
		ui: {
			setFooter(factory: unknown) {
				footers.push(factory);
			},
			notify(text: string) {
				notifications.push(text);
			},
		},
	};

	const footerData = {
		getGitBranch: () => "main",
		getExtensionStatuses: () => new Map([["bg", "2 jobs"]]),
		onBranchChange: () => () => {},
	};

	const tui = { requestRender() {} };

	async function emit(event: string, payload: unknown = {}) {
		for (const handler of handlers.get(event) ?? []) await handler(payload, ctx);
	}

	type Component = { render(width: number): string[]; dispose?(): void };

	/**
	 * Installs the footer through session_start and returns the component it registered.
	 * The component owns a 1s ticker, so the test registers its disposal.
	 */
	async function mount(t: { after(fn: () => void): void }) {
		await emit("session_start");
		const factory = footers.at(-1) as
			| ((tui: unknown, theme: unknown, data: unknown) => Component)
			| undefined;
		assert.ok(factory, "session_start did not install a footer");
		const component = factory(tui, theme, footerData);
		t.after(() => component.dispose?.());
		return component;
	}

	return { pi, ctx, commands, notifications, footers, emit, mount };
}

test("session_start replaces the footer with a rendered line", async (t) => {
	const host = fakeHost();
	piStatusline(host.pi as never, { width });

	const component = await host.mount(t);
	const line = component.render(120)[0];

	assert.match(line, /<accent>chat-model/, "model name, in the accent role");
	assert.match(line, /<path>pi-statusline-test/, "directory basename");
	assert.match(line, /23%\/1M/);
	assert.match(plain(line), / main /, "branch from the footer data, on the first frame");
	assert.match(plain(line), /max/, "thinking level");
});

test("the last few segments stay quiet and share one grey", async (t) => {
	const host = fakeHost();
	piStatusline(host.pi as never, { width });
	const line = (await host.mount(t)).render(160)[0];

	// Duration and other extensions' statuses are plain dim text, no blocks.
	assert.match(plain(line), /1h/, "elapsed time");
	assert.match(plain(line), /2 jobs/, "statuses from other extensions");
	assert.doesNotMatch(line, /<accent>1h|<path>1h|<vcs>1h/);
});

test("streaming events turn into a throughput segment", async (t) => {
	const host = fakeHost();
	piStatusline(host.pi as never, { width });
	const component = await host.mount(t);

	assert.doesNotMatch(component.render(160)[0], /t\/s/, "no rate before a turn finishes");

	await host.emit("message_start", { message: { role: "assistant" } });
	await host.emit("message_update", {});
	await new Promise((resolve) => setTimeout(resolve, 15));
	await host.emit("message_update", {});
	await host.emit("message_end", { message: { role: "assistant", usage: { output: 60 } } });

	assert.match(component.render(160)[0], /\d+t\/s/, "a measured rate after the turn");
});

test("a turn without stream updates is marked as an estimate", async (t) => {
	const host = fakeHost();
	piStatusline(host.pi as never, { width });
	const component = await host.mount(t);

	await host.emit("message_start", { message: { role: "assistant" } });
	await new Promise((resolve) => setTimeout(resolve, 15));
	await host.emit("message_end", { message: { role: "assistant", usage: { output: 30 } } });

	assert.match(component.render(160)[0], /~[\d.]+t\/s/);
});

test("/statusline debug reports the counters behind the line", async (t) => {
	const host = fakeHost();
	piStatusline(host.pi as never, { width });
	await host.mount(t);

	await host.commands.get("statusline")?.handler("debug", host.ctx);

	const report = host.notifications.at(-1) ?? "";
	assert.match(report, /style=text/);
	assert.match(report, /icons=nerd/);
	assert.match(report, /tps=none/);
	assert.match(report, /context=23%\/1000000/);
	assert.match(report, /statuses=1/);
});

test("/statusline toggles back to pi's footer and returns", async (t) => {
	const host = fakeHost();
	piStatusline(host.pi as never, { width });
	await host.mount(t);

	const command = host.commands.get("statusline");
	await command?.handler("", host.ctx);
	assert.equal(host.footers.at(-1), undefined, "the built-in footer is restored");
	assert.match(host.notifications.at(-1) ?? "", /statusline off/);

	await command?.handler("", host.ctx);
	assert.ok(typeof host.footers.at(-1) === "function", "the custom footer is installed again");
});

test("print mode never installs a footer", async (t) => {
	const host = fakeHost({}, "print");
	piStatusline(host.pi as never, { width });
	await host.emit("session_start");
	assert.equal(host.footers.length, 0);
});

test("settings drive segments, icons and separator", async (t) => {
	const host = fakeHost({
		statusline: { segments: ["dir", "model"], separator: " | ", icons: "none" },
	});
	piStatusline(host.pi as never, { width });
	const line = (await host.mount(t)).render(120)[0];

	assert.match(line, /^<path>pi-statusline-test<dim> \| <accent>chat-model$/);
});
