# Macros

Macros insert saved text or HTML into the text note you're editing, from a hotkey or the macro palette. Each macro is an ordinary note, so it syncs and is searchable like the rest of your workspace.

## Creating a macro

Create a note, give it the label `#ikmalMacro`, and put the content to insert in its body. The note title is the macro's name.

| Label | Meaning |
|---|---|
| `#ikmalMacro` | Marks the note as a macro (required). |
| `#macroMode=html` or `text` | `html` (default) inserts the body as formatted content. `text` inserts it literally, escaping any markup. |
| `#macroHotkey=alt+g` | Optional hotkey. `mod` means Cmd on macOS and Ctrl elsewhere. A hotkey needs Alt, Ctrl or Cmd. Hotkeys the launcher already uses (Alt+T/S/M, Cmd/Ctrl+Shift+K/J, Cmd/Ctrl+?) are rejected. |
| `#macroAbbrev=ians` | Optional typed abbreviation, 2 to 32 characters with no spaces. Type it at the start of a word and press **Tab** to replace it with the macro. |
| `#macroButton=star` | Optional launcher-bar button that runs the macro. The value is a Boxicons name (empty uses `bolt-circle`). Requires backend scripting (see below). |
| `#macroCommand=bold` | Optional and repeatable. CKEditor commands run in order after the insert. |

### Placing the cursor

Put `{{cursor}}` anywhere in the body to choose where the caret lands after the insert, for example `<details><summary>{{cursor}}</summary><p></p></details>` leaves you typing in the summary. Only the first token counts and the rest are dropped. Without one, the caret stays at the end of the inserted content.

## Running a macro

- **Hotkey:** press the macro's `#macroHotkey` with the cursor in a text note.
- **Abbreviation:** type the `#macroAbbrev` (it must start a word, so `cousins` won't trigger `ins`) and press Tab. If the text before the caret isn't an abbreviation, Tab behaves normally. The longest matching abbreviation wins.
- **Button:** click the macro's launcher-bar button with the cursor in a text note. You can reorder or hide it in Configure Launchbar like any other launcher.
- **Palette:** press **Cmd/Ctrl+Shift+J**, type to filter, press Enter. Prefix matches rank first.

If no text note is active, you get an error message and nothing is inserted.

## Launcher buttons need backend scripting

Creating launcher-bar buttons runs on Trilium's backend, so it only works when backend scripting is enabled (**Options → Security**, or `backendScriptingEnabled=true` in `config.ini`). If it is disabled, buttons are skipped with one `[Ikmal Macros]` console warning, and hotkeys, the palette and abbreviations keep working.

Removing `#macroButton` from a macro hides its button (moves it to the available launchers); the launcher note is not deleted.

## Notes

- Macros load at startup and each time the palette opens. A new hotkey takes effect after the palette is opened once, or after a reload.
- Invalid macros (empty body, bad mode, bad hotkey, duplicate hotkey) are skipped and logged to the console as `[Ikmal Macros]`. For a duplicate hotkey, the first macro found wins.
- Not supported: replaying `/` slash-menu keystrokes. Put the resulting HTML in the macro body (for example a `<details>` block) and use `{{cursor}}` to place the caret instead.
- Duplicate abbreviations are skipped like duplicate hotkeys; the first macro found wins.

## Editor commands

`#macroCommand` runs after the insert and the caret placement, so it acts at the caret. Tested against Trilium 0.106.0: `bold`, `blockQuote`, `insertTable` and `bulletedList`. For example, `#macroCommand=bold` with `{{cursor}}` at the end of the body leaves bold switched on for whatever you type next.

An unknown command name shows an error toast (`Macro "<name>" failed: ...`) and the macro's other effects stay in place.

## Mobile

Trilium runs `#run=frontendStartup` scripts on desktop only. The deploy tool therefore also gives the launcher note `#run=mobileStartup` (if you install by hand, add that second label yourself).

On a phone there is no hotkey and no Tab key, so use the **Macros** button: it is created once on the first run with backend scripting enabled and placed on both the desktop and the mobile launch bars. Tap it to open the palette, then tap a macro. If you remove it from the mobile launch bar, it stays removed.

Verified in a 390x844 touch browser emulation of Trilium 0.106.0, not on a physical device.

