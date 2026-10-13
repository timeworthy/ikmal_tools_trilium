# Architecture Overview — Ikmal Tools for Trilium

**Ikmal Tools for Trilium** (`iansherr/ikmal_tools_trilium`) is engineered with a strict separation between pure TypeScript engine logic and browser UI render artifacts. It is also separate from the Trilium host: the package manager, Plugins settings tab, and host-side tests live in the Trilium fork's `integration/plugins` branch.

---

## Directory Structure

```
src/
├── engine/                   # Pure TypeScript engines (0% DOM coupling, 100% unit-tested)
│   ├── templateEngine.ts     # Schema registry, template parsing, title formatting
│   ├── relationshipEngine.ts # Parent link auto-cloning & derived topic calculation
│   ├── ifThenRuleEngine.ts   # Event trigger matching & action execution pipelines
│   ├── todayEngine.ts        # Dashboard layout management & state persistence
│   ├── noteCreationEngine.ts # Unified note instantiation planning
│   ├── noteMaterializer.ts   # ETAPI / frontend script API note creation
│   ├── macroEngine.ts        # Macro notes -> hotkeys, abbreviations, tokens, library entries (pure)
│   ├── macroRuntime.ts       # Loads #ikmalMacro notes; hotkey/Tab listener, palette, library screen, library seeding
│   ├── macroLibraryData.ts   # The shipped example macro library (data only)
│   ├── fleetBridge.ts        # Targeted FleetSync sync payload formatting [BETA / IN DEVELOPMENT]
│   ├── weatherEngine.ts      # Open-Meteo weather API parsing
│   └── noteInsightsEngine.ts # Word count, heatmaps, anniversaries, stale notes
│
├── components/               # Pure UI components (Vanilla JS + Bootstrap 5 + Boxicons)
│   ├── TodayHomepage.tsx     # Workspace dashboard & widget grid
│   ├── TemplateStudio.tsx    # Schema & rule editor UI
│   ├── SettingsStudio.tsx    # Package settings & micro-tools catalog UI
│   └── nativeUi.ts           # Native Trilium look-and-feel UI primitives
│
└── artifacts/                # Standalone IIFE bundled entrypoints declared in trilium-package.json
    ├── notes-system-dashboard.jsx    # Build input for the workspace dashboard
    ├── notes-system-kanban.jsx       # Build input for the Task Kanban board
    ├── notes-system-insights.jsx     # Build input for productivity insights
    ├── notes-system-quick-capture.jsx# Build input for quick capture toolbar
    ├── notes-system-weather.jsx      # Build input for weather card
    ├── notes-system-on-this-day.jsx  # Build input for Time Machine
    ├── notes-system-stale-notes.jsx  # Build input for stale notes reviewer
    ├── notes-system-canvas.jsx       # Build input for interactive canvas (Beta)
    ├── notes-system-launcher.js      # Build input for global header bar & hotkey
    └── notes-system.css              # Build input for theme & UI stylesheet
```

The published package payloads are the bundled files under `dist/artifacts/`; those are
the paths referenced by `trilium-package.json` and verified with SRI.

---

## Manifest & SRI Integrity

`trilium-package.json` declares the core package artifacts. When running `npm run build`, `tools/build.mjs` automatically computes the Subresource Integrity (`sha256-...`) hash for every compiled JS/CSS file and updates `trilium-package.json` automatically. Editor behavior is maintained in the standalone `ikmal_editor_trilium` package.

## Macro system

`macroEngine.ts` is pure: it builds macros from note labels, expands tokens through a `MacroHost` (insert, prompt, clipboard, caret placement, editor commands), and builds the library list. `macroRuntime.ts` is the only part that touches Trilium.

- **Macros:** notes labelled `#ikmalMacro`. Registry rules: invalid macros and duplicate hotkeys or abbreviations are dropped (first wins) and logged as `[Ikmal Macros]`.
- **Tokens:** one regex pass in `renderHtml`. Literal text is left alone (html mode) or escaped (text mode); every inserted value is escaped, so clipboard or prompt text is never markup and a `{{cursor}}` arriving through the clipboard is just text. `{{clipboard:url}}` goes through `safeUrl`. Prompts are asked before anything is inserted, so a cancel leaves the note untouched.
- **Abbreviation expansion:** removes the typed text and leaves a CKEditor marker at that spot. A prompt dialog takes focus and the editor does not keep its caret, so the insert (or the restored abbreviation, on cancel) goes back to the marker.
- **Backend functions** (`upsertMacroLaunchers`, `setMacroEnabled`, `seedMacroLibrary`) are passed to `runOnBackend`, which serializes their source: each must be self-contained and read the global `api`, never an imported or captured name. esbuild would rename a shadowing `api`, so do not shadow it.
- **Scopes:** `#macroScope` is parsed into `Scope[]` on the macro; `inScope` is pure and takes a `NoteContext`. The runtime filters with `available()` before hotkey, Tab and palette handling and reads the active note fresh each time (tabs change); with no scoped macros it never touches the note. `scopesMayOverlap` decides whether two macros may share a trigger, and the registry and the library blocking both use it. Only differing note types are provably disjoint; do not widen that without a proof.
- **Auto-expand:** `ensureAutoExpand` hooks `model.document` `change:data` per editor (attached from the first keydown in it) and reacts only to batches with `isTyping`, so pastes, undo and our own edits cannot trigger it; the expansion itself runs in a microtask, never inside the change event. `expand` is shared with Tab. An auto expansion marks what it inserted (`EXPANSION` marker); Backspace while the caret is in or at the edge of that marker undoes it, and any other key or a pointerdown commits it. The restore goes through `insertContent` so text is wrapped in a paragraph when a block macro replaced an empty one. `shadowedBy` keeps an auto abbreviation from swallowing a longer one.
- **Chains:** `#macroStep` parses into `Macro.steps` (`insert`, `command`, `macro`, `open`); `buildMacro` always fills it (insert then the `#macroCommand`s when there are no step labels), and `stepsOf` gives hand-built macros the same default. `runMacro` walks the steps; a `macro:` step goes through `MacroHost.resolveMacro`, which the runtime backs with the macros that act in the active note, and recurses with a depth counter (`MAX_CHAIN_DEPTH`). The registry drops macros that form a cycle (`dropCycles`); the depth limit is only a backstop. Prompts are asked at the `insert` step that needs them, with the asking macro's name.
- **Library:** notes labelled `#ikmalMacroLibrary` (+ `#macroGroup`, `#macroSummary`) are inert. Switching one on adds `#ikmalMacro`; off removes it. `buildLibrary` blocks an entry whose hotkey or abbreviation an enabled macro already uses. `seedMacroLibrary` creates the shipped entries once, records their ids in `#macroLibrarySeeded` on the `#macroLibraryRoot` note, and never recreates or overwrites one.
- **Adding a library entry:** append to `MACRO_LIBRARY`. Tests require a unique id, no shared trigger anywhere in the library, no reserved hotkey, at most one caret, and 15 to 20 entries in total (raise that bound deliberately).
- **Launch bar:** macro buttons and the always-present Macros button are script launchers stamped with `#packageOwner` so the package manager can take them off the bar. The Macros button is also placed on the mobile bar on first creation only.
- **Where it runs:** `frontendStartup` does not run on mobile, so the launcher artifact is deployed with `#run=mobileStartup` too (`mobile: true` in the manifest).

