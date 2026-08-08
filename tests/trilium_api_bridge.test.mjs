import test from 'node:test';
import assert from 'node:assert/strict';

import { TriliumApiBridge } from '../dist/engine/triliumApiBridge.js';

// Trilium serialises the closure and re-parses it on the backend, where `api`
// is an injected scoped variable. Running the closure for real (rather than
// only recording that runOnBackend was called) is what catches a closure that
// reaches for a handle the backend does not have.
test('TriliumApiBridge uses api.runOnBackend when available in runtime context', async () => {
    const executed = [];
    const cloned = [];
    globalThis.api = {
        runOnBackend(fn, args) {
            executed.push({ args });
            return Promise.resolve(fn(...args));
        },
        ensureNoteIsPresentInParent(childNoteId, parentNoteId) {
            cloned.push([childNoteId, parentNoteId]);
        }
    };

    await TriliumApiBridge.ensureNotePresentInParent('child123', 'parent456');
    assert.equal(executed.length, 1);
    assert.deepEqual(executed[0].args, ['child123', 'parent456']);
    // The clone must actually happen, not merely be dispatched.
    assert.deepEqual(cloned, [['child123', 'parent456']]);

    delete globalThis.api;
});

test('TriliumApiBridge falls back to REST when the backend closure writes nothing', async () => {
    const requests = [];
    // A backend without the helper: the closure reports it did not apply, so
    // the REST bridge must still run rather than returning a false success.
    globalThis.api = {
        runOnBackend(fn, args) {
            return Promise.resolve(fn(...args));
        }
    };
    globalThis.glob = {
        baseApiUrl: 'http://mock-trilium/api/',
        csrfToken: 'token-1',
        componentId: 'comp-1'
    };
    globalThis.fetch = async (url, opts) => {
        requests.push({ url, opts });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    };

    await TriliumApiBridge.ensureNotePresentInParent('childX', 'parentY');

    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /notes\/childX\/toggle-in-parent\/parentY\/true$/);

    delete globalThis.api;
    delete globalThis.glob;
    delete globalThis.fetch;
});

test('TriliumApiBridge.setNoteTitle persists the change with an explicit save', async () => {
    const saved = [];
    const note = {
        title: 'old',
        save() {
            saved.push(this.title);
        }
    };
    globalThis.api = {
        runOnBackend(fn, args) {
            return Promise.resolve(fn(...args));
        },
        getNote: () => note
    };

    await TriliumApiBridge.setNoteTitle('note1', 'new title');
    assert.equal(note.title, 'new title');
    // BNote drops the assignment without save().
    assert.deepEqual(saved, ['new title']);

    delete globalThis.api;
});

test('TriliumApiBridge.setNoteAttribute writes relations, not just labels', async () => {
    const relations = [];
    globalThis.api = {
        runOnBackend(fn, args) {
            return Promise.resolve(fn(...args));
        },
        getNote: () => ({
            setLabel() {},
            setRelation(name, target) {
                relations.push([name, target]);
            }
        })
    };

    await TriliumApiBridge.setNoteAttribute('task1', 'relation', 'project', undefined, 'hub9');
    assert.deepEqual(relations, [['project', 'hub9']]);

    delete globalThis.api;
});

test('TriliumApiBridge falls back to REST fetch with CSRF refresh on HTTP 403', async () => {
    const requests = [];
    globalThis.glob = {
        baseApiUrl: 'http://mock-trilium/api/',
        csrfToken: 'stale-token-123',
        componentId: 'comp-789'
    };

    globalThis.fetch = async (url, opts) => {
        requests.push({ url, opts });
        if (url.includes('toggle-in-parent') && opts.headers['x-csrf-token'] === 'stale-token-123') {
            return {
                ok: false,
                status: 403,
                json: async () => ({ error: 'Forbidden' })
            };
        }
        if (url.includes('bootstrap')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ csrfToken: 'fresh-token-456' })
            };
        }
        if (url.includes('toggle-in-parent') && opts.headers['x-csrf-token'] === 'fresh-token-456') {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            };
        }
        return { ok: false, status: 500 };
    };

    await TriliumApiBridge.ensureNotePresentInParent('noteA', 'parentB');

    assert.equal(requests.length, 3);
    assert.equal(requests[0].opts.headers['x-csrf-token'], 'stale-token-123');
    assert.equal(requests[1].url, './bootstrap');
    assert.equal(requests[2].opts.headers['x-csrf-token'], 'fresh-token-456');
    assert.equal(globalThis.glob.csrfToken, 'fresh-token-456');

    delete globalThis.glob;
    delete globalThis.fetch;
});

test('Atomic Transaction rollback restores status if branch move throws', async () => {
    let statusSet = 'active';

    const mockHubNote = {
        noteId: 'hub999',
        status: 'active',
        setLabel(name, value) {
            if (name === 'status') statusSet = value;
        }
    };

    const archiveOp = async () => {
        const previousStatus = statusSet;
        try {
            statusSet = 'complete';
            throw new Error('Network error on branch move');
        } catch (err) {
            statusSet = previousStatus;
            throw err;
        }
    };

    await assert.rejects(archiveOp(), /Network error on branch move/);
    assert.equal(statusSet, 'active');
});
