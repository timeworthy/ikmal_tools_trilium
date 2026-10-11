import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseHotkey, matchesHotkey, buildMacro, buildRegistry, findByHotkey, searchMacros, runMacro, renderHtml,
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

async function launcherWithMacros(macroNotes, { editor: editorOverride, onCommand = () => {} } = {}) {
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
    dom.window.api = {
        currentNote: { noteId: 's', hasLabel: () => false },
        showError: (m) => errors.push(m),
        showMessage() {},
        runOnBackend(fn, args) { return fn(...args); },
        getNoteWithLabel: () => null,
        getNote() { throw new Error('none'); },
        getBranch: () => null,
        setBranchPosition() {}, refreshNoteOrdering() {},
        createOrUpdateLauncher: () => ({ note: { setRelation() {}, setLabel() {}, setContent() {}, save() {}, labels: {} } }),
        searchForNotes: async (q) => (q === '#ikmalMacro' ? macroNotes : []),
        getActiveContextTextEditor: async () => editor,
    };
    dom.window.eval(`window.glob = {}; ${launcherBundle}`);
    await dom.window.__ikmalMacros.refresh();
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
    const log = { removed: [], inserted: [] };
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
            document: { getRoot: () => ({}), selection: { isCollapsed: collapsed, getFirstPosition: () => position } },
            insertContent: (m) => log.inserted.push(m.model),
            change: (cb) => cb({ createRange: (a, b) => [a.offset, b.offset], remove: (r) => log.removed.push(r) }),
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
        assert.deepEqual(editor.log, { removed: [], inserted: [] }, text);
    }
});

test('Tab leaves a range selection, other keys, and shift+Tab alone', async () => {
    assert.ok(!(await tabIn(fakeEditor('ians', { collapsed: false }))).defaultPrevented);
    assert.ok(!(await tabIn(fakeEditor('ians'), { key: ' ' })).defaultPrevented);
    assert.ok(!(await tabIn(fakeEditor('ians'), { init: { shiftKey: true } })).defaultPrevented);
});
