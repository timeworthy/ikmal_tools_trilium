/** Small authenticated API adapter for the Playwright browser context.
 *
 * Trilium's frontend session owns the CSRF token. Keeping requests inside
 * page.evaluate means the runner uses the same authenticated session as the
 * UI and never needs an ETAPI token or a second database connection.
 */
export class TriliumBrowserApi {
    constructor(page) {
        this.page = page;
    }

    async request(path, { method = 'GET', body } = {}) {
        const result = await this.page.evaluate(async ({ path, method, body }) => {
            const glob = window.glob;
            if (!glob?.csrfToken) throw new Error('Trilium session is not authenticated.');
            const headers = {
                'x-csrf-token': glob.csrfToken,
                'trilium-component-id': glob.componentId || '',
            };
            if (body !== undefined) headers['content-type'] = 'application/json';
            const response = await fetch(path, {
                method,
                credentials: 'same-origin',
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            const text = await response.text();
            let parsed = null;
            try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
            return { status: response.status, ok: response.ok, body: parsed };
        }, { path, method, body });
        if (!result.ok) {
            throw new Error(`${method} ${path} failed with HTTP ${result.status}: ${JSON.stringify(result.body)}`);
        }
        return result.body;
    }

    async search(query) {
        const result = await this.request(`api/quick-search/${encodeURIComponent(query)}`);
        const ids = result?.searchResultNoteIds || [];
        const summaries = result?.searchResults || [];
        return ids.map((noteId, index) => ({ noteId, ...(summaries[index] || {}) }));
    }

    async findArtifact(artifact) {
        const candidates = await this.search(`#packageArtifact="${artifact}"`);
        const notes = await Promise.all(candidates.map(({ noteId }) => this.getNote(noteId)));
        return notes.find((note) => note?.type === 'render') || notes[0] || null;
    }

    async getNote(noteId) {
        return this.request(`api/notes/${encodeURIComponent(noteId)}`);
    }

    async createNote(parentNoteId, { title, content = '', type = 'text', attributes = [] }) {
        return this.request(`api/notes/${encodeURIComponent(parentNoteId)}/children?target=into`, {
            method: 'POST',
            body: {
                title,
                content,
                type,
                attributes: attributes.map((attribute) => ({ isInheritable: false, ...attribute })),
            },
        });
    }

    async setAttribute(noteId, type, name, value) {
        return this.request(`api/notes/${encodeURIComponent(noteId)}/set-attribute`, {
            method: 'PUT',
            body: { type, name, value, isInheritable: false },
        });
    }

    async toggleInParent(noteId, parentNoteId, present) {
        return this.request(`api/notes/${encodeURIComponent(noteId)}/toggle-in-parent/${encodeURIComponent(parentNoteId)}/${present}`, {
            method: 'PUT',
            body: {},
        });
    }

    async deleteNote(noteId, taskId) {
        return this.request(`api/notes/${encodeURIComponent(noteId)}?taskId=${encodeURIComponent(taskId)}&last=true&eraseNotes=true`, {
            method: 'DELETE',
        });
    }

    async openNote(noteId) {
        await this.page.evaluate(async (id) => {
            const note = await window.glob.froca.getNote(id);
            if (!note) throw new Error(`Note ${id} is not available in the frontend cache.`);
            const path = note.getBestNotePathString();
            await window.glob.appContext.tabManager.openContextWithNote(path, { activate: true });
        }, noteId);
        await this.page.waitForTimeout(500);
    }
}
