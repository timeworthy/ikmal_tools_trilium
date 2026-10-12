import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const bundle = fs.readFileSync(new URL('../dist/artifacts/notes-system-launcher.js', import.meta.url), 'utf8');

// Runs the launcher bundle against a fake Trilium api. `runOnBackend` invokes the closure in-process,
// so the same fake also plays the backend api the closure reads. Timers are captured, not run, so a
// test decides when a retry fires.
function runLauncher({ today = { noteId: 'todayNote123' }, visibleIds = [], availableIds = [], owner = null } = {}) {
    const calls = [];
    const labels = [];
    const timers = [];
    let todayNote = today;
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
    dom.window.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    dom.window.api = {
        currentNote: { noteId: 'scriptNote', hasLabel: () => false },
        showError() {},
        runOnBackend(fn, args) { return fn(...args); },
        getNoteWithLabel: (name) => (name === 'todayRoot' ? todayNote : null),
        getNote(id) {
            if (id === 'scriptNote') return { getOwnedLabelValue: (n) => (n === 'packageOwner' ? owner : null) };
            if (visibleIds.includes(id)) return { getParentBranches: () => [{ parentNoteId: '_lbVisibleLaunchers' }] };
            if (availableIds.includes(id)) return { getParentBranches: () => [{ parentNoteId: '_lbAvailableLaunchers' }] };
            throw new Error(`no note ${id}`);
        },
        createOrUpdateLauncher(opts) {
            calls.push(opts);
            return { note: { setRelation() {}, setLabel(name, value) { labels.push([opts.id, name, value]); }, setContent() {}, save() {} } };
        },
    };
    dom.window.eval(`window.glob = {}; ${bundle}`);
    return { calls, labels, timers, setToday: (note) => { todayNote = note; } };
}

const tick = () => new Promise((r) => setImmediate(r));

test('registers a native note launcher for the Today dashboard, targeting the #todayRoot note', () => {
    const today = runLauncher().calls.find((c) => c.id === 'openToday');
    assert.ok(today, 'openToday launcher was not created');
    assert.equal(today.type, 'note');
    assert.equal(today.title, 'Today');
    assert.equal(today.icon, 'sun');
    assert.equal(today.targetNoteId, 'todayNote123');
    assert.equal(today.isVisible, true);
});

test('keeps the Today launcher hidden if the user moved it out of the visible bar', () => {
    const { calls } = runLauncher({ availableIds: ['al_openToday'] });
    assert.equal(calls.find((c) => c.id === 'openToday').isVisible, false);
});

test('still registers the script launchers when there is no Today note yet', () => {
    const { calls } = runLauncher({ today: null });
    assert.equal(calls.find((c) => c.id === 'openToday'), undefined);
    assert.ok(calls.find((c) => c.id === 'newTask'));
});

test('retries the Today launcher until the bootstrap has created the #todayRoot note', async () => {
    const run = runLauncher({ today: null });
    await tick();
    assert.equal(run.timers.length, 1, 'a retry is scheduled while Today is missing');
    assert.equal(run.calls.find((c) => c.id === 'openToday'), undefined);

    run.setToday({ noteId: 'lateToday' }); // the bootstrap finished
    run.timers.shift().fn();
    await tick();
    const today = run.calls.find((c) => c.id === 'openToday');
    assert.equal(today?.targetNoteId, 'lateToday');
    assert.equal(run.timers.length, 0, 'no further retries once it exists');
});

test('gives up after a bounded number of Today retries', async () => {
    const run = runLauncher({ today: null });
    let fired = 0;
    for (let i = 0; i < 20; i++) {
        await tick();
        if (!run.timers.length) break;
        run.timers.shift().fn();
        fired++;
    }
    await tick();
    assert.equal(fired, 4);
    assert.equal(run.timers.length, 0);
});

test('stamps every launcher it creates with the package owner so uninstall can find them', () => {
    const { calls, labels } = runLauncher({ owner: 'iansherr/ikmal_tools_trilium' });
    const stamped = new Set(labels.filter(([, name, value]) => name === 'packageOwner' && value === 'iansherr/ikmal_tools_trilium').map(([id]) => id));
    for (const call of calls) assert.ok(stamped.has(call.id), `${call.id} is missing #packageOwner`);
    assert.ok(stamped.has('openToday') && stamped.has('newTask'));
});

test('does not invent an owner when the script was not installed through the package manager', () => {
    const { labels } = runLauncher({ owner: null });
    assert.deepEqual(labels.filter(([, name]) => name === 'packageOwner'), []);
});
