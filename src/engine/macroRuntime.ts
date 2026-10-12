/**
 * Trilium-facing half of the macro system: loads `#ikmalMacro` notes, listens for
 * their hotkeys, and hosts the macro palette. Decisions live in macroEngine.ts.
 */

import { BUTTON_ID_PREFIX, DEFAULT_BUTTON_ICON, LIBRARY_LABEL, buildLibrary, filterLibrary, type LibraryEntry, type LibraryNoteInput, buildRegistry, buttonSpecs, findByHotkey, matchAbbrev, searchMacros, runMacro, type Macro, type MacroHost, type MacroNoteInput, type MacroRunResult } from './macroEngine.js';
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
        markers?: { get(name: string): any };
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
    showPromptDialog?(options: { title?: string; message?: string; defaultValue?: string }): Promise<string | null | undefined>;
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
const LIBRARY_LABEL_NAMES = [...LABEL_NAMES, 'macroGroup', 'macroSummary'];

/**
 * Runs on the Trilium backend (so it must stay self-contained and read the global `api`).
 * Switches a library macro on or off by adding or removing `#ikmalMacro`. Nothing else about the note
 * changes, so its body and the user's edits survive. Safe to repeat. Returns an error message or null.
 */
function setMacroEnabled(noteId: string, enabled: boolean, libraryLabel: string): string | null {
    const note = api.getNote(noteId);
    if (!note) return 'That macro no longer exists.';
    if (!note.hasLabel(libraryLabel)) return 'Only library macros can be switched on and off here.';
    if (enabled) {
        if (!note.hasLabel('ikmalMacro')) note.setLabel('ikmalMacro');
    } else {
        note.removeLabel('ikmalMacro');
    }
    return null;
}

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

