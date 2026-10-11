import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const bundle = fs.readFileSync(new URL('../dist/artifacts/notes-system-launcher.js', import.meta.url), 'utf8');

// Runs the launcher bundle against a fake Trilium api. `runOnBackend` invokes the closure in-process,
// so the same fake also plays the backend api the closure reads.
function runLauncher({ todayNote = { noteId: 'todayNote123' }, visibleIds = [] } = {}) {
    const calls = [];
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
    const api = {
        currentNote: { noteId: 'scriptNote', hasLabel: () => false },
        showError() {},
        runOnBackend(fn, args) { return fn(...args); },
        getNoteWithLabel: (name) => (name === 'todayRoot' ? todayNote : null),
        getNote(id) {
            if (id === '_lbVisibleLaunchers') return { getChildNoteIds: () => [] };
            if (!id.startsWith('al_')) throw new Error(`no note ${id}`);
            if (!visibleIds.includes(id)) throw new Error(`no note ${id}`);
            return { getParentBranches: () => [{ parentNoteId: '_lbVisibleLaunchers' }], parentBranchIds: [] };
        },
        getBranch: () => null,
        setBranchPosition() {},
        refreshNoteOrdering() {},
        createOrUpdateLauncher(opts) {
            calls.push(opts);
            return { note: { setRelation() {}, setLabel() {}, setContent() {}, save() {}, labels: {} } };
        },
    };
    dom.window.api = api;
    dom.window.eval(`window.glob = {}; ${bundle}`);
    return calls;
}

test('registers a native note launcher for the Today dashboard, targeting the #todayRoot note', () => {
    const today = runLauncher().find((c) => c.id === 'openToday');
    assert.ok(today, 'openToday launcher was not created');
    assert.equal(today.type, 'note');
    assert.equal(today.title, 'Today');
    assert.equal(today.icon, 'sun');
    assert.equal(today.targetNoteId, 'todayNote123');
    assert.equal(today.isVisible, true);
});

test('keeps the Today launcher hidden if the user moved it out of the visible bar', () => {
    // al_openToday exists but is not under _lbVisibleLaunchers.
    const api = runLauncherWithHidden();
    assert.equal(api.find((c) => c.id === 'openToday').isVisible, false);
});

test('still registers the script launchers when there is no Today note yet', () => {
    const calls = runLauncher({ todayNote: null });
    assert.equal(calls.find((c) => c.id === 'openToday'), undefined);
    assert.ok(calls.find((c) => c.id === 'newTask'));
});

function runLauncherWithHidden() {
    const calls = [];
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
    dom.window.api = {
        currentNote: { noteId: 'scriptNote', hasLabel: () => false },
        showError() {},
        runOnBackend(fn, args) { return fn(...args); },
        getNoteWithLabel: () => ({ noteId: 'todayNote123' }),
        getNote(id) {
            if (id === 'al_openToday') return { getParentBranches: () => [{ parentNoteId: '_lbAvailableLaunchers' }] };
            if (id === '_lbVisibleLaunchers') return { getChildNoteIds: () => [] };
            throw new Error(`no note ${id}`);
        },
        getBranch: () => null, setBranchPosition() {}, refreshNoteOrdering() {},
        createOrUpdateLauncher(opts) { calls.push(opts); return { note: { setRelation() {}, setLabel() {}, setContent() {}, save() {} } }; },
    };
    dom.window.eval(`window.glob = {}; ${bundle}`);
    return calls;
}
