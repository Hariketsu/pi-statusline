# pi-statusline

A compact, theme-aware status line for the [pi coding agent](https://pi.dev). One line
under the editor: model, thinking level, directory, git branch and working-tree line
counts, context usage, session tokens/cost, elapsed time.

It replaces pi's built-in footer, and re-renders the statuses other extensions publish
with `ctx.ui.setStatus()`, so nothing disappears.

```
ds-flash · max · pi-statusline · feat/pi-statusline-plugin +12 −3 · 15%/500k · 38k tok · 87% cache · $0.42 · 1h2m
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
> `name` to a scoped one, for example `@<your-npm-user>/pi-statusline`.

## What it shows

| Segment | Example | Source |
|---|---|---|
| Model | `ds-flash` | `ctx.model.id`, last path segment, snapshot dates dropped |
| Thinking | `max` | `ctx.thinkingLevel` (hidden when `off`) |
| Directory | `pi-statusline` | basename of `ctx.cwd` |
| Git | `main +12 −3` | `footerData.getGitBranch()` + `git diff HEAD --shortstat` |
| Context | `15%/500k` | `ctx.getContextUsage()` |
| Session usage | `38k tok · 87% cache · $0.42` | assistant `usage` across the session |
| Duration | `1h2m` | first session entry timestamp → now |
| Statuses | `2 jobs · 3s` | `ctx.ui.setStatus()` from other extensions |

Details that differ from the Claude Code original, because pi's data is different:

- **No 5h / 7d plan windows.** Claude Code reports `.rate_limits`; pi does not, and the
  provider in use may not expose a quota endpoint. Those two segments became session
  tokens, cache hit rate and cost, which are always available. If you want plan quotas
  back, `pi-sub-quota`, `pi-usage-bar` and `pi-usage` adapt provider APIs for that.
- **Colors follow the pi theme.** Segments use theme tokens (`accent`, `muted`, `dim`,
  `success`, `error`, `warning`) instead of hardcoded Gruvbox truecolor, so light, dark
  and `system` themes all stay readable.
- **Line counts are the real working tree.** `git diff HEAD --shortstat` counts staged
  and unstaged changes once, and untracked files are not counted.
- **Cache hit rate** is `cacheRead / (input + cacheRead + cacheWrite)` of the latest
  assistant message, the same definition pi's built-in footer uses.
- **Width handling:** segments marked optional (git counts, usage, duration, statuses)
  are dropped from the end first; the result is truncated only when nothing is left to
  drop. `visibleWidth`/`truncateToWidth` from pi-tui handle ANSI and wide characters.

## Configuration

Everything is optional and lives next to your pi settings, in
`~/.pi/agent/settings.json`:

```json
{
  "statusline": {
    "segments": ["model", "thinking", "dir", "git", "context", "usage", "duration", "statuses"],
    "separator": " · ",
    "modelNames": { "vendor/chat-model": "chat model" },
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
| `src/segments.ts` | Pure segment builder (what to show, and its role) |
| `src/render.ts` | Width-aware joining: drop optional segments, then truncate |
| `src/format.ts` | Tokens, duration, cost, percentage, model-name formatting |
| `src/usage.ts` | Session token/cost totals and cache hit rate |
| `src/git.ts` | Cached `git diff HEAD --shortstat` reads (`--no-optional-locks`) |
| `src/context.ts` | `ctx.getContextUsage()` cache, keyed by session leaf |
| `src/config.ts` | Reads the `statusline` settings namespace |

Keep pure modules free of pi imports: they are the tested part, and they are what
changes when segments change.

## License

MIT
