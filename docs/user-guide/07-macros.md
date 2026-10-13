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
| `#ikmalMacroLibrary` | Instead of `#ikmalMacro`: a library macro that stays off until you switch it on (see Macro library). Optional `#macroGroup` and `#macroSummary` describe it in the library screen. |

### Placing the cursor

(`{{cursor}}` is one of several [tokens](#tokens).) Put `{{cursor}}` anywhere in the body to choose where the caret lands after the insert, for example `<details><summary>{{cursor}}</summary><p></p></details>` leaves you typing in the summary. Only the first token counts and the rest are dropped. Without one, the caret stays at the end of the inserted content.

## Running a macro

- **Hotkey:** press the macro's `#macroHotkey` with the cursor in a text note.
- **Abbreviation:** type the `#macroAbbrev` (it must start a word, so `cousins` won't trigger `ins`) and press Tab. If the text before the caret isn't an abbreviation, Tab behaves normally. The longest matching abbreviation wins.
- **Button:** click the macro's launcher-bar button with the cursor in a text note. You can reorder or hide it in Configure Launchbar like any other launcher.
- **Palette:** press **Cmd/Ctrl+Shift+J**, type to filter, press Enter. Prefix matches rank first.

If no text note is active, you get an error message and nothing is inserted.

## Tokens

Write a token as `{{name}}` or `{{name:argument}}` anywhere in a macro's body.

| Token | Inserts |
| --- | --- |
| `{{cursor}}` | Nothing; the caret lands here afterwards. The first one wins. |
| `{{date}}`, `{{time}}`, `{{datetime}}` | Your local date (`2026-10-12`), time (`14:05`) or both. |
| `{{date:ddd, MMM D}}` | The same with your own format. Parts: `YYYY YY MMMM MMM MM M dddd ddd DD D HH mm ss`. Month and day names are English. |
| `{{clipboard}}` | The clipboard text. |
| `{{clipboard:url}}` | The clipboard as a link address, for `<a href="{{clipboard:url}}">`. Only `http`, `https`, `mailto`, `tel` and relative addresses get through; `javascript:` and the like insert nothing. |
| `{{prompt:Label}}` | Asks you for text when the macro runs. `{{prompt:Label\|default}}` pre-fills the answer. |

- A prompt used twice with the same label asks once. Cancelling any prompt stops the macro with nothing inserted and no error. If you ran it by typing an abbreviation, what you typed is put back where it was.
- Clipboard and prompt text is always inserted as plain text, never as HTML, so pasted `<b>` stays literal. Line breaks are kept.
- If the browser blocks clipboard access, the macro still runs, `{{clipboard}}` inserts nothing, and a message says why.
- A token with an unknown name is left as you typed it.

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


## Macro library

Ikmal Tools ships 18 example macros in four groups (Dates, Editor, Project, Writing). They are created once, switched off, in a note called **Macro Library** at the top of your tree, and only when backend scripting is enabled.

To switch some on: open the macros palette (Cmd/Ctrl+Shift+J), choose **Manage macro library**, and flip the switch next to a macro. It works at once, with no reload. Switching it off again removes only `#ikmalMacro`; the note and your edits stay.

- An entry is greyed out, with the reason, when its hotkey or abbreviation is already used by another macro you have switched on. Switch that one off first.
- The library notes are yours. Edit the text, change a hotkey or abbreviation, or delete one: the seeder remembers what it created and never recreates or overwrites an entry. A later version of Ikmal Tools adds only entries you have not been given before.
- To add your own entry to the library, give your note `#ikmalMacroLibrary`, and optionally `#macroGroup` and `#macroSummary`, instead of `#ikmalMacro`.

| Group | Macros |
| --- | --- |
| Dates | Long date (`ddate`), Timestamp (`ts`), Dated heading (`today`) |
| Editor | Changelog entry (Alt+Shift+C, with a launch bar button once on), Checklist item (Alt+Shift+L), Collapsible (`coll`), Table 3x3 (`tbl3`), Quote (`qq`) |
| Project | Meeting notes (`mtg`, Alt+Shift+M), Decision record (`adr`), Status update (`status`), Standup (`standup`), Retrospective (`retro`), Bug report (`bug`) |
| Writing | Signature (`sig`), Greeting (`hey`), Literal snippet (`snip`), Link from clipboard (`lnk`) |

Type the abbreviation, then Tab. All of them can be on together: no two entries share a trigger.
