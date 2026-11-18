# Development

No build step: pi loads `index.ts` directly and Node runs the TypeScript.

```sh
node --test tests/*.test.ts     # 53 tests, no dependencies
```

Tests use Node's built-in runner and its TypeScript support, so `node_modules` stays empty.
Keep syntax that strip-types supports: no parameter properties, no enums, no decorators.

## Layout

| File | Responsibility |
|---|---|
| `index.ts` | Extension entry: footer component, event wiring, `/statusline` |
| `src/segments.ts` | Pure segment builder: what to show, as colored parts |
| `src/render.ts` | Width-aware joining: group runs, drop optional segments, truncate |
| `src/palette.ts` | Role → color, theme-token fallback, chip vs text painting |
| `src/format.ts` | Tokens, duration, percentage, model-name formatting |
| `src/icons.ts` | Nerd Font / emoji / plain glyph sets |
| `src/tps.ts` | Throughput meter over the message stream |
| `src/usage.ts` | Session token totals and cache hit rate |
| `src/git.ts` | Cached `git diff HEAD --shortstat` reads |
| `src/context.ts` | `getContextUsage()` cache keyed by session leaf |
| `src/config.ts` | Reads the `statusline` settings namespace |

`tests/extension.test.ts` drives the real entry point through a fake host: it installs the
footer, feeds streaming events, renders a line and reads the result. Every rendering bug so
far lived in that wiring rather than in the pure modules, so changes to `index.ts` are expected
to come with a test there.

The rule that keeps this maintainable: **pure modules do not import pi**. `segments`,
`render`, `palette`, `format`, `tps`, `usage`, `git` and `context` all take plain data, which
is why the tests need no pi installation and no mocks.

## Adding a segment

1. Add the id to `SegmentId` in `src/types.ts` and to `KNOWN_SEGMENTS` in `src/config.ts`.
2. Add a `case` in `buildSegments` that pushes parts: pick a role from `Role`, mark the
   segment optional if it may be dropped on narrow terminals, and set `chip: false` if it
   should stay plain text.
3. If it needs new data, extend `SegmentInput` and pass it from `buildLine` in `index.ts`.
   Keep the read cheap or cache it — `render` is synchronous.
4. Add a test in `tests/segments.test.ts`. Assert role and text, not color codes.
5. Add a row to the table in `docs/configuration.md` and to the README if it is a headline
   feature.

## Testing conventions

- Palette values are pinned by a test to the hexes sampled from the original Claude Code
  bar, so "make it prettier" cannot silently change the identity colors.
- Icon tests assert each Nerd Font glyph is exactly one private-use code point. Five-digit
  codepoints need `\u{...}`; a `\u` escape takes four digits and silently produces the wrong
  glyph plus a stray character.
- Git tests create throwaway repositories under the OS temp dir and are skipped if `git` is
  missing.

## Publishing

The npm name `pi-statusline` is taken by an unrelated, dormant package, so the package is
published as `@hariketsu/pi-statusline`. The git repository is the distribution channel until
then, and stays a valid one afterwards.

See [publishing.md](./publishing.md) for the package contents, the gallery, versioning and the
pre-publish checklist.
