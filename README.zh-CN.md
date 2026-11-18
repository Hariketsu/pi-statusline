# pi-statusline

[English](./README.md) | 中文

pi 的一行式状态栏，接管 pi 自带 footer：模型 · 思考等级 · 目录 · git 分支与工作区行数 · 上下文占用 · 缓存命中率 · 生成速度 · 时长，末尾附上其它扩展用 `ctx.ui.setStatus()` 发布的状态。

```
chat-model · 󰧑 max · pi-statusline ·  feat/pi-statusline-plugin +12 −3 · 󰡳 15%/1M · ⚡87% · 42.4t/s ·  1h2m
```

## 安装

```sh
pi install /绝对路径/pi-statusline      # 本地开发
pi install git:github.com/<you>/pi-statusline
```

装完新开一个会话或 `/reload`；`/statusline` 在自定义 footer 和 pi 原生 footer 之间切换。

> npm 上 `pi-statusline` 已被一个无关的旧包占用（2026-05，Claude Code 兼容的 statusline）。
> 发布前把 `name` 改成带 scope 的形式，例如 `@hariketsu/pi-statusline`。

## 显示内容

| 段 | 例子 | 数据来源 |
|---|---|---|
| 模型 | `chat-model` | `ctx.model.id`，取最后一段路径、去快照日期 |
| 思考等级 | `󰧑 max` | `ctx.thinkingLevel`（`off` 时隐藏） |
| 目录 | `pi-statusline` | `ctx.cwd` 的 basename |
| Git | ` feat/x +12 −3` | `footerData.getGitBranch()` + `git diff HEAD --shortstat` |
| 差异 | `+12 −3` | 工作区对 HEAD 的增删行，绿加红减 |
| 上下文 | `󰡳 15%/1M` | `ctx.getContextUsage()`，图标与颜色随占用率变化 |
| 缓存 | `⚡87%` | 最近一条 assistant 消息的 prompt 缓存命中率 |
| 生成速度 | `42.4t/s` | 上一轮输出 token ÷ 生成窗口 |
| 时长 | ` 1h2m` | 首个会话条目的时间戳 → 现在 |
| 状态 | `2 jobs` | 其它扩展的 `ctx.ui.setStatus()` |

颜色默认是**色块**：模型、目录、分支、增删、上下文各占一块 Gruvbox 底色（按终端明暗自动选 Light/Dark）；思考等级、缓存率、生成速度、时长、其它扩展状态这些「安静信息」用彩色文字，不再套背景块——这样一行里有主次，而不是一排等重的方块。`style: "text"` 去掉背景，`style: "theme"` 走 pi 自己的 token。

### 数字的口径

- **上下文**：`ctx.getContextUsage()`，当前 token / 模型窗口。仪表图标在 20%、50%、85% 换字形，颜色在 70%、90% 升级。
- **缓存命中率**：最近一条 assistant 消息的 `cacheRead / (input + cacheRead + cacheWrite)`，与 pi 原生 footer 同一口径。≥80% 绿，≥50% 常规，再低标黄。
- **生成速度**：取该条 assistant 消息首个与最后一个 `message_update` delta 之间的时间窗，去除以 `usage.output`。下一轮流式期间每秒刷新约 4 次。
- **行数**：`git diff HEAD --shortstat`，暂存+未暂存对 HEAD 只算一次，未跟踪文件不计；读取用 `--no-optional-locks` 加 5 秒缓存，不会卡住 footer。
- **故意不显示**：套餐额度窗口（pi 没有 `.rate_limits`）、会话累计 token、花费——`38k tok` 和 `18%/1M` 并列会被读成重复，花费还能在 `/session` 里看到。

### 颜色

pi 的 `system` 主题会按终端明暗压饱和度保对比度，结果 `text`/`muted`/`dim` 三档几乎糊成一条灰线。所以状态栏自己上色：

| `style` | 行为 |
|---|---|
| `chips`（默认） | 按终端明暗选 Gruvbox Dark / Light，画成背景色块 |
| `text` | 同一套颜色只做前景色，不画背景 |
| `theme` | 走 pi 自己的语义 token：任何主题都适配，但饱和度低 |

这也是同行的做法：`pi-powerline-footer` 把身份色写死（`model: "#d787af"`、`path: "#00afaf"`），只有状态色才映射主题 token；`pi-airline` 直接用终端 ANSI 调色板。pi 的 `system` 主题为了对比度会压饱和度，纯主题 token 在浅色终端上必然糊成灰线。

只有在终端报告 truecolor 时才用固定色；256 色或 16 色终端会自动退回主题 token，不会输出显示不了的转义序列。模型名、`+N`/`−N`、上下文、缓存、生成速度都加了粗体。

### 窄屏

可选段（git 行数、生成速度、时长、状态）从后往前丢，丢完还超宽才截断；宽度计算用 pi-tui 的 `visibleWidth`/`truncateToWidth`，ANSI 和宽字符都安全。

## 配置

全部可选，写在 `~/.pi/agent/settings.json`，改完 `/reload`：

```json
{
  "statusline": {
    "segments": ["model", "thinking", "dir", "git", "diff", "context", "cache", "tps", "duration", "statuses"],
    "separator": " · ",
    "modelNames": { "vendor/chat-model": "chat model" },
    "icons": "nerd",
    "style": "chips",
    "showStatuses": true,
    "tickMs": 1000,
    "gitTtlMs": 5000
  }
}
```

| 键 | 默认 | 含义 |
|---|---|---|
| `segments` | 全部，按上表顺序 | 显示哪些段、以什么顺序 |
| `separator` | chips 默认 `" "`，其余 `" · "` | 段之间的分隔符 |
| `modelNames` | `{}` | 模型显示名覆盖，可用完整 id 或最后一段 |
| `icons` | `"nerd"` | `"nerd"`（Nerd Font 字形）/ `"emoji"` / `"none"` |
| `style` | `"chips"` | `"chips"`（色块）/ `"text"`（只上色）/ `"theme"`（pi 主题 token） |
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

纯逻辑（`src/segments.ts`、`src/render.ts`、`src/format.ts`、`src/tps.ts`、`src/usage.ts`、`src/git.ts`）不 import pi，方便测试；`index.ts` 只负责接线。

## License

MIT
