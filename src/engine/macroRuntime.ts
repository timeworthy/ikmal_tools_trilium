/**
 * Trilium-facing half of the macro system: loads `#ikmalMacro` notes, listens for
 * their hotkeys, and hosts the macro palette. Decisions live in macroEngine.ts.
 */

import { BUTTON_ID_PREFIX, DEFAULT_BUTTON_ICON, buildRegistry, buttonSpecs, findByHotkey, matchAbbrev, searchMacros, runMacro, type Macro, type MacroHost, type MacroNoteInput } from './macroEngine.js';
import { openModal, escapeHtml } from '../components/nativeUi.js';

interface MacroFNote {
    noteId: string;
    title: string;
    getContent(): Promise<string | null | undefined>;
    getLabels(name: string): Array<{ value: string }>;
}

/** The slice of the CKEditor instance the macros use. */
export interface MacroEditor {
    execute(command: string): void;
    data: { processor: { toView(html: string): unknown }; toModel(viewFragment: any): unknown };
    model: {
        document: { getRoot(): any; selection: any };
        insertContent(content: any): void;
        change(callback: (writer: any) => void): void;
    };
}

export interface MacroApi {
    searchForNotes(query: string): Promise<MacroFNote[]>;
    getActiveContextTextEditor(): Promise<MacroEditor | null | undefined>;
    showError(message: string): void;
    showMessage(message: string): void;
    runOnBackend?(fn: (...args: any[]) => unknown, args: unknown[]): unknown;
    currentNote?: { noteId: string };
}

// The launcher bundle is not a module, so `api` is the Trilium global here.
declare const api: any;

interface LauncherSpec {
    id: string;
    title: string;
    icon: string;
    script: string;
    /** Also place the launcher on the mobile launch bar the first time it is created. */
    mobile?: boolean;
}

/**
 * Runs on the Trilium backend (runOnBackend serializes the function's source), so it must stay
 * self-contained and read the global `api`, never a captured variable.
 * Upserts one script launcher per macro button, keeps the user's visible/hidden choice, and hides
 * launchers of macros that lost their #macroButton label (never deletes them).
 */
