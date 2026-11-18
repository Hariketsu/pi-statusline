# Development Rules

A pi extension that replaces the footer with one status line. Rendering is synchronous, the
footer replaces pi's built-in one, and the tests run under `node --test` with no dependencies
installed. `index.ts` wires pi to the pure modules in `src/`.

## Style

- Short answers, no emoji, code over prose.
- Answer the question before editing. When given feedback, say whether you agree before saying
  what you changed.

## Rendering

- `render()` does no IO. Cache the value, refresh in the background, redraw when it changes.
- Measure with the injected `visibleWidth`/`truncateToWidth`, never `.length`.
- Truncate with an ellipsis; a cut that splits words reads as a bug.
- Reapply colors on every line and never keep a themed string in state.
- Timers are `.unref()`'d and cleared in `dispose()`.
- Each painted run closes its own background.

## pi integration

- `setFooter` replaces the built-in footer. Re-render `getGitBranch()` and
  `getExtensionStatuses()`, or the branch and every other extension's status disappear.
- Facts that arrive asynchronously need a synchronous stand-in for the first frame; decide
  repository-ness from the branch pi already knows.
- `select()`, `confirm()` and `input()` report program status `blocked` while open; `custom()`
  reports it only when asked. Use `custom()` for pickers that only inspect state.
- Settings are read at load, not per render; say so where they are documented.

## Icons and colors

- Five-digit codepoints are written `\u{F09D1}`.
- Add glyphs to `src/icons.ts` and `tests/icons.test.ts` in one change, and look at them in the
  preview before shipping.
- Identity colors are fixed hex; state colors are theme tokens. A palette built only from
  `text`/`muted`/`dim` collapses into grey on low-chroma themes.

## Measurement

- A rate is provider token counts over the window they were generated in; teardown after the
  last token is not generation time.
- A fallback figure is shown as an estimate (`~`), and missing data hides the segment.

## TypeScript

- Erasable syntax only: no parameter properties, `enum`, `namespace`, `import =`, decorators.
- Import types from `@earendil-works/*`; keep runtime imports lazy and injectable so the tests
  run without `node_modules`.

## Tests

- `node --test tests/*.test.ts`. No dependencies, no build step.
- Unit-test the pure modules; drive `index.ts` through a fake host for the wiring.
- Inject a seam instead of adding a dependency.

## Documentation

- README covers what it shows, how to install, and the few settings worth knowing. Everything
  else belongs in `docs/`.
- `README.md`, `README.zh-CN.md`, `docs/configuration.md` and `docs/internals.md` are read by
  `tests/docs.test.ts`, so doc and glyph changes land together.
- Regenerate `assets/preview.png` with `node scripts/preview.mjs` and screenshot the printed
  HTML in a browser.

## CI and publishing

- The workflow runs on a path whitelist; add any document the tests read.
- `cancelled` is not `failed`: read the annotation before debugging the code.
- Publish scoped with `publishConfig.access: public`, and check `npm pack --dry-run` first.
- npm snapshots the README per version and lags behind on download statistics.

## Git

- `feat:`, `fix:`, `docs:`, `ci:`, `chore:`; one concern per commit, the why in the body.
- Do not commit unless asked, and do not rewrite published history.
