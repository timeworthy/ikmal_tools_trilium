/**
 * Macro engine: one note per macro, triggered by a hotkey or the macro palette,
 * unfolding into inserted text/HTML and optional editor commands.
 *
 * Pure logic only -- the launcher owns the DOM listener and the Trilium api, and
 * hands this engine a small `MacroHost` to act through.
 *
 * A macro note is a note labelled `#ikmalMacro`:
 *   title            -> macro name
 *   body             -> content to insert
 *   #macroMode       -> `html` (default) inserts the body as HTML, `text` inserts it literally
 *   #macroHotkey     -> optional, e.g. `alt+shift+c` or `mod+shift+j` (`mod` = Cmd on macOS, Ctrl elsewhere)
 *   #macroCommand    -> optional, repeatable; editor commands run in order after the insert
 *
 * A `{{cursor}}` token in the body marks where the caret lands after the insert (first one wins,
 * extras are dropped). Without one, the caret stays at the end of the inserted content.
 */

export type MacroMode = 'html' | 'text';

export interface Hotkey {
    key: string;
    alt: boolean;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
}

export interface Macro {
    id: string;
    name: string;
    mode: MacroMode;
    content: string;
    hotkey: Hotkey | null;
    commands: string[];
}

export interface MacroNoteInput {
    id: string;
    title: string;
    body: string;
    labels: Record<string, string[]>;
}

/** Private-use character standing in for `{{cursor}}` while the content travels through the editor. */
export const CURSOR_MARK = '\uE000';
const CURSOR_TOKEN = /\{\{\s*cursor\s*\}\}/gi;

export interface MacroHost {
    insertHtml(html: string): void | Promise<void>;
    /** Moves the caret onto CURSOR_MARK, deleting it. Only called when the inserted html contains one. */
    placeCursor?(mark: string): void | Promise<void>;
    executeCommand(name: string): void | Promise<void>;
}

export interface MacroRunResult {
    ok: boolean;
    error?: string;
}

/** Hotkeys the launcher already owns; a macro may not shadow them. */
export const RESERVED_HOTKEYS = ['alt+t', 'alt+s', 'alt+m', 'mod+shift+k', 'mod+shift+j', 'mod+?'];

const MODIFIERS = new Set(['alt', 'ctrl', 'control', 'cmd', 'meta', 'shift', 'mod']);

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function parseHotkey(spec: string, isMac = false): Hotkey | null {
    const parts = spec.toLowerCase().split('+').map((p) => p.trim());
    if (parts.length === 0 || parts.some((p) => p === '')) {
        // A literal `+` key ("ctrl++") splits into empty parts; not supported, keep it simple.
        return null;
    }
    const key = parts[parts.length - 1];
    if (MODIFIERS.has(key)) return null;
    const hotkey: Hotkey = { key, alt: false, ctrl: false, meta: false, shift: false };
    for (const mod of parts.slice(0, -1)) {
        if (mod === 'alt') hotkey.alt = true;
        else if (mod === 'shift') hotkey.shift = true;
        else if (mod === 'ctrl' || mod === 'control') hotkey.ctrl = true;
        else if (mod === 'cmd' || mod === 'meta') hotkey.meta = true;
        else if (mod === 'mod') {
            if (isMac) hotkey.meta = true;
            else hotkey.ctrl = true;
        } else return null;
    }
    // A bare printable key would fire while typing; require at least one non-shift modifier.
    if (!hotkey.alt && !hotkey.ctrl && !hotkey.meta) return null;
    return hotkey;
}

export function hotkeyId(hotkey: Hotkey): string {
    return [hotkey.ctrl && 'ctrl', hotkey.meta && 'meta', hotkey.alt && 'alt', hotkey.shift && 'shift', hotkey.key]
        .filter(Boolean)
        .join('+');
}

export function matchesHotkey(hotkey: Hotkey, e: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): boolean {
    return (
        e.key.toLowerCase() === hotkey.key &&
        e.altKey === hotkey.alt &&
        e.ctrlKey === hotkey.ctrl &&
        e.metaKey === hotkey.meta &&
        e.shiftKey === hotkey.shift
    );
}