function upsertMacroLaunchers(specs: LauncherSpec[], scriptNoteId: string, prefix: string): string[] {
    const problems: string[] = [];
    const wanted = new Set(specs.map((spec) => `al_${spec.id}`));
    // Stamp launchers with the package's #packageOwner so disabling or uninstalling the package
    // moves them off the launch bar.
    let owner = '';
    try {
        owner = api.getNote(scriptNoteId)?.getOwnedLabelValue('packageOwner') || '';
    } catch (error) {
        // Not installed through the package manager: nothing to attribute.
    }
    for (const spec of specs) {
        let isVisible = true;
        let existed = false;
        try {
            existed = !!api.getNote(`al_${spec.id}`);
            isVisible = api.getNote(`al_${spec.id}`).getParentBranches()
                .some((branch: any) => branch.parentNoteId === '_lbVisibleLaunchers');
        } catch (error) {
            // First install: nothing to preserve yet, so show it.
        }
        const result = api.createOrUpdateLauncher({
            id: spec.id, title: spec.title, icon: spec.icon, isVisible,
            type: 'script', scriptNoteId, targetNoteId: 'root',
        });
        const note = result?.note;
        if (!note) continue;
        note.setRelation('script', scriptNoteId);
        note.setContent(spec.script);
        note.setLabel('scriptInLauncherContent');
        note.mime = 'application/javascript;env=frontend';
        note.setLabel('iconClass', `bx bx-${spec.icon}`);
        if (owner) note.setLabel('packageOwner', owner);
        note.save();
        if (spec.mobile && !existed) {
            // Desktop launchers never show on mobile. Clone once; if the user later removes it, leave it removed.
            try {
                api.ensureNoteIsPresentInParent(note.noteId, '_lbMobileVisibleLaunchers');
            } catch (error) {
                problems.push(`adding ${spec.title} to the mobile launch bar: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    try {
        for (const child of api.getNote('_lbVisibleLaunchers').getChildNotes()) {
            const childId: string = child.noteId;
            if (!childId.startsWith(`al_${prefix}`) || wanted.has(childId)) continue;
            const stale = api.getNote(childId);
            api.createOrUpdateLauncher({
                id: childId.slice(3), title: stale.title, isVisible: false,
                type: 'script', scriptNoteId, targetNoteId: 'root',
            });
        }
    } catch (error) {
        // Hiding stale buttons is best effort, but report it rather than failing silently.
        problems.push(`hiding stale macro buttons: ${error instanceof Error ? error.message : String(error)}`);
    }
    return problems;
}

const PALETTE_BUTTON_ID = `${BUTTON_ID_PREFIX}palette`;

const LABEL_NAMES = ['macroMode', 'macroHotkey', 'macroAbbrev', 'macroButton', 'macroCommand'];

export async function loadMacros(api: MacroApi, isMac: boolean) {
    const notes = await api.searchForNotes('#ikmalMacro');
    const inputs: MacroNoteInput[] = [];
    for (const note of notes) {
        const labels: Record<string, string[]> = {};
        for (const name of LABEL_NAMES) labels[name] = note.getLabels(name).map((l) => l.value);
        inputs.push({ id: note.noteId, title: note.title, body: (await note.getContent()) ?? '', labels });
    }
    return buildRegistry(inputs, isMac);
}

/** Finds the first `mark` in the document, deletes it, and puts the caret where it was. */
function placeCursorOnMark(editor: MacroEditor, mark: string) {
    editor.model.change((writer) => {
        const root = editor.model.document.getRoot();
        for (const item of writer.createRangeIn(root).getItems()) {
            if (!item.is('$textProxy')) continue;
            const index = item.data.indexOf(mark);
            if (index === -1) continue;
            const at = writer.createPositionAt(item.parent, item.startOffset + index);
            writer.remove(writer.createRange(at, at.getShiftedBy(1)));
            writer.setSelection(at);
            return;
        }
    });
}

/** Text in the caret's block up to the caret; a non-text child (soft break, widget) resets it. */
export function textBeforeCaret(editor: MacroEditor): { text: string; position: any } | null {
    const selection = editor.model.document.selection;
    if (!selection.isCollapsed) return null;
    const position = selection.getFirstPosition();
    let text = '';
    for (const child of position.parent.getChildren()) {
        if (child.startOffset >= position.offset) break;
        if (!child.is('$text')) {
            text = '';
            continue;
        }
        text += child.data.slice(0, position.offset - child.startOffset);
    }
    return { text, position };
}

function makeHost(editor: MacroEditor): MacroHost {
    return {
        // api.addTextToActiveContextEditor inserts its argument as plain text, so go through
        // the editor's own HTML -> model pipeline to get real formatting.
        insertHtml: (html) => editor.model.insertContent(editor.data.toModel(editor.data.processor.toView(html))),
        placeCursor: (mark) => placeCursorOnMark(editor, mark),
        executeCommand: (name) => editor.execute(name),
    };
}

/** Runs a macro in the active text editor; reports instead of silently doing nothing when there is none. */
export async function runInActiveEditor(api: MacroApi, macro: Macro): Promise<boolean> {
    const editor = await api.getActiveContextTextEditor();
    if (!editor) {
        api.showError(`Macro "${macro.name}" needs an open text note with the cursor in it.`);
        return false;
    }
    const result = await runMacro(macro, makeHost(editor));
    if (!result.ok) api.showError(`Macro "${macro.name}" failed: ${result.error}`);
    return result.ok;
}

export function installMacroRuntime(api: MacroApi, isMac: boolean, paletteHotkey: (e: KeyboardEvent) => boolean) {
    let macros: Macro[] = [];

    const refresh = async () => {
        try {
            const registry = await loadMacros(api, isMac);
            macros = registry.macros;
            for (const error of registry.errors) console.warn(`[Ikmal Macros] ${error}`);
        } catch (err) {
            console.warn('[Ikmal Macros] could not load macros', err);
        }
    };

    let warnedNoButtons = false;
    const syncButtons = () => {
        const specs = buttonSpecs(macros);
        if (!api.runOnBackend) return;
        try {
            // The palette button is always present: on mobile there is no hotkey to open it.
            const launchers = [
                {
                    id: PALETTE_BUTTON_ID, title: 'Macros', icon: DEFAULT_BUTTON_ICON, mobile: true,
                    script: `(() => { if (window.__ikmalMacros) window.__ikmalMacros.openPalette(); else api.showError('Macros are not ready. Reload the frontend.'); })();`,
                },
                ...specs.map((spec) => ({
                    id: spec.id, title: spec.title, icon: spec.icon,
                    script: `(() => { if (window.__ikmalMacros) window.__ikmalMacros.runById(${JSON.stringify(spec.macroId)}); else api.showError('Macros are not ready. Reload the frontend.'); })();`,
                })),
            ];
            const done = api.runOnBackend?.(upsertMacroLaunchers, [launchers, api.currentNote?.noteId, BUTTON_ID_PREFIX]);
            Promise.resolve(done).then(
                (problems) => {
                    if (Array.isArray(problems) && problems.length) console.warn('[Ikmal Macros]', ...problems);
                },
                (err) => warnButtons(err, specs.length),
            );
        } catch (err) {
            warnButtons(err, specs.length);
        }
    };
    const warnButtons = (err: unknown, wanted: number) => {
        // Only worth mentioning to people who actually asked for buttons.
        if (warnedNoButtons || !wanted) return;
        warnedNoButtons = true;
        console.warn('[Ikmal Macros] launcher buttons skipped (backend scripting may be disabled):', err instanceof Error ? err.message : err);
    };

    const runById = (id: string) => {
        const macro = macros.find((m) => m.id === id);
        if (macro) return runInActiveEditor(api, macro);
        api.showError('That macro no longer exists. Reload the frontend.');
        return Promise.resolve(false);
    };

    const openPalette = async () => {
        await refresh();
        const modal = openModal({
            title: 'Macros',
            icon: 'bx-bolt-circle',
            body: `
                <input type="text" class="form-control form-control-sm mb-2" id="ikmal-macro-search" placeholder="Search macros…" autocomplete="off">
                <div id="ikmal-macro-list" class="list-group"></div>`,
            confirmText: 'Run',
        }, () => {
            modal.querySelector<HTMLElement>('#ikmal-macro-list button')?.click();
            return true;
        });
        const input = modal.querySelector<HTMLInputElement>('#ikmal-macro-search')!;
        const list = modal.querySelector<HTMLElement>('#ikmal-macro-list')!;
        const render = () => {
            const matches = searchMacros(macros, input.value);
            list.innerHTML = matches.length
                ? matches.map((m, i) => `<button type="button" class="list-group-item list-group-item-action py-1" data-i="${i}">${escapeHtml(m.name)}</button>`).join('')
                : '<div class="text-muted small p-2">No macros found. Create a note labelled <code>#ikmalMacro</code>.</div>';
            list.querySelectorAll('button').forEach((btn, i) => {
                btn.addEventListener('click', () => {
                    modal.querySelector<HTMLElement>('.ns-close')?.click();
                    void runInActiveEditor(api, matches[i]);
                });
            });
        };
        input.addEventListener('input', render);
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                list.querySelector<HTMLElement>('button')?.click();
            }
        });
        render();
        input.focus();
    };

    document.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (paletteHotkey(e)) {
            e.preventDefault();
            e.stopPropagation();
            void openPalette();
            return;
        }
        if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            const editor = (e.target as { ckeditorInstance?: MacroEditor } | null)?.ckeditorInstance;
            const before = editor && textBeforeCaret(editor);
            const hit = before && matchAbbrev(macros, before.text);
            if (editor && before && hit) {
                e.preventDefault();
                e.stopPropagation();
                const { position } = before;
                editor.model.change((writer) => {
                    writer.remove(writer.createRange(position.getShiftedBy(-hit.abbrev!.length), position));
                });
                void runMacro(hit, makeHost(editor)).then((r) => {
                    if (!r.ok) api.showError(`Macro "${hit.name}" failed: ${r.error}`);
                });
                return;
            }
        }
        const macro = findByHotkey(macros, e);
        if (macro) {
            e.preventDefault();
            e.stopPropagation();
            void runInActiveEditor(api, macro);
        }
    }, true);

    void refresh().then(syncButtons);
    return { refresh, openPalette, runById, syncButtons };
}
