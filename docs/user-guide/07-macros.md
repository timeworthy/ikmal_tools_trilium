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
| `#macroCommand=bold` | Optional and repeatable. CKEditor commands run in order after the insert. |

### Placing the cursor

Put `{{cursor}}` anywhere in the body to choose where the caret lands after the insert, for example `<details><summary>{{cursor}}</summary><p></p></details>` leaves you typing in the summary. Only the first token counts and the rest are dropped. Without one, the caret stays at the end of the inserted content.

## Running a macro

- **Hotkey:** press the macro's `#macroHotkey` with the cursor in a text note.
- **Abbreviation:** type the `#macroAbbrev` (it must start a word, so `cousins` won't trigger `ins`) and press Tab. If the text before the caret isn't an abbreviation, Tab behaves normally. The longest matching abbreviation wins.
- **Palette:** press **Cmd/Ctrl+Shift+J**, type to filter, press Enter. Prefix matches rank first.

If no text note is active, you get an error message and nothing is inserted.

## Notes

- Macros load at startup and each time the palette opens. A new hotkey takes effect after the palette is opened once, or after a reload.
- Invalid macros (empty body, bad mode, bad hotkey, duplicate hotkey) are skipped and logged to the console as `[Ikmal Macros]`. For a duplicate hotkey, the first macro found wins.
- Not supported: replaying `/` slash-menu keystrokes. Put the resulting HTML in the macro body (for example a `<details>` block) and use `{{cursor}}` to place the caret instead.
- Duplicate abbreviations are skipped like duplicate hotkeys; the first macro found wins.
