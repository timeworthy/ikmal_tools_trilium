/**
 * Trilium-facing half of the macro system: loads `#ikmalMacro` notes, listens for
 * their hotkeys, and hosts the macro palette. Decisions live in macroEngine.ts.
 */

import { buildRegistry, findByHotkey, searchMacros, runMacro, type Macro, type MacroHost, type MacroNoteInput } from './macroEngine.js';
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
        document: { getRoot(): any };
        insertContent(content: any): void;
        change(callback: (writer: any) => void): void;
    };
}

export interface MacroApi {
    searchForNotes(query: string): Promise<MacroFNote[]>;
    getActiveContextTextEditor(): Promise<MacroEditor | null | undefined>;
    showError(message: string): void;
    showMessage(message: string): void;
}

const LABEL_NAMES = ['macroMode', 'macroHotkey', 'macroCommand'];

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
        const macro = findByHotkey(macros, e);
        if (macro) {
            e.preventDefault();
            e.stopPropagation();
            void runInActiveEditor(api, macro);
        }
    }, true);

    void refresh();
    return { refresh, openPalette };
}
