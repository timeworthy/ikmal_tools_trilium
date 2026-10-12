import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildLibrary, filterLibrary, parseHotkey, matchesHotkey, buildMacro, buildRegistry, findByHotkey, searchMacros, runMacro, renderHtml, CURSOR_MARK,
    formatDate, promptsIn,
} from '../dist/engine/macroEngine.js';

const note = (over = {}) => ({ id: 'n1', title: 'Changelog', body: '<p>hi</p>', labels: {}, ...over });
const ev = (key, mods = {}) => ({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

test('parseHotkey resolves mod per platform and rejects unsafe specs', () => {
    assert.deepEqual(parseHotkey('mod+shift+c', true), { key: 'c', alt: false, ctrl: false, meta: true, shift: true });
    assert.deepEqual(parseHotkey('mod+shift+c', false), { key: 'c', alt: false, ctrl: true, meta: false, shift: true });
    assert.equal(parseHotkey('c'), null, 'bare key would fire while typing');
    assert.equal(parseHotkey('shift+c'), null, 'shift alone is not a safe modifier');
    assert.equal(parseHotkey('alt+'), null);
    assert.equal(parseHotkey('alt+bogus+c'), null);
    assert.equal(parseHotkey('alt+shift'), null, 'modifier as the final key');
});

test('matchesHotkey requires the exact modifier set', () => {
    const hk = parseHotkey('alt+c');
    assert.ok(matchesHotkey(hk, ev('c', { altKey: true })));
    assert.ok(matchesHotkey(hk, ev('C', { altKey: true })));
    assert.ok(!matchesHotkey(hk, ev('c', { altKey: true, shiftKey: true })), 'extra shift must not match');
    assert.ok(!matchesHotkey(hk, ev('c')));
    assert.ok(!matchesHotkey(hk, ev('d', { altKey: true })));
});

test('buildMacro defaults to html and validates fields', () => {
    const ok = buildMacro(note());
    assert.equal(ok.macro.mode, 'html');
    assert.equal(ok.macro.hotkey, null);
    assert.match(buildMacro(note({ title: ' ' })).error, /no title/);
    assert.match(buildMacro(note({ body: '  \n' })).error, /empty body/);
    assert.match(buildMacro(note({ labels: { macroMode: ['markdown'] } })).error, /unknown #macroMode/);
    assert.match(buildMacro(note({ labels: { macroHotkey: ['c'] } })).error, /invalid #macroHotkey/);
});

test('buildMacro rejects hotkeys the launcher already owns', () => {
    for (const hk of ['alt+t', 'ALT+S', 'alt+m', 'mod+shift+k', 'mod+shift+j']) {
        assert.match(buildMacro(note({ labels: { macroHotkey: [hk] } })).error, /reserved/, hk);
    }
    assert.ok(buildMacro(note({ labels: { macroHotkey: ['alt+c'] } })).macro);
});

test('buildRegistry keeps the first of two macros sharing a hotkey and reports the rest', () => {
    const a = note({ id: 'a', title: 'A', labels: { macroHotkey: ['alt+c'] } });
    const b = note({ id: 'b', title: 'B', labels: { macroHotkey: ['alt+c'] } });
    const bad = note({ id: 'c', title: '' });
    const { macros, errors } = buildRegistry([a, b, bad]);
    assert.deepEqual(macros.map((m) => m.name), ['A']);
    assert.equal(errors.length, 2);
    assert.equal(findByHotkey(macros, ev('c', { altKey: true })).name, 'A');
    assert.equal(findByHotkey(macros, ev('x', { altKey: true })), undefined);
});

test('searchMacros ranks prefix above substring and lists all when empty', () => {
    const { macros } = buildRegistry(['Weekly Changelog', 'Changelog', 'Bug changelog entry', 'Signature']
        .map((t, i) => note({ id: String(i), title: t })));
    assert.deepEqual(searchMacros(macros, 'change').map((m) => m.name), ['Changelog', 'Bug changelog entry', 'Weekly Changelog']);
    assert.deepEqual(searchMacros(macros, 'changelog').map((m) => m.name), ['Changelog', 'Bug changelog entry', 'Weekly Changelog']);
    assert.equal(searchMacros(macros, '').length, 4);
    assert.equal(searchMacros(macros, 'zzz').length, 0);
});

test('text mode escapes markup and keeps line breaks; html mode passes through', () => {
    const text = buildMacro(note({ body: '<b>x</b> & "y"\nline2', labels: { macroMode: ['text'] } })).macro;
    assert.equal(renderHtml(text), '&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;<br>line2');
    const html = buildMacro(note({ body: '<b>x</b>' })).macro;
    assert.equal(renderHtml(html), '<b>x</b>');
});

test('runMacro inserts first, then runs commands in order', async () => {
    const log = [];
    const macro = buildMacro(note({ labels: { macroCommand: ['bold', ' ', 'italic'] } })).macro;
    const res = await runMacro(macro, {
        insertHtml: (h) => log.push(['html', h]),
        executeCommand: (c) => log.push(['cmd', c]),
    });
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(log, [['html', '<p>hi</p>'], ['cmd', 'bold'], ['cmd', 'italic']]);
});

test('runMacro reports host failure and stops before later commands', async () => {
    const log = [];
    const macro = buildMacro(note({ labels: { macroCommand: ['a', 'b'] } })).macro;
    const res = await runMacro(macro, {
        insertHtml: () => {},
        executeCommand: (c) => { log.push(c); if (c === 'a') throw new Error('no editor'); },
    });
    assert.deepEqual(res, { ok: false, error: 'no editor' });
    assert.deepEqual(log, ['a']);
});

// ---- runtime wiring against a fake Trilium api (built launcher bundle) ----
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const launcherBundle = fs.readFileSync(new URL('../dist/artifacts/notes-system-launcher.js', import.meta.url), 'utf8');

async function launcherWithMacros(macroNotes, { editor: editorOverride, onCommand = () => {}, launchers = [], visibleChildren = [], backendDisabled = false, warnings = [], clones = [], prompt, clipboard, messages = [], store } = {}) {
    const inserted = [];
    // Fake CKEditor: records the HTML that went through the data pipeline and into the model.
    const defaultEditor = {
        execute: (c) => onCommand(c),
        data: { processor: { toView: (html) => ({ view: html }) }, toModel: (v) => ({ model: v.view }) },
        model: { insertContent: (m) => inserted.push(m.model) },
    };
    const editor = editorOverride === undefined ? defaultEditor : editorOverride;
    const errors = [];
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
    dom.window.setTimeout = () => 0; // the Today launcher retries on timers; keep them from holding the process open
    dom.window.api = {
        currentNote: { noteId: 's', hasLabel: () => false },
        showError: (m) => errors.push(m),
        showMessage: (m) => messages.push(m),
        showPromptDialog: prompt,
        runOnBackend(fn, args) {
            if (backendDisabled && fn.name === 'upsertMacroLaunchers') throw new Error('Backend script execution is disabled.');
            return fn(...args);
        },
        getNoteWithLabel: () => null,
        getNote(id) {
            const stored = store?.find((n) => n.noteId === id);
            if (stored) return stored;
            // Mirrors the real BNote: it has getChildNotes(), not getChildNoteIds().
            if (id === '_lbVisibleLaunchers') return { getChildNotes: () => visibleChildren.map((c) => ({ noteId: c.id, title: c.title })) };
            const child = visibleChildren.find((c) => c.id === id);
            if (child) return { title: child.title, getParentBranches: () => [{ parentNoteId: '_lbVisibleLaunchers' }] };
            throw new Error('none');
        },
        getBranch: () => null,
        ensureNoteIsPresentInParent(noteId, parentId) { clones.push([noteId, parentId]); },
        setBranchPosition() {}, refreshNoteOrdering() {},
        createOrUpdateLauncher(opts) {
            launchers.push(opts);
            return { note: { noteId: `al_${opts.id}`, setRelation() {}, setLabel() {}, setContent(c) { opts.script = c; }, save() {}, labels: {} } };
        },
        searchForNotes: async (q) => (store ? store.filter((n) => n.getLabels(q.slice(1)).length) : q === '#ikmalMacro' ? macroNotes : []),
        getActiveContextTextEditor: async () => editor,
    };
    if (clipboard) Object.defineProperty(dom.window.navigator, 'clipboard', { value: { readText: clipboard } });
    dom.window.console.warn = (...a) => warnings.push(a.join(' '));
    dom.window.eval(`window.glob = {}; ${launcherBundle}`);
    await dom.window.__ikmalMacros.refresh();
    await tick(); // let the startup refresh finish and its button sync run
    return { dom, inserted, errors };
}

const fnote = (id, title, body, labels = {}) => ({
    noteId: id, title,
    getContent: async () => body,
    getLabels: (n) => (labels[n] ?? []).map((value) => ({ value })),
});
const press = (dom, init) => dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
const tick = () => new Promise((r) => setTimeout(r, 10));

test('launcher: a macro hotkey inserts the macro and runs its commands', async () => {
    const cmds = [];
    const { dom, inserted } = await launcherWithMacros(
        [fnote('m1', 'Sig', '<p>Ian</p>', { macroHotkey: ['alt+g'], macroCommand: ['bold'] })],
        { onCommand: (c) => cmds.push(c) },
    );
    press(dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual(inserted, ['<p>Ian</p>']);
    assert.deepEqual(cmds, ['bold']);
});

test('launcher: unrelated keys and a hotkey-less macro insert nothing', async () => {
    const { dom, inserted } = await launcherWithMacros([fnote('m1', 'Sig', 'x', {}), fnote('m2', 'B', 'y', { macroHotkey: ['alt+g'] })]);
    press(dom, { key: 'g' });
    press(dom, { key: 'g', altKey: true, shiftKey: true });
    await tick();
    assert.deepEqual(inserted, []);
});

test('launcher: no active text editor reports an error instead of failing silently', async () => {
    const { dom, inserted, errors } = await launcherWithMacros([fnote('m1', 'Sig', 'x', { macroHotkey: ['alt+g'] })], { editor: null });
    press(dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual(inserted, []);
    assert.match(errors[0], /needs an open text note/);
});

test('launcher: the palette lists macros, filters, and runs the chosen one', async () => {
    const { dom, inserted } = await launcherWithMacros([fnote('a', 'Changelog', '<p>C</p>'), fnote('b', 'Signature', '<p>S</p>')]);
    press(dom, { key: 'J', metaKey: true, shiftKey: true });
    await tick();
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('#ikmal-macro-list button').length, 2);
    const input = doc.querySelector('#ikmal-macro-search');
    input.value = 'sig';
    input.dispatchEvent(new dom.window.Event('input'));
    assert.deepEqual([...doc.querySelectorAll('#ikmal-macro-list button')].map((b) => b.textContent), ['Signature']);
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick();
    assert.deepEqual(inserted, ['<p>S</p>']);
});

test('{{cursor}} becomes a single caret mark: first wins, extras and literal marks are dropped', () => {
    const html = buildMacro(note({ body: '<p>a {{cursor}} b {{ CURSOR }} c </p>' })).macro;
    assert.equal(renderHtml(html), '<p>a  b  c </p>');
    const text = buildMacro(note({ body: 'x\n{{cursor}}<y>', labels: { macroMode: ['text'] } })).macro;
    assert.equal(renderHtml(text), 'x<br>&lt;y&gt;');
    assert.equal(renderHtml(buildMacro(note({ body: '<p>none</p>' })).macro), '<p>none</p>');
});

test('runMacro places the caret only when the content has a cursor token, before commands run', async () => {
    const log = [];
    const host = { insertHtml: (h) => log.push(['html', h]), placeCursor: (m) => log.push(['cursor', m]), executeCommand: (c) => log.push(['cmd', c]) };
    await runMacro(buildMacro(note({ body: '<p>x{{cursor}}</p>', labels: { macroCommand: ['bold'] } })).macro, host);
    assert.deepEqual(log.map((e) => e[0]), ['html', 'cursor', 'cmd']);
    log.length = 0;
    await runMacro(buildMacro(note()).macro, host);
    assert.deepEqual(log.map((e) => e[0]), ['html']);
    // A host without placeCursor must not break a macro that has a token.
    assert.deepEqual(await runMacro(buildMacro(note({ body: '{{cursor}}' })).macro, { insertHtml() {}, executeCommand() {} }), { ok: true });
});

// ---- typed abbreviations ----
import { matchAbbrev } from '../dist/engine/macroEngine.js';

const abbrevMacros = () => buildRegistry([
    note({ id: 'a', title: 'Ians', labels: { macroAbbrev: ['ians'] } }),
    note({ id: 'b', title: 'Ns', labels: { macroAbbrev: ['ns'] } }),
]).macros;

test('buildMacro validates #macroAbbrev and buildRegistry drops duplicates', () => {
    assert.equal(buildMacro(note({ labels: { macroAbbrev: ['ians'] } })).macro.abbrev, 'ians');
    assert.equal(buildMacro(note()).macro.abbrev, null);
    for (const bad of ['a', 'two words', 'x'.repeat(33)]) {
        assert.match(buildMacro(note({ labels: { macroAbbrev: [bad] } })).error, /invalid #macroAbbrev/, bad);
    }
    const dup = buildRegistry([
        note({ id: '1', title: 'One', labels: { macroAbbrev: ['sig'] } }),
        note({ id: '2', title: 'Two', labels: { macroAbbrev: ['sig'] } }),
    ]);
    assert.deepEqual(dup.macros.map((m) => m.name), ['One']);
    assert.match(dup.errors[0], /abbreviation "sig" conflicts/);
});

test('matchAbbrev only fires at a word start and prefers the longest abbreviation', () => {
    const macros = abbrevMacros();
    assert.equal(matchAbbrev(macros, 'ians').name, 'Ians');
    assert.equal(matchAbbrev(macros, 'hello ians').name, 'Ians');
    assert.equal(matchAbbrev(macros, '(ians').name, 'Ians');
    assert.equal(matchAbbrev(macros, 'ns').name, 'Ns');
    assert.equal(matchAbbrev(macros, 'cousins'), undefined, 'mid-word must not expand');
    assert.equal(matchAbbrev(macros, 'ians '), undefined, 'caret must be right after the abbreviation');
    assert.equal(matchAbbrev(macros, 'fiansx'), undefined);
    assert.equal(matchAbbrev(macros, ''), undefined);
    assert.equal(matchAbbrev(buildRegistry([note()]).macros, 'anything'), undefined);
});

// Fake CKEditor with a single paragraph; records removals and insertions.
function fakeEditor(text, { collapsed = true, offset = text.length } = {}) {
    const log = { removed: [], inserted: [], restored: [], selected: [], markers: {} };
    const child = { startOffset: 0, data: text, is: (t) => t === '$text' };
    const position = {
        offset, parent: { getChildren: () => [child] },
        getShiftedBy(n) { return { offset: offset + n }; },
    };
    return {
        log,
        execute() {},
        data: { processor: { toView: (h) => ({ view: h }) }, toModel: (v) => ({ model: v.view }) },
        model: {
            markers: { get: (name) => log.markers[name] },
            document: { getRoot: () => ({}), selection: { isCollapsed: collapsed, getFirstPosition: () => position } },
            insertContent: (m) => log.inserted.push(m.model),
            change: (cb) => cb({
                createRange: (a, b = a) => [a.offset, b.offset],
                remove: (r) => log.removed.push(r),
                insertText: (t) => log.restored.push(t),
                addMarker: (name, { range }) => { log.markers[name] = { getStart: () => ({ offset: range[0] }) }; },
                removeMarker: (name) => { delete log.markers[name]; },
                setSelection: (p) => log.selected.push(p.offset),
            }),
        },
    };
}

async function tabIn(editor, { macros = [fnote('m', 'Ians', '<p>Ian Sherr</p>', { macroAbbrev: ['ians'] })], key = 'Tab', init = {} } = {}) {
    const { dom } = await launcherWithMacros(macros);
    const el = dom.window.document.createElement('div');
    el.ckeditorInstance = editor;
    dom.window.document.body.append(el);
    const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(e);
    await tick();
    return e;
}

test('Tab after a typed abbreviation deletes it and inserts the macro', async () => {
    const editor = fakeEditor('hello ians');
    const e = await tabIn(editor);
    assert.ok(e.defaultPrevented);
    assert.deepEqual(editor.log.removed, [[6, 10]]);
    assert.deepEqual(editor.log.inserted, ['<p>Ian Sherr</p>']);
});

test('Tab does nothing when the text before the caret is not an abbreviation', async () => {
    for (const text of ['hello cousins', 'hello ians ', 'plain']) {
        const editor = fakeEditor(text);
        const e = await tabIn(editor);
        assert.ok(!e.defaultPrevented, text);
        assert.deepEqual(editor.log, { removed: [], inserted: [], restored: [], selected: [], markers: {} }, text);
    }
});

test('Tab leaves a range selection, other keys, and shift+Tab alone', async () => {
    assert.ok(!(await tabIn(fakeEditor('ians', { collapsed: false }))).defaultPrevented);
    assert.ok(!(await tabIn(fakeEditor('ians'), { key: ' ' })).defaultPrevented);
    assert.ok(!(await tabIn(fakeEditor('ians'), { init: { shiftKey: true } })).defaultPrevented);
});


// ---- launcher-bar buttons ----
import { buttonSpecs } from '../dist/engine/macroEngine.js';

test('#macroButton parses to an icon, defaults it, and rejects junk; specs only include buttons', () => {
    assert.equal(buildMacro(note()).macro.button, null);
    assert.equal(buildMacro(note({ labels: { macroButton: [''] } })).macro.button, 'bolt-circle');
    assert.equal(buildMacro(note({ labels: { macroButton: ['bx-star'] } })).macro.button, 'star');
    assert.match(buildMacro(note({ labels: { macroButton: ['<script>'] } })).error, /invalid #macroButton/);
    const { macros } = buildRegistry([
        note({ id: 'a', title: 'A', labels: { macroButton: ['star'] } }),
        note({ id: 'b', title: 'B' }),
    ]);
    assert.deepEqual(buttonSpecs(macros), [{ id: 'macro_a', macroId: 'a', title: 'A', icon: 'star' }]);
});

test('launcher: a macro button becomes a native script launcher that runs the macro', async () => {
    const launchers = [];
    const { dom, inserted } = await launcherWithMacros(
        [fnote('m1', 'Sig', '<p>Ian</p>', { macroButton: ['star'] }), fnote('m2', 'NoBtn', 'x')],
        { launchers },
    );
    const mine = launchers.filter((l) => l.id.startsWith('macro_') && l.id !== 'macro_palette');
    assert.deepEqual(mine.map((l) => [l.id, l.title, l.icon, l.type, l.isVisible]), [['macro_m1', 'Sig', 'star', 'script', true]]);
    // The launcher's script, run as Trilium would, triggers the macro.
    dom.window.eval(mine[0].script);
    await tick();
    assert.deepEqual(inserted, ['<p>Ian</p>']);
});

test('launcher: an always-present Macros button opens the palette, even with no macro buttons', async () => {
    const launchers = [];
    const { dom } = await launcherWithMacros([fnote('m1', 'NoBtn', 'x')], { launchers });
    const palette = launchers.filter((l) => l.id === 'macro_palette');
    assert.deepEqual(palette.map((l) => [l.title, l.type, l.isVisible]), [['Macros', 'script', true]]);
    dom.window.eval(palette[0].script);
    await tick();
    assert.ok(dom.window.document.querySelector('#ikmal-macro-list'), 'palette modal opened');
    assert.match(dom.window.document.querySelector('#ikmal-macro-list').textContent, /NoBtn/);
});

test('launcher: the Macros button is cloned onto the mobile launch bar once, on first install only', async () => {
    const first = [];
    await launcherWithMacros([fnote('m1', 'Sig', 'x', { macroButton: ['star'] })], { clones: first });
    assert.deepEqual(first, [['al_macro_palette', '_lbMobileVisibleLaunchers']], 'only the palette button, not per-macro buttons');

    const later = [];
    await launcherWithMacros([], { clones: later, visibleChildren: [{ id: 'al_macro_palette', title: 'Macros' }] });
    assert.deepEqual(later, [], 'an existing launcher is left where the user put it');
});

test('launcher: buttons for macros that lost their label are hidden, never recreated visible or deleted', async () => {
    const launchers = [];
    await launcherWithMacros([fnote('m1', 'Keep', 'x', { macroButton: [''] })], {
        launchers,
        visibleChildren: [{ id: 'al_macro_gone', title: 'Gone' }, { id: 'al_macro_m1', title: 'Keep' }, { id: 'al_newTask', title: 'Task' }],
    });
    const hidden = launchers.filter((l) => l.isVisible === false);
    assert.deepEqual(hidden.map((l) => [l.id, l.title]), [['macro_gone', 'Gone']]);
    assert.ok(launchers.some((l) => l.id === 'macro_m1' && l.isVisible === true), 'kept button stays visible');
});

test('launcher: disabled backend scripting skips buttons with one warning and keeps hotkeys working', async () => {
    const warnings = [];
    const { dom, inserted } = await launcherWithMacros(
        [fnote('m1', 'Sig', '<p>Ian</p>', { macroButton: [''], macroHotkey: ['alt+g'] })],
        { backendDisabled: true, warnings },
    );
    assert.equal(warnings.filter((w) => /launcher buttons skipped/.test(w)).length, 1);
    press(dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual(inserted, ['<p>Ian</p>']);
});

test('launcher: no macro buttons means no warning even when backend scripting is disabled', async () => {
    const warnings = [];
    await launcherWithMacros([fnote('m1', 'Sig', 'x')], { backendDisabled: true, warnings });
    assert.deepEqual(warnings.filter((w) => /launcher buttons/.test(w)), []);
});

test('example macros: every shipped example builds, has a distinct trigger, and renders one cursor', () => {
    const examples = JSON.parse(fs.readFileSync(new URL('../data/example_macros.json', import.meta.url), 'utf8'));
    const notes = examples.map((e, i) => {
        const labels = {};
        for (const [name, value] of e.labels) (labels[name] ??= []).push(value);
        return { id: `ex${i}`, title: e.title, body: e.body, labels };
    });
    const { macros, errors } = buildRegistry(notes);
    assert.deepEqual(errors, []);
    assert.equal(macros.length, examples.length, 'none dropped as invalid or conflicting');
    for (const m of macros) {
        assert.equal(renderHtml(m).split(CURSOR_MARK).length - 1, 1, `${m.name} places the caret exactly once`);
    }
    const literal = macros.find((m) => m.name === 'Literal snippet');
    assert.match(renderHtml(literal), /Use &lt;b&gt; and &amp; as typed\.<br>/);
});

// ---- tokens ----

const when = new Date(2026, 9, 12, 14, 5, 9); // Mon 12 Oct 2026 14:05:09 local
const tm = (content, over = {}) => ({ id: 't', name: 'T', mode: 'html', content, hotkey: null, abbrev: null, button: null, commands: [], ...over });

test('formatDate formats the supported parts and leaves other text alone', () => {
    assert.equal(formatDate(when, 'YYYY-MM-DD'), '2026-10-12');
    assert.equal(formatDate(when, 'YY/M/D HH:mm:ss'), '26/10/12 14:05:09');
    assert.equal(formatDate(when, 'dddd, MMMM D'), 'Monday, October 12');
    assert.equal(formatDate(when, 'ddd MMM DD at HH'), 'Mon Oct 12 at 14');
});

test('date, time and datetime tokens use sensible defaults and accept a format', () => {
    const html = renderHtml(tm('{{date}}|{{time}}|{{datetime}}|{{date:ddd, MMM D}}|{{ date : YYYY }}'), { now: when });
    assert.equal(html, '2026-10-12|14:05|2026-10-12 14:05|Mon, Oct 12|2026');
});

test('clipboard and prompt values are escaped and cannot become markup or tokens', () => {
    const html = renderHtml(
        tm('<p>{{clipboard}} / {{prompt:Name}}</p>'),
        { clipboard: '<b>x</b> & {{cursor}}\nnext', prompts: { Name: '<img src=x onerror=1>' } },
    );
    assert.equal(html, '<p>&lt;b&gt;x&lt;/b&gt; &amp; {{cursor}}<br>next / &lt;img src=x onerror=1&gt;</p>');
    assert.ok(!html.includes(CURSOR_MARK), 'a {{cursor}} that arrived through the clipboard is just text');
});

test('a prompt token falls back to its default, and unknown tokens are left as typed', () => {
    assert.equal(renderHtml(tm('{{prompt:Who|World}}! {{nope}} {{date:}}'), { now: when }), 'World! {{nope}} 2026-10-12');
    assert.equal(renderHtml(tm('a {{unknown:x}} b', { mode: 'text' })), 'a {{unknown:x}} b');
});

test('tokens in text mode escape the literal text around them but keep their values on the same rules', () => {
    const html = renderHtml(tm('1 < 2\n{{prompt:Q}}', { mode: 'text' }), { prompts: { Q: 'a & b' } });
    assert.equal(html, '1 &lt; 2<br>a &amp; b');
});

test('promptsIn lists each distinct label once, in order, with its default', () => {
    assert.deepEqual(promptsIn('{{prompt:A|x}} {{prompt:B}} {{prompt:A|ignored}} {{prompt:}} {{date}}'), [
        { label: 'A', defaultValue: 'x' },
        { label: 'B', defaultValue: '' },
    ]);
});

function host(over = {}) {
    const inserted = [];
    return { inserted, insertHtml: (h) => inserted.push(h), executeCommand() {}, now: () => when, ...over };
}

test('runMacro asks each distinct prompt once and uses the answers', async () => {
    const asked = [];
    const h = host({ prompt: (label, def) => { asked.push([label, def]); return `ans-${label}`; } });
    const result = await runMacro(tm('{{prompt:A|d}} {{prompt:B}} {{prompt:A}}'), h);
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(asked, [['A', 'd'], ['B', '']]);
    assert.deepEqual(h.inserted, ['ans-A ans-B ans-A']);
});

test('cancelling a prompt inserts nothing, runs no commands, and is not an error', async () => {
    const commands = [];
    const h = host({ prompt: (label) => (label === 'B' ? null : 'x'), executeCommand: (c) => commands.push(c) });
    const result = await runMacro(tm('{{prompt:A}} {{prompt:B}}', { commands: ['bold'] }), h);
    assert.deepEqual(result, { ok: false, cancelled: true });
    assert.deepEqual(h.inserted, []);
    assert.deepEqual(commands, []);
});

test('an unreadable clipboard warns but the macro still runs', async () => {
    const h = host({ readClipboard: () => { throw new Error('denied'); } });
    const result = await runMacro(tm('[{{clipboard}}]'), h);
    assert.equal(result.ok, true);
    assert.match(result.warnings[0], /Could not read the clipboard: denied/);
    assert.deepEqual(h.inserted, ['[]']);
});

test('the clipboard is only read when the macro uses it', async () => {
    let reads = 0;
    await runMacro(tm('plain'), host({ readClipboard: () => { reads++; return 'x'; } }));
    assert.equal(reads, 0);
});

test('hotkey run: the prompt dialog is shown with the macro name and label, and the answer is inserted', async () => {
    const dialogs = [];
    const { dom, inserted } = await launcherWithMacros(
        [fnote('m1', 'Greet', '<p>Hi {{prompt:Name|there}}</p>', { macroHotkey: ['alt+g'] })],
        { prompt: async (o) => { dialogs.push(o); return 'Ian'; } },
    );
    press(dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual(JSON.parse(JSON.stringify(dialogs)), [{ title: 'Greet', message: 'Name', defaultValue: 'there' }]); // JSON: objects built inside the jsdom realm
    assert.deepEqual(inserted, ['<p>Hi Ian</p>']);
});

test('hotkey run: cancelling the prompt shows no error and inserts nothing', async () => {
    const { dom, inserted, errors } = await launcherWithMacros(
        [fnote('m1', 'Greet', '<p>{{prompt:Name}}</p>', { macroHotkey: ['alt+g'] })],
        { prompt: async () => null },
    );
    press(dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual([inserted, errors], [[], []]);
});

test('hotkey run: clipboard text reaches the editor, and a clipboard failure shows a message', async () => {
    const ok = await launcherWithMacros(
        [fnote('m1', 'Paste', '<p>{{clipboard}}</p>', { macroHotkey: ['alt+g'] })],
        { clipboard: async () => 'copied <x>' },
    );
    press(ok.dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual(ok.inserted, ['<p>copied &lt;x&gt;</p>']);

    const messages = [];
    const bad = await launcherWithMacros(
        [fnote('m1', 'Paste', '<p>{{clipboard}}</p>', { macroHotkey: ['alt+g'] })],
        { clipboard: async () => { throw new Error('blocked'); }, messages },
    );
    press(bad.dom, { key: 'g', altKey: true });
    await tick();
    assert.deepEqual(bad.inserted, ['<p></p>']);
    assert.match(messages[0], /Paste.*Could not read the clipboard: blocked/);
});

test('Tab expansion: cancelling the prompt puts the typed abbreviation back', async () => {
    const editor = fakeEditor('hello ians');
    const { dom } = await launcherWithMacros(
        [fnote('m', 'Ians', '<p>{{prompt:X}}</p>', { macroAbbrev: ['ians'] })],
        { prompt: async () => null },
    );
    const el = dom.window.document.createElement('div');
    el.ckeditorInstance = editor;
    dom.window.document.body.append(el);
    el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    await tick();
    assert.deepEqual(editor.log.removed, [[6, 10]]);
    assert.deepEqual(editor.log.selected, [6], 'the caret goes back to where the abbreviation was typed, not wherever the dialog left it');
    assert.deepEqual(editor.log.restored, ['ians']);
    assert.deepEqual(editor.log.inserted, []);
    assert.deepEqual(editor.log.markers, {}, 'no anchor left behind');
});

test('Tab expansion: an answered prompt inserts at the anchor and cleans it up', async () => {
    const editor = fakeEditor('hello ians');
    const { dom } = await launcherWithMacros(
        [fnote('m', 'Ians', '<p>{{prompt:X}}</p>', { macroAbbrev: ['ians'] })],
        { prompt: async () => 'yes' },
    );
    const el = dom.window.document.createElement('div');
    el.ckeditorInstance = editor;
    dom.window.document.body.append(el);
    el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    await tick();
    assert.deepEqual(editor.log.selected, [6]);
    assert.deepEqual(editor.log.inserted, ['<p>yes</p>']);
    assert.deepEqual(editor.log.restored, []);
    assert.deepEqual(editor.log.markers, {});
});

// ---- library ----

const lib = (id, title, labels = {}, enabled = false, body = '<p>x</p>') => ({ id, title, body, labels: { macroGroup: ['Writing'], ...labels }, enabled });

test('buildLibrary groups and sorts entries and reports enabled state and triggers', () => {
    const entries = buildLibrary([
        lib('b', 'Zebra', { macroGroup: ['Writing'], macroAbbrev: ['zb'] }),
        lib('a', 'Alpha', { macroGroup: ['Writing'], macroSummary: ['First one'], macroHotkey: ['alt+shift+a'], macroButton: [''] }, true),
        lib('c', 'Table', { macroGroup: ['Editor'] }),
        lib('d', 'Loose', { macroGroup: [] }),
    ]);
    assert.deepEqual(entries.map((e) => [e.group, e.name, e.enabled]), [
        ['Editor', 'Table', false], ['Other', 'Loose', false], ['Writing', 'Alpha', true], ['Writing', 'Zebra', false],
    ]);
    const alpha = entries.find((e) => e.id === 'a');
    assert.deepEqual([alpha.summary, alpha.hotkey, alpha.abbrev, alpha.button], ['First one', 'alt+shift+a', null, 'bolt-circle']);
    assert.equal(entries.find((e) => e.id === 'b').abbrev, 'zb');
});

test('buildLibrary blocks an entry that is not a valid macro, saying why', () => {
    const entries = buildLibrary([
        lib('bad', 'Bad hotkey', { macroHotkey: ['alt+t'] }),
        lib('empty', 'Empty', {}, false, '  '),
        lib('ok', 'Fine'),
    ]);
    assert.match(entries.find((e) => e.id === 'bad').blocked, /reserved by the launcher/);
    assert.match(entries.find((e) => e.id === 'empty').blocked, /empty body/);
    assert.equal(entries.find((e) => e.id === 'ok').blocked, undefined);
});

test('buildLibrary blocks an entry whose hotkey or abbreviation an enabled macro already uses', () => {
    const entries = buildLibrary([
        lib('on', 'Already on', { macroHotkey: ['alt+shift+x'], macroAbbrev: ['sig'] }, true),
        lib('h', 'Same hotkey', { macroHotkey: ['Alt+Shift+X'] }),
        lib('a', 'Same abbrev', { macroAbbrev: ['sig'] }),
        lib('free', 'Free', { macroHotkey: ['alt+shift+y'], macroAbbrev: ['other'] }),
    ]);
    assert.match(entries.find((e) => e.id === 'h').blocked, /Hotkey Alt\+Shift\+X is already used by "Already on"/);
    assert.match(entries.find((e) => e.id === 'a').blocked, /Abbreviation "sig" is already used by "Already on"/);
    assert.equal(entries.find((e) => e.id === 'free').blocked, undefined);
    assert.equal(entries.find((e) => e.id === 'on').blocked, undefined, 'an enabled entry is never blocked by itself');
});

test('two disabled entries that clash are both allowed; enabling one then blocks the other', () => {
    const clash = { macroAbbrev: ['sig'] };
    assert.ok(buildLibrary([lib('1', 'One', clash), lib('2', 'Two', clash)]).every((e) => !e.blocked));
    const after = buildLibrary([lib('1', 'One', clash, true), lib('2', 'Two', clash)]);
    assert.match(after.find((e) => e.id === '2').blocked, /already used by "One"/);
});

// Mutable notes shaped like what the frontend (getLabels) and the backend (hasLabel/setLabel/removeLabel) both see.
function storeNote(id, title, body, labels = {}) {
    const store = Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, [...v]]));
    return {
        noteId: id, title, store,
        getContent: async () => body,
        getLabels: (n) => (store[n] ?? []).map((value) => ({ value })),
        hasLabel: (n) => (store[n] ?? []).length > 0,
        setLabel: (n, v = '') => { store[n] = [v]; },
        removeLabel: (n) => { delete store[n]; },
    };
}

test('setEnabled switches a library macro on, makes it usable at once, and off again, keeping its note intact', async () => {
    const note = storeNote('lib1', 'Greeter', '<p>Hello</p>', { ikmalMacroLibrary: [''], macroGroup: ['Writing'], macroAbbrev: ['hi'], macroSummary: ['Says hello'] });
    const { dom } = await launcherWithMacros([], { store: [note] });
    const rt = dom.window.__ikmalMacros;

    assert.deepEqual(JSON.parse(JSON.stringify((await rt.library()).map((e) => [e.name, e.enabled]))), [['Greeter', false]]); // JSON: arrays built in the jsdom realm
    assert.equal(await rt.setEnabled('lib1', true), null);
    assert.ok(note.hasLabel('ikmalMacro'));
    assert.equal((await rt.library())[0].enabled, true);

    assert.equal(await rt.setEnabled('lib1', true), null, 'enabling twice is harmless');
    assert.deepEqual(note.store.ikmalMacro, ['']);

    assert.equal(await rt.setEnabled('lib1', false), null);
    assert.ok(!note.hasLabel('ikmalMacro'));
    assert.equal(await rt.setEnabled('lib1', false), null, 'disabling twice is harmless');
    assert.deepEqual([note.store.macroAbbrev, note.store.macroGroup, note.store.macroSummary, note.store.ikmalMacroLibrary], [['hi'], ['Writing'], ['Says hello'], ['']]);
    assert.equal(await note.getContent(), '<p>Hello</p>');
});

test('an enabled library macro runs through its abbreviation, and stops once disabled', async () => {
    const note = storeNote('lib1', 'Greeter', '<p>Hello</p>', { ikmalMacroLibrary: [''], macroAbbrev: ['hi'] });
    const { dom } = await launcherWithMacros([], { store: [note] });
    const rt = dom.window.__ikmalMacros;
    const tab = async () => {
        const editor = fakeEditor('hi');
        const el = dom.window.document.createElement('div');
        el.ckeditorInstance = editor;
        dom.window.document.body.append(el);
        el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        await tick();
        return editor.log.inserted;
    };
    assert.deepEqual(await tab(), [], 'not enabled yet');
    await rt.setEnabled('lib1', true);
    assert.deepEqual(await tab(), ['<p>Hello</p>']);
    await rt.setEnabled('lib1', false);
    assert.deepEqual(await tab(), [], 'disabled again');
});

test('setEnabled refuses a blocked entry without touching the note, and says why', async () => {
    const taken = storeNote('on', 'Already on', '<p>a</p>', { ikmalMacro: [''], ikmalMacroLibrary: [''], macroAbbrev: ['hi'] });
    const clash = storeNote('lib1', 'Greeter', '<p>b</p>', { ikmalMacroLibrary: [''], macroAbbrev: ['hi'] });
    const { dom } = await launcherWithMacros([], { store: [taken, clash] });
    const message = await dom.window.__ikmalMacros.setEnabled('lib1', true);
    assert.match(message, /Abbreviation "hi" is already used by "Already on"/);
    assert.ok(!clash.hasLabel('ikmalMacro'));
});

test('setEnabled only touches library notes', async () => {
    const plain = storeNote('p', 'Plain macro', '<p>x</p>', { ikmalMacro: [''] });
    const { dom } = await launcherWithMacros([], { store: [plain] });
    const rt = dom.window.__ikmalMacros;
    assert.match(await rt.setEnabled('p', false), /Only library macros/);
    assert.ok(plain.hasLabel('ikmalMacro'), 'a hand-made macro is never switched off by this');
    assert.match(await rt.setEnabled('ghost', true), /no longer exists|none/i);
});

test('setEnabled reports a backend failure instead of throwing', async () => {
    const note = storeNote('lib1', 'Greeter', '<p>x</p>', { ikmalMacroLibrary: [''] });
    const { dom } = await launcherWithMacros([], { store: [note], backendDisabled: false });
    dom.window.api.runOnBackend = () => { throw new Error('Backend script execution is disabled.'); };
    assert.match(await dom.window.__ikmalMacros.setEnabled('lib1', true), /Could not enable the macro: Backend script execution is disabled/);
});

test('filterLibrary matches name, group, summary and triggers, case-insensitively', () => {
    const entries = buildLibrary([
        lib('1', 'Signature', { macroGroup: ['Writing'], macroAbbrev: ['sig'], macroSummary: ['Sign off'] }),
        lib('2', 'Table', { macroGroup: ['Editor'], macroHotkey: ['alt+shift+t'] }),
    ]);
    const names = (q) => filterLibrary(entries, q).map((e) => e.name);
    assert.deepEqual(names(''), ['Table', 'Signature']);
    assert.deepEqual(names('SIGN'), ['Signature']);
    assert.deepEqual(names('editor'), ['Table']);
    assert.deepEqual(names('alt+shift'), ['Table']);
    assert.deepEqual(names('nothing'), []);
});

// ---- library screen ----

async function openLibraryScreen(notes, opts = {}) {
    const { dom } = await launcherWithMacros([], { store: notes, ...opts });
    await dom.window.__ikmalMacros.openLibrary();
    const doc = dom.window.document;
    return {
        dom, doc,
        rows: () => [...doc.querySelectorAll('.ns-lib-row')],
        names: () => [...doc.querySelectorAll('.ns-lib-row label')].map((l) => l.textContent),
        box: (name) => [...doc.querySelectorAll('.ns-lib-row')].find((r) => r.querySelector('label').textContent === name).querySelector('input'),
        toggle: async (name) => { const b = [...doc.querySelectorAll('.ns-lib-row')].find((r) => r.querySelector('label').textContent === name).querySelector('input'); b.click(); await tick(); await tick(); },
    };
}

const libNote = (id, title, labels = {}, body = '<p>x</p>') => storeNote(id, title, body, { ikmalMacroLibrary: [''], ...labels });

test('library screen: lists entries by group with summary and trigger chips', async () => {
    const ui = await openLibraryScreen([
        libNote('1', 'Signature', { macroGroup: ['Writing'], macroAbbrev: ['sig'], macroSummary: ['Sign off'] }),
        libNote('2', 'Table', { macroGroup: ['Editor'], macroHotkey: ['alt+shift+t'], macroButton: ['table'] }),
    ]);
    assert.deepEqual([...ui.doc.querySelectorAll('.ns-lib-group')].map((h) => h.textContent), ['Editor', 'Writing']);
    assert.deepEqual(ui.names(), ['Table', 'Signature']);
    const text = ui.doc.querySelector('#ikmal-library-list').textContent;
    assert.match(text, /Sign off/);
    assert.ok(ui.doc.querySelector('.ns-lib-row code').textContent === 'sig' || ui.doc.querySelector('.ns-lib-row').textContent.includes('alt+shift+t'));
    assert.ok(ui.doc.querySelector('.ns-lib-row .bx-table'), 'button icon chip');
    assert.ok([...ui.doc.querySelectorAll('input[role=switch]')].every((b) => !b.checked));
});

test('library screen: flipping a switch enables the macro, and flipping it back disables it', async () => {
    const note = libNote('1', 'Greeter', { macroAbbrev: ['hi'] });
    const ui = await openLibraryScreen([note]);
    await ui.toggle('Greeter');
    assert.ok(note.hasLabel('ikmalMacro'));
    assert.equal(ui.box('Greeter').checked, true);
    await ui.toggle('Greeter');
    assert.ok(!note.hasLabel('ikmalMacro'));
    assert.equal(ui.box('Greeter').checked, false);
});

test('library screen: a blocked entry is disabled and says why; enabling the other one blocks it live', async () => {
    const one = libNote('1', 'One', { macroAbbrev: ['hi'] });
    const two = libNote('2', 'Two', { macroAbbrev: ['hi'] });
    const ui = await openLibraryScreen([one, two]);
    assert.equal(ui.box('Two').disabled, false);
    await ui.toggle('One');
    assert.equal(ui.box('Two').disabled, true, 'Two is blocked as soon as One is on');
    assert.match(ui.doc.querySelector('#ikmal-library-list').textContent, /Abbreviation "hi" is already used by "One"/);
    assert.ok(!two.hasLabel('ikmalMacro'));
    await ui.toggle('One'); // switch One off again
    assert.equal(ui.box('Two').disabled, false, 'and unblocked again');
});

test('library screen: a failed switch flips back and shows the error in that row', async () => {
    const note = libNote('1', 'Greeter');
    const ui = await openLibraryScreen([note]);
    ui.dom.window.api.runOnBackend = () => { throw new Error('Backend script execution is disabled.'); };
    await ui.toggle('Greeter');
    assert.equal(ui.box('Greeter').checked, false);
    assert.equal(ui.box('Greeter').disabled, false, 'can be tried again');
    const error = ui.doc.querySelector('.ns-lib-error');
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /Could not enable the macro: Backend script execution is disabled/);
});

test('library screen: search filters live, and names are escaped', async () => {
    const ui = await openLibraryScreen([
        libNote('1', 'Signature', { macroGroup: ['Writing'] }),
        libNote('2', '<img src=x onerror=alert(1)>', { macroGroup: ['Editor'], macroSummary: ['<b>bold</b>'] }),
    ]);
    assert.equal(ui.doc.querySelector('.ns-lib-list img'), null, 'no injected element');
    assert.equal(ui.doc.querySelector('.ns-lib-list b'), null);
    const search = ui.doc.querySelector('#ikmal-library-search');
    search.value = 'sign';
    search.dispatchEvent(new ui.dom.window.Event('input', { bubbles: true }));
    assert.deepEqual(ui.names(), ['Signature']);
    search.value = 'zzz';
    search.dispatchEvent(new ui.dom.window.Event('input', { bubbles: true }));
    assert.match(ui.doc.querySelector('#ikmal-library-list').textContent, /Nothing matches/);
});

test('library screen: an empty library says so, and the palette links to the library', async () => {
    const ui = await openLibraryScreen([]);
    assert.match(ui.doc.querySelector('#ikmal-library-list').textContent, /The library is empty/);
    ui.doc.querySelector('.ns-confirm').click();
    assert.equal(ui.doc.querySelector('.ns-modal'), null, 'Done closes it');

    const note = libNote('1', 'Greeter');
    const { dom } = await launcherWithMacros([], { store: [note] });
    await dom.window.__ikmalMacros.openPalette();
    dom.window.document.querySelector('#ikmal-macro-library-link').click();
    await tick(); await tick();
    assert.ok(dom.window.document.querySelector('#ikmal-library-list'), 'the library opened from the palette');
    assert.equal(dom.window.document.querySelector('#ikmal-macro-list'), null, 'and the palette closed');
});
