# How it works

The footer renders synchronously on the interactive path, so everything here is shaped by
one constraint: a render must never wait on a process or a network call. Every slow or
expensive read is cached and refreshed in the background, then one more render is
requested.

## Hooking into pi

The extension replaces pi's footer once per session:

```ts
ctx.ui.setFooter((tui, theme, footerData) => ({
  render(width) { return [line]; },
  invalidate() {},
  dispose() { /* clear the ticker, unsubscribe */ },
}));
```

| Source | Provides |
|---|---|
| `ctx.model`, `ctx.thinkingLevel` | model id and thinking level |
| `ctx.cwd` | working directory |
| `ctx.getContextUsage()` | context tokens, window, percent |
| `ctx.sessionManager` | session id, entries, branch, leaf id |
| `footerData.getGitBranch()` | branch, maintained by pi's own watcher |
| `footerData.getExtensionStatuses()` | what other extensions published via `setStatus()` |
| `ctx.ui.theme` | theme tokens, `appearance` (`dark`/`light`), color mode |

`footerData` is the reason this has to be a footer rather than a widget: the branch and the
other extensions' statuses are not accessible anywhere else.

## Rendering

```
segments.ts ──▶ Segment[] (id, parts, optional, chip) ──▶ render.ts ──▶ one line
                 parts: { text, role, bold? }
```

- `segments.ts` is pure: given a snapshot of state it returns what to show. No pi imports,
  so it is directly testable.
- `render.ts` groups adjacent parts that share a role into runs, paints each run, drops
  optional segments from the end while the line is too wide, and only then truncates.
  Width and painting are injected (`visibleWidth`, `truncateToWidth` from pi-tui, plus the
  paint function), which keeps the module free of pi dependencies.
- `palette.ts` maps roles to colors and decides between theme tokens and the fixed
  palettes.

## How each number is produced

**Context** comes from `ctx.getContextUsage()`: `{ tokens, contextWindow, percent }`. The
gauge glyph changes at 20%, 50% and 85%; the color at 70% and 90%. After a compaction the
value is `null` until the next response, so the segment disappears rather than showing a
stale number.

**Cache hit rate** is `cacheRead / (input + cacheRead + cacheWrite)` of the latest assistant
message — the same definition pi's built-in footer uses, so the numbers agree. It is a
per-turn figure: it describes the prompt that was just sent, not the session.

**Throughput** is measured, not estimated: `message_start` opens a window, the first and
last `message_update` deltas bound the generation, and `message_end` supplies the provider's
own `usage.output` as the token count. When a host delivers no deltas, the whole
`message_start → message_end` window is used instead, which includes time to first token and
is therefore slightly conservative. Stream-driven redraws are throttled to four per second;
the finish always triggers one.

**Line counts** come from `git diff HEAD --shortstat`: staged and unstaged changes against
`HEAD`, each line counted once, untracked files excluded. Reads use `--no-optional-locks` so
they never take the index lock, and resolve `HEAD` failures (a repository with no commits) to
zero instead of breaking the segment.

**Elapsed time** is the first session entry's timestamp to now, so it survives a resume
instead of restarting at each launch.

## Caching

| Cache | Key | Why |
|---|---|---|
| `ContextCache` | session leaf id + 1s TTL | `getContextUsage()` walks the branch; the footer renders on every frame |
| `SessionUsageCache` | session leaf id | reading the branch copies every entry; needed for the cache rate |
| `DiffStats` | cwd + `gitTtlMs` | one `git` process per TTL at most, single-flight, result notifies the renderer only when it changed |

The elapsed-time ticker (`tickMs`) is the only recurring timer. It also refreshes git data
when the snapshot has gone stale, so an idle session settles into one cheap render per
second.

## Failure behaviour

Everything optional degrades to "not shown": no git, no cache numbers, no throughput, no
statuses. A malformed settings file or an unknown key falls back to the default. Nothing in
this extension throws during `render`.