export async function loadLibrary(api: MacroApi, isMac: boolean): Promise<LibraryEntry[]> {
    const notes = await api.searchForNotes(`#${LIBRARY_LABEL}`);
    const inputs: LibraryNoteInput[] = [];
    for (const note of notes) {
        const labels: Record<string, string[]> = {};
        for (const name of LIBRARY_LABEL_NAMES) labels[name] = note.getLabels(name).map((l) => l.value);
        inputs.push({
            id: note.noteId, title: note.title, body: (await note.getContent()) ?? '', labels,
            enabled: note.getLabels('ikmalMacro').length > 0,
        });
    }
    return buildLibrary(inputs, isMac);
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

/**
 * A prompt dialog takes focus and the editor does not keep its caret, so an abbreviation expansion
 * remembers where it was typed with a marker (which follows later edits) and goes back to it.
 */
const ANCHOR = 'ikmal-macro-anchor';

function dropAnchor(editor: MacroEditor, position: any) {
    editor.model.change((writer) => {
        if (!editor.model.markers) return;
        writer.addMarker(ANCHOR, { range: writer.createRange(position), usingOperation: false, affectsData: false });
    });
}

/** Moves the caret back to the anchor and removes it; returns whether there was one. */
function returnToAnchor(editor: MacroEditor): boolean {
    const marker = editor.model.markers?.get(ANCHOR);
    if (!marker) return false;
    editor.model.change((writer) => {
        writer.setSelection(marker.getStart());
        writer.removeMarker(ANCHOR);
    });
    return true;
}

function makeHost(editor: MacroEditor, api: MacroApi, macro: Macro): MacroHost {
    return {
        // A dismissed dialog comes back as null/undefined; both mean "cancel the macro".
        prompt: async (label, defaultValue) => {
            if (!api.showPromptDialog) return defaultValue;
            const answer = await api.showPromptDialog({ title: macro.name, message: label, defaultValue });
            return answer ?? null;
        },
        readClipboard: () => navigator.clipboard.readText(),
        // api.addTextToActiveContextEditor inserts its argument as plain text, so go through
        // the editor's own HTML -> model pipeline to get real formatting.
        insertHtml: (html) => {
            returnToAnchor(editor);
            editor.model.insertContent(editor.data.toModel(editor.data.processor.toView(html)));
        },
        placeCursor: (mark) => placeCursorOnMark(editor, mark),
        executeCommand: (name) => editor.execute(name),
    };
}

/** Tells the user about a failed run or a warning; a cancelled prompt is deliberately silent. */
function reportRun(api: MacroApi, macro: Macro, result: MacroRunResult) {
    if (!result.ok && !result.cancelled) api.showError(`Macro "${macro.name}" failed: ${result.error}`);
    for (const warning of result.warnings ?? []) api.showMessage(`Macro "${macro.name}": ${warning}`);
}

/** Runs a macro in the active text editor; reports instead of silently doing nothing when there is none. */
export async function runInActiveEditor(api: MacroApi, macro: Macro): Promise<boolean> {
    const editor = await api.getActiveContextTextEditor();
    if (!editor) {
        api.showError(`Macro "${macro.name}" needs an open text note with the cursor in it.`);
        return false;
    }
    const result = await runMacro(macro, makeHost(editor, api, macro));
    reportRun(api, macro, result);
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

    const library = () => loadLibrary(api, isMac);

    /** Switches a library macro on or off, then reloads macros and launcher buttons. Returns an error message or null. */
    const setEnabled = async (id: string, enabled: boolean): Promise<string | null> => {
        if (!api.runOnBackend) return 'Switching macros on and off needs backend scripting.';
        if (enabled) {
            const entry = (await library()).find((e) => e.id === id);
            if (entry?.blocked) return entry.blocked;
        }
        let failure: string | null;
        try {
            failure = (await api.runOnBackend(setMacroEnabled, [id, enabled, LIBRARY_LABEL])) as string | null;
        } catch (err) {
            return `Could not ${enabled ? 'enable' : 'disable'} the macro: ${(err as { message?: string })?.message ?? err}`;
        }
        if (failure) return failure;
        await refresh();
        syncButtons();
        return null;
    };

    const runById = (id: string) => {
        const macro = macros.find((m) => m.id === id);
        if (macro) return runInActiveEditor(api, macro);
        api.showError('That macro no longer exists. Reload the frontend.');
        return Promise.resolve(false);
    };

    const openLibrary = async () => {
        let entries = await library();
        const modal = openModal({
            title: 'Macro library',
            icon: 'bx-bolt-circle',
            body: `
                <input type="text" class="form-control form-control-sm mb-2" id="ikmal-library-search" placeholder="Search the library…" autocomplete="off">
                <div id="ikmal-library-list" class="ns-lib-list"></div>`,
            confirmText: 'Done',
        }, () => true);
        modal.querySelector('.ns-modal-footer .ns-close')?.remove();
        const input = modal.querySelector<HTMLInputElement>('#ikmal-library-search')!;
        const list = modal.querySelector<HTMLElement>('#ikmal-library-list')!;

        const chips = (e: LibraryEntry) => [
            e.abbrev && `<code title="Type it, then press Tab">${escapeHtml(e.abbrev)}</code>`,
            e.hotkey && `<kbd>${escapeHtml(e.hotkey)}</kbd>`,
            e.button && `<span class="bx bx-${escapeHtml(e.button)}" title="Launch bar button"></span>`,
        ].filter(Boolean).join(' ');

        const render = () => {
            const shown = filterLibrary(entries, input.value);
            let group = '';
            list.innerHTML = shown.length
                ? shown.map((e, i) => {
                    const heading = e.group !== group ? `<h6 class="ns-lib-group text-muted">${escapeHtml(group = e.group)}</h6>` : '';
                    const blocked = !e.enabled && e.blocked;
                    return `${heading}
                        <div class="ns-lib-row" data-id="${escapeHtml(e.id)}">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="ikmal-lib-${i}" ${e.enabled ? 'checked' : ''} ${blocked ? 'disabled' : ''}>
                                <label class="form-check-label" for="ikmal-lib-${i}">${escapeHtml(e.name)}</label>
                                <span class="ns-lib-chips">${chips(e)}</span>
                            </div>
                            ${e.summary ? `<div class="text-muted small">${escapeHtml(e.summary)}</div>` : ''}
                            ${blocked ? `<div class="ns-lib-blocked small">${escapeHtml(e.blocked!)}</div>` : ''}
                            <div class="text-danger small ns-lib-error" hidden></div>
                        </div>`;
                }).join('')
                : `<div class="text-muted small p-2">${entries.length ? 'Nothing matches.' : 'The library is empty.'}</div>`;
        };

        list.addEventListener('change', async (event) => {
            const box = event.target as HTMLInputElement;
            const row = box.closest<HTMLElement>('.ns-lib-row');
            if (!row) return;
            const wanted = box.checked;
            box.disabled = true;
            const failure = await setEnabled(row.dataset.id!, wanted);
            if (failure) {
                box.checked = !wanted;
                box.disabled = false;
                const error = row.querySelector<HTMLElement>('.ns-lib-error')!;
                error.textContent = failure;
                error.hidden = false;
                return;
            }
            const scroll = list.scrollTop;
            entries = await library(); // other entries may have just become (un)blocked
            render();
            list.scrollTop = scroll;
        });
        input.addEventListener('input', render);
        render();
        input.focus();
    };

    const openPalette = async () => {
        await refresh();
        const modal = openModal({
            title: 'Macros',
            icon: 'bx-bolt-circle',
            body: `
                <input type="text" class="form-control form-control-sm mb-2" id="ikmal-macro-search" placeholder="Search macros…" autocomplete="off">
                <div id="ikmal-macro-list" class="list-group"></div>
                <button type="button" class="btn btn-link btn-sm px-0 mt-2" id="ikmal-macro-library-link">Manage macro library…</button>`,
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
                : '<div class="text-muted small p-2">No macros yet. Switch some on in the macro library, or create a note labelled <code>#ikmalMacro</code>.</div>';
            list.querySelectorAll('button').forEach((btn, i) => {
                btn.addEventListener('click', () => {
                    modal.querySelector<HTMLElement>('.ns-close')?.click();
                    void runInActiveEditor(api, matches[i]);
                });
            });
        };
        modal.querySelector<HTMLElement>('#ikmal-macro-library-link')!.addEventListener('click', () => {
            modal.querySelector<HTMLElement>('.ns-close')?.click();
            void openLibrary();
        });
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
                const start = position.getShiftedBy(-hit.abbrev!.length);
                editor.model.change((writer) => {
                    writer.remove(writer.createRange(start, position));
                });
                dropAnchor(editor, start);
                void runMacro(hit, makeHost(editor, api, hit)).then((r) => {
                    reportRun(api, hit, r);
                    if (r.cancelled) {
                        // Cancelled from the prompt: give back what was typed instead of eating it.
                        returnToAnchor(editor);
                        editor.model.change((writer) => {
                            writer.insertText(hit.abbrev!, editor.model.document.selection.getFirstPosition());
                        });
                    }
                    // Whatever happened, never leave a stale anchor behind.
                    if (editor.model.markers?.get(ANCHOR)) editor.model.change((writer) => writer.removeMarker(ANCHOR));
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
    return { refresh, openPalette, openLibrary, runById, syncButtons, library, setEnabled };
}
