import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { DiffStats, parseShortstat } from "../src/git.ts";

const dirs: string[] = [];
after(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

test("parseShortstat reads insertions and deletions independently", () => {
	assert.deepEqual(parseShortstat(""), { insertions: 0, deletions: 0 });
	assert.deepEqual(parseShortstat(" 1 file changed, 5 insertions(+)"), { insertions: 5, deletions: 0 });
	assert.deepEqual(parseShortstat(" 2 files changed, 12 insertions(+), 3 deletions(-)"), {
		insertions: 12,
		deletions: 3,
	});
});

test("counts a dirty work tree against HEAD", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-statusline-"));
	dirs.push(dir);
	const run = (...args: string[]) => execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" });
	try {
		run("init", "-q");
		run("config", "user.email", "test@example.com");
		run("config", "user.name", "test");
		writeFileSync(join(dir, "a.txt"), "one\ntwo\n");
		run("add", ".");
		run("commit", "-qm", "init");
	} catch {
		return; // git missing or refusing to run: nothing to assert here
	}

	const stats = new DiffStats(0);
	await stats.refresh(dir);
	assert.deepEqual(stats.get(dir), { repo: true, insertions: 0, deletions: 0, at: stats.get(dir).at });

	writeFileSync(join(dir, "a.txt"), "one\nTWO\nthree\n");
	await stats.refresh(dir);
	const snapshot = stats.get(dir);
	assert.equal(snapshot.repo, true);
	assert.equal(snapshot.insertions, 2);
	assert.equal(snapshot.deletions, 1);
});

test("reports nothing outside a repository", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-statusline-plain-"));
	dirs.push(dir);
	const stats = new DiffStats(0);
	await stats.refresh(dir);
	assert.equal(stats.get(dir).repo, false);
	assert.equal(stats.get(dir).insertions, 0);
});
