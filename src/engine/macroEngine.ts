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
 *   #macroAbbrev     -> optional typed abbreviation (e.g. `ians`); typing it then pressing Tab expands the macro
 *   #macroButton     -> optional launcher-bar button; the value is a Boxicons name (default `bolt-circle`)
 *   #macroCommand    -> optional, repeatable; editor commands run in order after the insert
 *
 * Tokens in the body, written `{{name}}` or `{{name:argument}}`:
 *   {{cursor}}               where the caret lands after the insert (first one wins, extras are dropped)
 *   {{date}} {{time}} {{datetime}}   current local time; `{{date:ddd, MMM D}}` takes a format (YYYY YY MMMM MMM MM M ddd DD D HH mm ss)
 *   {{clipboard}}            the clipboard text
 *   {{prompt:Label}}         asks for a value when the macro runs; `{{prompt:Label|default}}` pre-fills it
 * Unknown tokens are left as typed. Inserted values are escaped, so clipboard or prompt text is never read as HTML.
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
    abbrev: string | null;
    /** Boxicons name (without the `bx-` prefix) when the macro gets a launcher-bar button. */
    button: string | null;
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

export interface MacroHost {
    /** Asks the user for a value; null means they cancelled. Without it a prompt token takes its default. */
    prompt?(label: string, defaultValue: string): string | null | Promise<string | null>;
    /** The clipboard text. Without it (or if it throws) `{{clipboard}}` inserts nothing. */
    readClipboard?(): string | Promise<string>;
    now?(): Date;
    insertHtml(html: string): void | Promise<void>;
    /** Moves the caret onto CURSOR_MARK, deleting it. Only called when the inserted html contains one. */
    placeCursor?(mark: string): void | Promise<void>;
    executeCommand(name: string): void | Promise<void>;
}

export interface MacroRunResult {
    ok: boolean;
    error?: string;
    /** The user cancelled a prompt: nothing was inserted, and it is not an error. */
    cancelled?: boolean;
    /** Things that did not go to plan but did not stop the macro, e.g. an unreadable clipboard. */
    warnings?: string[];
}

/** Hotkeys the launcher already owns; a macro may not shadow them. */
export const RESERVED_HOTKEYS = ['alt+t', 'alt+s', 'alt+m', 'mod+shift+k', 'mod+shift+j', 'mod+?'];

export const DEFAULT_BUTTON_ICON = 'bolt-circle';

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

    const abbrev = label('macroAbbrev') || null;
    if (abbrev && !/^\S{2,32}$/.test(abbrev)) {
        return { error: `Macro "${name}" has invalid #macroAbbrev "${abbrev}" (2-32 characters, no spaces).` };
    }

    let button: string | null = null;
    if (note.labels['macroButton']?.length) {
        button = note.labels['macroButton'][0].trim().replace(/^bx-/, '') || DEFAULT_BUTTON_ICON;
        if (!/^[a-z0-9-]+$/.test(button)) {
            return { error: `Macro "${name}" has invalid #macroButton icon "${note.labels['macroButton'][0]}" (use a Boxicons name like bolt-circle).` };
        }
    }

    const commands = (note.labels['macroCommand'] ?? []).map((c) => c.trim()).filter(Boolean);
    return { macro: { id: note.id, name, mode: rawMode, content: note.body, hotkey, abbrev, button, commands } };
}

/** A library note as read from Trilium: a macro note that may or may not be switched on. */
export interface LibraryNoteInput extends MacroNoteInput {
    /** Whether the note currently carries `#ikmalMacro`. */
    enabled: boolean;
}

export interface LibraryEntry {
    id: string;
    name: string;
    group: string;
    summary: string;
    enabled: boolean;
    hotkey: string | null;
    abbrev: string | null;
    button: string | null;
    /** Why it cannot be switched on (invalid macro, or a trigger already used by an enabled macro). Always unset when enabled. */
    blocked?: string;
}

export const LIBRARY_LABEL = 'ikmalMacroLibrary';
export const DEFAULT_LIBRARY_GROUP = 'Other';

/**
 * Library entries for the library screen: grouped, sorted, with the reason an entry cannot be switched on.
 * An entry is blocked when it is not a valid macro, or when its hotkey or abbreviation is already taken by
 * a different enabled macro; enabling it would otherwise have the registry silently drop one of the two.
 */
