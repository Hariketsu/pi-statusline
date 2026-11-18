# pi-statusline

One line under the editor with the few facts you actually look at while working:
which model is answering, where you are, what changed, how much context is left, and
how fast the tokens are coming.

```
chat-model · 󰧑 max · pi-statusline ·  main +12 −3 · 󰡳 15%/1M · 󰓅 42.4t/s · 󰅐 1h2m
```

Colors are picked for your terminal: the light and dark Gruvbox palettes are chosen from
what the terminal reports, so the line stays readable either way.

## What it shows

| | |
|---|---|
| **Model and thinking level** | `chat-model · 󰧑 max` |
| **Where you are** | directory, git branch, `+12 −3` working-tree line counts |
| **How much room is left** | `󰡳 15%/1M`, the gauge and color step up at 70% and 90% |
| **How fast it is going** | `󰓅 42.4t/s` for the last turn |
| **How long you have been here** | `󰅐 1h2m` |
| **What other extensions need** | their `ctx.ui.setStatus()` text, appended as-is |

Anything without data stays hidden — no `--` placeholders. The prompt cache only speaks up
when it stops working (below 50% hit rate).

## Install

```sh
pi install git:github.com/Hariketsu/pi-statusline
```

Start a new session or run `/reload`. `/statusline` switches back to pi's built-in footer;
`/statusline debug` prints the raw numbers behind each segment when something looks off.

## Requirements

- [pi](https://pi.dev) 1.5 or newer, in interactive mode (the footer is a TUI component)
- Node.js 22.19+
- A Nerd Font for the icons; set `"icons": "emoji"` or `"none"` to use something else

## Make it yours

Settings live in `~/.pi/agent/settings.json` next to the rest of your pi configuration:

```json
{
  "statusline": {
    "segments": ["model", "dir", "git", "diff", "context", "tps", "duration"],
    "separator": " · ",
    "icons": "nerd"
  }
}
```

Every segment is optional and reorderable; `style` switches between colored text and
background blocks. The full list of keys is in
[docs/configuration.md](./docs/configuration.md).

## Documentation

- [Configuration](./docs/configuration.md) — every setting, every segment
- [How it works](./docs/internals.md) — what it reads from pi, how each number is measured
- [Development](./docs/development.md) — tests, adding a segment
- [Publishing](./docs/publishing.md) — npm scope, gallery, release checklist

## License

MIT
