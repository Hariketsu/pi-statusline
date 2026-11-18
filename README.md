# pi-statusline

A compact, theme-aware status line for the [pi coding agent](https://pi.dev). One line
under the editor: model, thinking level, directory, git branch and working-tree line
counts, context usage, prompt cache hit rate, generation throughput, elapsed time.

It replaces pi's built-in footer, and re-renders the statuses other extensions publish
with `ctx.ui.setStatus()`, so nothing disappears.

```
chat-model · 󰧑 max · pi-statusline ·  feat/pi-statusline-plugin +12 −3 · 󰡳 15%/1M · ⚡87% · 42.4t/s ·  1h2m
```

## Install

```sh
# from a checkout (development)
pi install /absolute/path/to/pi-statusline

# from git
pi install git:github.com/<you>/pi-statusline
```

Then start a new session, or `/reload`. `/statusline` toggles the custom footer off and
back to pi's built-in one.

> **npm name:** `pi-statusline` is already taken on npm by an unrelated, dormant package
> (2026-05, `Claude Code-compatible command-driven statusline`). Before publishing, set
> `name` to a scoped one, for example `@hariketsu/pi-statusline`.

## What it shows

| Segment | Example | Source |
|---|---|---|
| Model | `chat-model` | `ctx.model.id`, last path segment, snapshot dates dropped |
| Thinking | `󰧑 max` | `ctx.thinkingLevel` (hidden when `off`) |
| Directory | `pi-statusline` | basename of `ctx.cwd` |
| Git | ` feat/x +12 −3` | `footerData.getGitBranch()` + `git diff HEAD --shortstat` |
| Context | `󰡳 15%/1M` | `ctx.getContextUsage()`, gauge glyph and color by usage |
| Cache | `⚡87%` | prompt cache hit rate of the latest assistant message |
| Throughput | `42.4t/s` | output tokens over the generation window of the last turn |
| Duration | ` 1h2m` | first session entry timestamp → now |
| Statuses | `2 jobs` | `ctx.ui.setStatus()` from other extensions |

Colors follow the pi theme (no hardcoded palette): the model name is `accent` and bold,
values are `text`, icons and labels are `muted`/`dim`, `+N` is `success`, `−N` is `error`,
and context/cache shift to `warning` and `error` as they get worse.

### How the numbers are defined

- **Context** is `ctx.getContextUsage()`: current tokens against the model's window. The
  gauge glyph steps through empty/low/mid/full at 20%, 50% and 85%; the color escalates at
  70% and 90%.
- **Cache hit rate** is `cacheRead / (input + cacheRead + cacheWrite)` of the latest
  assistant message, the same definition pi's built-in footer uses. Green at ≥80%, plain
  at ≥50%, amber below.
- **Throughput** is measured from the stream: the window between the first and last
  `message_update` delta of an assistant message, divided into its `usage.output`. While
  the next turn streams, the value updates about four times per second.
- **Line counts** come from `git diff HEAD --shortstat`: staged and unstaged changes
  against HEAD, each line counted once. Untracked files are not counted. Reads use
  `--no-optional-locks` and a 5 s cache, so the footer never blocks on git.
- **Deliberately absent:** plan quota windows (pi has no `.rate_limits`), session token
  totals, and cost. `38k tok` next to `18%/1M` reads as duplicated information, and the
  cost is available from `/session`.

### Width

Segments marked optional (git counts, throughput, duration, statuses) are dropped from the
end until the line fits, and only then truncated. `visibleWidth`/`truncateToWidth` from
pi-tui handle ANSI and wide characters.

## Configuration

Everything is optional and lives next to your pi settings, in
`~/.pi/agent/settings.json`. Run `/reload` after changing it:

```json
{
  "statusline": {
    "segments": ["model", "thinking", "dir", "git", "context", "cache", "tps", "duration", "statuses"],
    "separator": " · ",
    "modelNames": { "vendor/chat-model": "chat model" },
    "icons": "nerd",
    "showStatuses": true,
    "tickMs": 1000,
    "gitTtlMs": 5000
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `segments` | all, in the order above | Which segments to show, and in what order |
| `separator` | `" · "` | Text between segments |
| `modelNames` | `{}` | Display-name overrides, keyed by full model id or its last path segment |
| `icons` | `"nerd"` | `"nerd"` (Nerd Font glyphs), `"emoji"`, or `"none"` |
| `showStatuses` | `true` | Append statuses published by other extensions |
| `tickMs` | `1000` | How often the elapsed-time segment redraws |
| `gitTtlMs` | `5000` | How long a git snapshot stays fresh before a background refresh |
| `enabled` | `true` | Start with the custom footer installed |

Unknown keys and wrong types are ignored rather than breaking the extension.

## Development

No build step: pi loads `index.ts` directly. Tests use Node's built-in runner and need
no dependencies (git integration tests create throwaway repositories):

```sh
node --test tests/*.test.ts
```

| File | Responsibility |
|---|---|
| `index.ts` | Extension entry: footer component, event wiring, `/statusline` |
| `src/segments.ts` | Pure segment builder (what to show, colored parts) |
| `src/render.ts` | Width-aware joining: drop optional segments, then truncate |
| `src/format.ts` | Tokens, duration, percentage, model-name formatting |
| `src/icons.ts` | Nerd Font / emoji / plain glyph sets |
| `src/tps.ts` | Throughput meter over the message stream |
| `src/usage.ts` | Session token/cost totals and cache hit rate |
| `src/git.ts` | Cached `git diff HEAD --shortstat` reads (`--no-optional-locks`) |
| `src/context.ts` | `ctx.getContextUsage()` cache, keyed by session leaf |
| `src/config.ts` | Reads the `statusline` settings namespace |

Keep pure modules free of pi imports: they are the tested part, and they are what
changes when segments change.

## License

MIT