export function buildLibrary(notes: LibraryNoteInput[], isMac = false): LibraryEntry[] {
    const parsed = notes.map((note) => ({ note, result: buildMacro(note, isMac) }));
    const hotkeyOwners = new Map<string, string>();
    const abbrevOwners = new Map<string, string>();
    for (const { note, result } of parsed) {
        if (!note.enabled || 'error' in result) continue;
        if (result.macro.hotkey) hotkeyOwners.set(hotkeyId(result.macro.hotkey), note.id);
        if (result.macro.abbrev) abbrevOwners.set(result.macro.abbrev, note.id);
    }
    const entries = parsed.map(({ note, result }): LibraryEntry => {
        const label = (name: string) => note.labels[name]?.[0]?.trim() ?? '';
        const entry: LibraryEntry = {
            id: note.id,
            name: note.title.trim() || note.id,
            group: label('macroGroup') || DEFAULT_LIBRARY_GROUP,
            summary: label('macroSummary'),
            enabled: note.enabled,
            hotkey: label('macroHotkey') || null,
            abbrev: label('macroAbbrev') || null,
            button: note.labels['macroButton']?.length ? (label('macroButton') || DEFAULT_BUTTON_ICON) : null,
        };
        if (note.enabled) return entry;
        if ('error' in result) return { ...entry, blocked: result.error };
        const { macro } = result;
        const hotkeyOwner = macro.hotkey && hotkeyOwners.get(hotkeyId(macro.hotkey));
        if (hotkeyOwner) return { ...entry, blocked: `Hotkey ${entry.hotkey} is already used by "${nameOf(notes, hotkeyOwner)}".` };
        const abbrevOwner = macro.abbrev && abbrevOwners.get(macro.abbrev);
        if (abbrevOwner) return { ...entry, blocked: `Abbreviation "${macro.abbrev}" is already used by "${nameOf(notes, abbrevOwner)}".` };
        return entry;
    });
    return entries.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

const nameOf = (notes: LibraryNoteInput[], id: string) => notes.find((n) => n.id === id)?.title.trim() || id;

export interface Registry {
    macros: Macro[];
    errors: string[];
}

/** Builds every macro, dropping invalid ones and the later of any two sharing a hotkey. */
export function buildRegistry(notes: MacroNoteInput[], isMac = false): Registry {
    const macros: Macro[] = [];
    const errors: string[] = [];
    const owners = new Map<string, string>();
    const abbrevOwners = new Map<string, string>();
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
        if (macro.abbrev) {
            const owner = abbrevOwners.get(macro.abbrev);
            if (owner) {
                errors.push(`Macro "${macro.name}" abbreviation "${macro.abbrev}" conflicts with "${owner}"; macro skipped.`);
                continue;
            }
            abbrevOwners.set(macro.abbrev, macro.name);
        }
        macros.push(macro);
    }
    return { macros, errors };
}

export function findByHotkey(macros: Macro[], e: Parameters<typeof matchesHotkey>[1]): Macro | undefined {
    return macros.find((m) => m.hotkey && matchesHotkey(m.hotkey, e));
}

/**
 * The macro whose abbreviation ends `textBeforeCaret`, if it starts a word (start of text or after
 * whitespace/punctuation). The longest abbreviation wins, so `ians` beats a shorter `ns`.
 */
export function matchAbbrev(macros: Macro[], textBeforeCaret: string): Macro | undefined {
    let best: Macro | undefined;
    for (const m of macros) {
        if (!m.abbrev || !textBeforeCaret.endsWith(m.abbrev)) continue;
        const before = textBeforeCaret.charAt(textBeforeCaret.length - m.abbrev.length - 1);
        if (before && /[\p{L}\p{N}_]/u.test(before)) continue;
        if (!best || m.abbrev.length > best.abbrev!.length) best = m;
    }
    return best;
}

export interface ButtonSpec {
    /** Launcher id; Trilium stores the launcher note as `al_<id>`. */
    id: string;
    macroId: string;
    title: string;
    icon: string;
}

export const BUTTON_ID_PREFIX = 'macro_';

export function buttonSpecs(macros: Macro[]): ButtonSpec[] {
    return macros
        .filter((m) => m.button)
        .map((m) => ({ id: `${BUTTON_ID_PREFIX}${m.id}`, macroId: m.id, title: m.name, icon: m.button! }));
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

const TOKEN = /\{\{\s*([a-z]+)\s*(?::([^}]*))?\}\}/gi;
const TOKEN_NAMES = new Set(['cursor', 'date', 'time', 'datetime', 'clipboard', 'prompt']);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_FORMATS: Record<string, string> = { date: 'YYYY-MM-DD', time: 'HH:mm', datetime: 'YYYY-MM-DD HH:mm' };

