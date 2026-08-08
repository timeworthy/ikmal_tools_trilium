# FAQ

## Is this a Trilium plugin?

Yes — a package (`iansherr/ikmal_tools_trilium`) made of one render note (the
dashboard), standalone micro-tools, launcher entries, and a stylesheet. No backend script and no
custom HTTP endpoint — everything runs from the frontend. See `README.md`
for the artifact list and `trilium-package.json` for the manifest.

The package is separate from Trilium itself. The Trilium-side package manager, Plugins
settings tab, lifecycle coordination, and host tests are in the separate
[`integration/plugins` branch](https://github.com/iansherr/Trilium/tree/integration/plugins)
of the Trilium fork.

## Is the integration branch included in this repository?

No. This repository contains the Ikmal Tools package payload and package tests. The
integration branch contains the Trilium host infrastructure used to install and run it.

## Which Trilium version should be used for current testing?

Use the experimental [`integration/plugins` branch](https://github.com/iansherr/Trilium/tree/integration/plugins)
until the host-side changes are accepted upstream. It is for development and testing,
not production deployment.

## How is the package installed?

Run the integrated Trilium branch, open Settings → Plugins, and install this package from
a configured registry or the direct manifest URL shown in the README. Installing it pulls
the declared artifacts into that Trilium instance; it does not copy this repository into
the Trilium source checkout.

## What does Quick Capture's "Create" button actually do?

Builds a `NoteCreationPlan` (`noteCreationEngine.ts`) and materializes it
with `api.createNote`, then files it under any auto-clone targets and
today's journal note if the plan calls for it (`noteMaterializer.ts`). If the
template has a parent-link relationship (a Task's `~project`, say), the modal
shows a searchable picker over real existing notes of that type first — pick
one and the note is auto-cloned there; leave it blank and it just isn't. See
`README.md` → Creating notes.

## Why does the Kanban board always show the same tasks in the static preview, but real ones inside Trilium?

Outside Trilium (this repo's static preview page, tests) there's nothing to
search, so it falls back to a fixed sample dataset. Inside Trilium it's a
live `api.searchForNotes('#extTask')` query, same as every other note-driven
Today widget.

## I toggled a setting / saved the Specification — will it still be there after I reload?

Yes. Both persist as labels on the package's manifest note (searched by
`#packageOwner="iansherr/ikmal_tools_trilium" #packageArtifact="manifest"`) and are
re-applied automatically the next time the dashboard loads. See `README.md` →
Persistence for exactly how and why (not `runOnBackend`, not note content).

## Saving a setting failed with an error in the Settings tab — what happened?

`packagePersistence.ts` writes labels through a direct authenticated `fetch`
using the current session's CSRF token. The error message includes the HTTP
status; a 403 that survives a token refresh, or any non-2xx response,
surfaces as `Could not save this setting: ...` rather than failing silently.
Check you're logged into the same Trilium instance the dashboard note lives
in, and that the manifest note wasn't deleted or renamed out from under it.

## Why won't the Weather widget show anything?

It needs a location — latitude, longitude, and a label — set in the layout
editor. With no location set it renders an empty state rather than making a
request with empty coordinates. It calls Open-Meteo directly from the
browser; no API key required.

## Do I need `backendScriptingEnabled` turned on for this plugin?

No. Every write this plugin makes — settings, the YAML specification, note
creation, filing a note under a second parent — goes through either the
frontend script API directly or the same authenticated ETAPI convention the
Community Packages manager uses, both of which work
regardless of that instance option. It's specifically avoided because that
option is commonly off — see `README.md` → Persistence and Creating notes.

## The parent-link picker in Quick Capture says "No existing ... notes found"

That template's relationship target (e.g. Task's `~project` → Project Hub)
has no matching notes yet — the picker searches for `#<marker>` on the
target template and comes up empty. Create one of those first, or leave the
field blank; the note is still created, just without that relation or its
auto-clone.

## How do I deploy a change to a real instance?

```sh
npm run build
python3 tools/deploy_plugin_to_instance.py
```

The deploy script is idempotent: it finds the existing manifest/artifact
notes by their `packageArtifact` label and updates their content in place,
or creates them if they don't exist yet. Needs an ETAPI token for the target
instance — see `tools/etapi.py`. For a substantial package reorganization,
run `tools/cleanup_plugin_artifacts.py` first; it archives old package notes
and clears activation labels without deleting user-authored notes.

## Where do the built-in templates and categories come from?

`BUILTIN_TEMPLATES` and `BUILTIN_CATEGORIES` in `src/engine/templateEngine.ts`
— they're the defaults `TemplateEngine` is constructed with, not something
loaded from a file. Editing them in Template Studio (or via a saved YAML
Specification) changes the running instance; it doesn't touch that source
file.

## The tests pass locally but something's still broken in the dashboard — why?

`tests/notes_system.test.mjs` imports from `dist/`, not `src/` — `npm test`
recompiles first (`pretest`), but if you're running `node --test` directly
without that step, you're testing whatever was compiled last. Run `npm test`
or `npm run build` first.
