# Configuration

Everything is optional. Settings live under the `statusline` key in
`~/.pi/agent/settings.json`, next to the rest of your pi configuration. Run `/reload`
after changing them.

```json
{
  "statusline": {
    "enabled": true,
    "segments": ["model", "thinking", "dir", "git", "diff", "context", "cache", "tps", "duration", "statuses"],
    "separator": " · ",
    "modelNames": {},
    "showStatuses": true,
    "icons": "nerd",
    "style": "text",
    "tickMs": 1000,
    "gitTtlMs": 5000
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Start with the custom footer installed |
| `segments` | all, in the order above | Which segments to show, and in what order |
| `separator` | `" "` for `chips`, `" · "` otherwise | Text between segments |
| `modelNames` | `{}` | Display names for models, keyed by full id or its last path segment |
| `showStatuses` | `true` | Append the statuses other extensions publish |
| `icons` | `"nerd"` | `"nerd"`, `"emoji"` or `"none"` |
| `style` | `"text"` | `"text"`, `"chips"` or `"theme"`; see [Colors](#colors) |
| `tickMs` | `1000` | How often the elapsed-time segment redraws |
| `gitTtlMs` | `5000` | How long a git snapshot stays fresh before a background refresh |

Unknown keys and wrong types are ignored, never fatal.

## Segments

| Id | Shows | Example | Notes |
|---|---|---|---|
| `model` | Active model | `chat-model` | Last path segment of `ctx.model.id`, snapshot dates dropped |
| `thinking` | Thinking level | `󰧑 max` | Hidden when the level is `off` |
| `dir` | Directory | `pi-statusline` | Basename of the working directory |
| `git` | Branch | ` main` | From pi's footer data; hidden outside a repository |
| `diff` | Line counts | `+12 −3` | `git diff HEAD --shortstat`; hidden on a clean tree |
| `context` | Context usage | `󰡳 15%/1M` | Gauge glyph steps at 20/50/85%, color at 70/90% |
| `cache` | Prompt cache hit rate | ` 38%` | Only appears below 50% |
| `tps` | Throughput of the last turn | `󰓅 42.4t/s` | Hidden until a turn has been measured; `~` marks an estimate |
| `duration` | Time since the session started | `󰅐 1h2m` | Redraws every `tickMs` |
| `statuses` | Other extensions' statuses | `2 jobs` | From `ctx.ui.setStatus()` |

Marked optional segments — `git`, `diff`, `tps`, `duration`, `statuses` — are dropped first
when the line does not fit the terminal width.

## Examples

Minimal, no git, no numbers:

```json
{ "statusline": { "segments": ["model", "dir", "context"] } }
```

Plain text for a terminal without a Nerd Font:

```json
{ "statusline": { "icons": "none" } }
```

Background blocks instead of colored text:

```json
{ "statusline": { "style": "chips" } }
```

Rename a model without touching the rest:

```json
{ "statusline": { "modelNames": { "vendor/chat-model": "CM" } } }
```

## Colors

`style` decides how color is applied:

| Value | Look |
|---|---|
| `text` (default) | Gruvbox Light or Dark foreground colors, no backgrounds |
| `chips` | The same palette painted as background blocks |
| `theme` | pi's own semantic tokens: adapts to any theme, lower chroma |

The palette is chosen from the appearance the terminal reports, and only used when the
terminal reports truecolor support — otherwise the extension falls back to pi's theme
tokens rather than emitting escapes the terminal cannot show.

The light and dark identity colors are the same values (`#458588` model, `#689D6A`
directory, `#B16286` branch), because they were sampled from the original Claude Code bar
on a light terminal, where the same hues are used. Quiet facts share one faint grey.

## Commands

| Command | Effect |
|---|---|
| `/statusline` | Toggle between the custom footer and pi's built-in one |
| `/statusline debug` | Print the raw numbers behind the footer: style, tps counters, cache rate, context, git state, status count |