/** Values the host supplies for the non-pure tokens, keyed the way `renderHtml` looks them up. */
export interface TokenValues {
    now?: Date;
    clipboard?: string;
    prompts?: Record<string, string>;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(date: Date, format: string): string {
    return format.replace(/YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|mm|ss/g, (part) => {
        switch (part) {
            case 'YYYY': return String(date.getFullYear());
            case 'YY': return String(date.getFullYear()).slice(-2);
            case 'MMMM': return MONTHS[date.getMonth()];
            case 'MMM': return MONTHS[date.getMonth()].slice(0, 3);
            case 'MM': return pad(date.getMonth() + 1);
            case 'M': return String(date.getMonth() + 1);
            case 'dddd': return WEEKDAYS[date.getDay()];
            case 'ddd': return WEEKDAYS[date.getDay()].slice(0, 3);
            case 'DD': return pad(date.getDate());
            case 'D': return String(date.getDate());
            case 'HH': return pad(date.getHours());
            case 'mm': return pad(date.getMinutes());
            default: return pad(date.getSeconds());
        }
    });
}

/** Splits `Label|default` on the first pipe. */
export function parsePromptArg(arg: string): { label: string; defaultValue: string } {
    const pipe = arg.indexOf('|');
    return pipe === -1
        ? { label: arg.trim(), defaultValue: '' }
        : { label: arg.slice(0, pipe).trim(), defaultValue: arg.slice(pipe + 1) };
}

/** Distinct prompt tokens in the order they first appear. */
export function promptsIn(content: string): Array<{ label: string; defaultValue: string }> {
    const seen = new Map<string, { label: string; defaultValue: string }>();
    for (const match of content.matchAll(TOKEN)) {
        if (match[1].toLowerCase() !== 'prompt' || match[2] === undefined) continue;
        const prompt = parsePromptArg(match[2]);
        if (prompt.label && !seen.has(prompt.label)) seen.set(prompt.label, prompt);
    }
    return [...seen.values()];
}

export function needsClipboard(content: string): boolean {
    return [...content.matchAll(TOKEN)].some((match) => match[1].toLowerCase() === 'clipboard');
}

const clean = (value: string) => value.split(CURSOR_MARK).join('');

/** An inserted value: escaped, and its line breaks kept. Never interpreted as HTML. */
const valueHtml = (value: string) => escapeHtml(clean(value)).replace(/\r?\n/g, '<br>');

export function renderHtml(macro: Macro, values: TokenValues = {}): string {
    const source = clean(macro.content);
    const now = values.now ?? new Date();
    let seenCursor = false;
    let out = '';
    let last = 0;
    const literal = (text: string) => (macro.mode === 'text' ? text.split(/\r?\n/).map(escapeHtml).join('<br>') : text);

    for (const match of source.matchAll(TOKEN)) {
        const name = match[1].toLowerCase();
        out += literal(source.slice(last, match.index));
        last = match.index + match[0].length;
        if (!TOKEN_NAMES.has(name)) {
            out += literal(match[0]);
            continue;
        }
        const arg = match[2];
        if (name === 'cursor') {
            if (!seenCursor) out += CURSOR_MARK;
            seenCursor = true;
        } else if (name === 'clipboard') {
            out += valueHtml(values.clipboard ?? '');
        } else if (name === 'prompt') {
            const prompt = parsePromptArg(arg ?? '');
            out += valueHtml(values.prompts?.[prompt.label] ?? prompt.defaultValue);
        } else {
            const format = arg?.trim() || DEFAULT_FORMATS[name];
            out += valueHtml(formatDate(now, format));
        }
    }
    return out + literal(source.slice(last));
}

/** Errors from other realms (iframes, DOMException) fail `instanceof Error`, so read `.message` directly. */
const messageOf = (err: unknown) => (typeof (err as { message?: unknown })?.message === 'string' ? (err as { message: string }).message : String(err));

export async function runMacro(macro: Macro, host: MacroHost): Promise<MacroRunResult> {
    try {
        const warnings: string[] = [];
        const values: TokenValues = { now: host.now?.() ?? new Date(), prompts: {} };

        for (const { label, defaultValue } of promptsIn(macro.content)) {
            const answer = host.prompt ? await host.prompt(label, defaultValue) : defaultValue;
            if (answer === null) return { ok: false, cancelled: true };
            values.prompts![label] = answer;
        }
        if (needsClipboard(macro.content)) {
            try {
                values.clipboard = (await host.readClipboard?.()) ?? '';
            } catch (err) {
                values.clipboard = '';
                warnings.push(`Could not read the clipboard: ${messageOf(err)}`);
            }
        }

        const html = renderHtml(macro, values);
        await host.insertHtml(html);
        if (html.includes(CURSOR_MARK)) await host.placeCursor?.(CURSOR_MARK);
        for (const command of macro.commands) await host.executeCommand(command);
        return warnings.length ? { ok: true, warnings } : { ok: true };
    } catch (err) {
        return { ok: false, error: messageOf(err) };
    }
}
