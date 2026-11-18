# Publishing

Two distribution paths, and they are independent: the git repository is enough for anyone
to install today, npm makes it installable by name and eligible for the pi gallery.

## Git only (works now)

```sh
pi install git:github.com/Hariketsu/pi-statusline
```

Pi clones the repository, reads the `pi` manifest from `package.json` and loads `./index.ts`
directly — no build step, no publish. Updates follow the default branch; append `@<ref>` to
pin a tag or commit.

This is the path to keep working even after publishing, because it never depends on the npm
name being available.

## npm

The unscoped name `pi-statusline` is taken by an unrelated, dormant package. Publish under a
scope instead:

```json
{ "name": "@hariketsu/pi-statusline" }
```

Then, once, with an npm account and a login:

```sh
npm login
npm publish --access public      # scoped packages default to private otherwise
```

`files` in `package.json` already restricts the tarball to `index.ts`, `src/`, `docs/` and the
READMEs, so tests and dotfiles stay out. Verify before publishing:

```sh
npm pack --dry-run               # the exact file list npm would upload
pi install npm:@hariketsu/pi-statusline   # from the local tarball or the registry, after publish
```

Users install a specific version with `pi install npm:@hariketsu/pi-statusline@0.1.0`; a bare
specification follows the latest tag.

## Pi gallery

The gallery at [pi.dev/packages](https://pi.dev/packages) lists npm packages that carry the
`pi-package` keyword — this package already does. There is no submission step: it appears
after the next publish. `pi.image` in the manifest adds a preview image; a recorded terminal
GIF or a screenshot of the footer in context is the difference between a click and a scroll.

## Versioning

Nothing is released yet, so `0.1.0` is the first tag. After that, keep it boring:

1. Change code and docs in one commit.
2. `git tag v0.2.0 && git push --tags`.
3. `npm publish` for the same version.
4. Write the changelog entry from the commits since the last tag.

Until the public interface settles (settings keys and segment ids are the interface), stay on
`0.x` and say so in the changelog when a setting is renamed.

## Before flipping the repository public

- `LICENSE` currently credits the handle `Hariketsu`; decide whether that or a legal name
  should appear.
- Check that no commit carries a personal email: history was rewritten to the GitHub noreply
  address and the repository is configured to keep using it
  (`git config user.email` in the clone).
- `README.md` is what the gallery shows; `README.zh-CN.md` is the Chinese entry point.

## Checklist

```sh
node --test tests/*.test.ts     # green
npm pack --dry-run              # only the intended files
gh repo edit --visibility public
git push -u origin main
npm publish --access public
```
