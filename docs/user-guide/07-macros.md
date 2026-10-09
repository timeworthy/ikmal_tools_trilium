# Macros

Macros insert saved text or HTML into the text note you're editing, from a hotkey or the macro palette. Each macro is an ordinary note, so it syncs and is searchable like the rest of your workspace.

## Creating a macro

Create a note, give it the label `#ikmalMacro`, and put the content to insert in its body. The note title is the macro's name.

| Label | Meaning |
|---|---|
| `#ikmalMacro` | Marks the note as a macro (required). |
| `#macroMode=html` or `text` | `html` (default) inserts the body as formatted content. `text` inserts it literally, escaping any markup. |
| `#macroHotkey=alt+g` | Optional hotkey. `mod` means Cmd on macOS and Ctrl elsewhere. A hotkey needs Alt, Ctrl or Cmd. Hotkeys the launcher already uses (Alt+T/S/M, Cmd/Ctrl+Shift+K/J, Cmd/Ctrl+?) are rejected. |
| `#macroCommand=bold` | Optional and repeatable. CKEditor commands run in order after the insert. |

## Running a macro

- **Hotkey:** press the macro's `#macroHotkey` with the cursor in a text note.
- **Palette:** press **Cmd/Ctrl+Shift+J**, type to filter, press Enter. Prefix matches rank first.

If no text note is active, you get an error message and nothing is inserted.

## Notes

- Macros load at startup and each time the palette opens. A new hotkey takes effect after the palette is opened once, or after a reload.
- Invalid macros (empty body, bad mode, bad hotkey, duplicate hotkey) are skipped and logged to the console as `[Ikmal Macros]`. For a duplicate hotkey, the first macro found wins.
- Not yet supported: typed abbreviations (like `ians` expanding in place) and replaying `/` slash-menu keystrokes. Both need the editor package.
