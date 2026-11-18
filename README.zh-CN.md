# pi-statusline

[English](./README.md) | 中文

pi 的一行式状态栏，接管 pi 自带 footer。默认显示：模型 · 思考等级 · 目录 · git 分支与工作区行数 · 上下文占用 · 会话 token/缓存命中率/花费 · 时长，末尾附上其它扩展用 `ctx.ui.setStatus()` 发布的状态。

```
ds-flash · max · pi-statusline · feat/pi-statusline-plugin +12 −3 · 15%/500k · 38k tok · 87% cache · $0.42 · 1h2m
```

## 安装

```sh
pi install /绝对路径/pi-statusline      # 本地开发
pi install git:github.com/<you>/pi-statusline
```

装完新开一个会话或 `/reload`；`/statusline` 可以在自定义 footer 和 pi 原生 footer 之间切换。

> npm 上 `pi-statusline` 已被一个无关的旧包占用（2026-05，Claude Code 兼容的 statusline）。
> 发布前请把 `name` 改成带 scope 的形式，例如 `@<你的npm用户名>/pi-statusline`。

## 和 Claude Code 版的区别

- **没有 5h / 7d 额度窗口**：Claude Code 给 `.rate_limits`，pi 没有这个字段。那两段换成了会话 token、缓存命中率和花费——这些数据永远拿得到。想要套餐额度，可以再装 `pi-sub-quota` / `pi-usage-bar`。
- **颜色跟随 pi 主题**：用 `accent`/`muted`/`dim`/`success`/`error`/`warning` 语义 token，不再硬编码 Gruvbox，浅色主题也不刺眼。
- **行数是真的工作区**：`git diff HEAD --shortstat`，暂存与未暂存对 HEAD 只算一次，未跟踪文件不计。
- **缓存命中率**：最近一条 assistant 消息的 `cacheRead / (input + cacheRead + cacheWrite)`，与 pi 原生 footer 同一定义。
- **窄屏**：可选段（git 行数、用量、时长、状态）从后往前丢，丢完还超宽才截断。

## 配置

写在 `~/.pi/agent/settings.json`，全部可选：

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

| 键 | 默认 | 含义 |
|---|---|---|
| `segments` | 全部，按上表顺序 | 显示哪些段、以什么顺序 |
| `separator` | `" · "` | 段之间的分隔符 |
| `modelNames` | `{}` | 模型显示名覆盖，可用完整 id 或最后一段 |
| `showStatuses` | `true` | 是否追加其它扩展的状态 |
| `tickMs` | `1000` | 时长段的刷新间隔 |
| `gitTtlMs` | `5000` | git 快照有效期，过期后台刷新 |
| `enabled` | `true` | 是否默认接管 footer |

类型不对或未知的键会被忽略，不会让扩展报错。

## 开发

无需构建，pi 直接加载 `index.ts`。测试用 Node 内置 runner，零依赖：

```sh
node --test tests/*.test.ts
```

纯逻辑（`src/segments.ts`、`src/render.ts`、`src/format.ts`、`src/usage.ts`、`src/git.ts`）不 import pi，方便测试；`index.ts` 只负责接线。

## License

MIT