export type BuildResult = { macro: Macro } | { error: string };

export function buildMacro(note: MacroNoteInput, isMac = false): BuildResult {
    const label = (name: string) => note.labels[name]?.[0]?.trim() ?? '';
    const name = note.title.trim();
    if (!name) return { error: `Macro ${note.id} has no title.` };
    if (!note.body.trim()) return { error: `Macro "${name}" has an empty body.` };

    const rawMode = label('macroMode').toLowerCase() || 'html';
    if (rawMode !== 'html' && rawMode !== 'text') {
        return { error: `Macro "${name}" has unknown #macroMode "${rawMode}" (use html or text).` };
    }

    let hotkey: Hotkey | null = null;
    const rawHotkey = label('macroHotkey');
    if (rawHotkey) {
        hotkey = parseHotkey(rawHotkey, isMac);
        if (!hotkey) return { error: `Macro "${name}" has invalid #macroHotkey "${rawHotkey}".` };
        const reserved = RESERVED_HOTKEYS.map((r) => parseHotkey(r, isMac)).filter((h): h is Hotkey => !!h);
        if (reserved.some((r) => hotkeyId(r) === hotkeyId(hotkey!))) {
            return { error: `Macro "${name}" hotkey "${rawHotkey}" is reserved by the launcher.` };
        }
    }

    const commands = (note.labels['macroCommand'] ?? []).map((c) => c.trim()).filter(Boolean);
    return { macro: { id: note.id, name, mode: rawMode, content: note.body, hotkey, commands } };
}

export interface Registry {
    macros: Macro[];
    errors: string[];
}

/** Builds every macro, dropping invalid ones and the later of any two sharing a hotkey. */
export function buildRegistry(notes: MacroNoteInput[], isMac = false): Registry {
    const macros: Macro[] = [];
    const errors: string[] = [];
    const owners = new Map<string, string>();
    for (const note of notes) {
        const result = buildMacro(note, isMac);
        if ('error' in result) {
            errors.push(result.error);
            continue;
        }
        const { macro } = result;
        if (macro.hotkey) {
            const id = hotkeyId(macro.hotkey);
            const owner = owners.get(id);
            if (owner) {
                errors.push(`Macro "${macro.name}" hotkey conflicts with "${owner}"; macro skipped.`);
                continue;
            }
            owners.set(id, macro.name);
        }
        macros.push(macro);
    }
    return { macros, errors };
}

export function findByHotkey(macros: Macro[], e: Parameters<typeof matchesHotkey>[1]): Macro | undefined {
    return macros.find((m) => m.hotkey && matchesHotkey(m.hotkey, e));
}

/** Case-insensitive palette search: prefix matches rank above substring matches. */
export function searchMacros(macros: Macro[], query: string): Macro[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...macros].sort((a, b) => a.name.localeCompare(b.name));
    const prefix: Macro[] = [];
    const contains: Macro[] = [];
    for (const m of macros) {
        const n = m.name.toLowerCase();
        if (n.startsWith(q)) prefix.push(m);
        else if (n.includes(q)) contains.push(m);
    }
    const byName = (a: Macro, b: Macro) => a.name.localeCompare(b.name);
    return [...prefix.sort(byName), ...contains.sort(byName)];
}

export function renderHtml(macro: Macro): string {
    // Drop any literal mark character first so only a real `{{cursor}}` can place the caret.
    const source = macro.content.split(CURSOR_MARK).join('');
    const rendered = macro.mode === 'text'
        ? source
              .split(/\r?\n/)
              .map((line) => escapeHtml(line))
              .join('<br>')
        : source;
    let seen = false;
    return rendered.replace(CURSOR_TOKEN, () => {
        if (seen) return '';
        seen = true;
        return CURSOR_MARK;
    });
}

export async function runMacro(macro: Macro, host: MacroHost): Promise<MacroRunResult> {
    try {
        const html = renderHtml(macro);
        await host.insertHtml(html);
        if (html.includes(CURSOR_MARK)) await host.placeCursor?.(CURSOR_MARK);
        for (const command of macro.commands) await host.executeCommand(command);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
