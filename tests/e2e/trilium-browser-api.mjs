/** Small authenticated API adapter for the Playwright browser context.
 *
 * Trilium's frontend session owns the CSRF token. Keeping requests inside
 * page.evaluate means the runner uses the same authenticated session as the
 * UI and never needs an ETAPI token or a second database connection.
 */
export class TriliumBrowserApi {
    constructor(page) {
        this.page = page;
        this.requestLog = [];
        this._requestListener = (request) => {
            const url = new URL(request.url());
            const pageUrl = page.url();
            if (pageUrl && url.origin !== new URL(pageUrl).origin) return;
            let postData = null;
            try { postData = request.postDataJSON(); } catch { postData = request.postData(); }
            this.requestLog.push({ method: request.method(), url: request.url(), postData });
        };
        page.on('request', this._requestListener);
    }

    clearRequestLog() { this.requestLog.length = 0; }

    requestsMatching(pattern) {
        const matcher = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        return this.requestLog.filter((request) => matcher.test(request.url));
    }

    async request(path, { method = 'GET', body } = {}) {
        // The shell can finish navigation before the session bootstrap has
        // published its CSRF token. Wait for that application-owned signal so
        // setup/read assertions do not race a real page load.
        await this.page.waitForFunction(() => Boolean(window.glob?.csrfToken), null, {
            timeout: 12_000,
        });
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

    async search(query, { includeArchived = false } = {}) {
        const suffix = includeArchived ? '?includeArchivedNotes=true' : '';
        const result = await this.request(`api/quick-search/${encodeURIComponent(query)}${suffix}`);
        const ids = result?.searchResultNoteIds || [];
        const summaries = result?.searchResults || [];
        return ids.map((noteId, index) => {
            const summary = summaries[index] || {};
            return {
                noteId,
                ...summary,
                // The quick-search endpoint calls this noteTitle; expose the
                // same field name returned by api/notes/:noteId so black-box
                // assertions can use one observable note shape.
                title: summary.noteTitle ?? summary.title,
            };
        });
    }

    async findArtifact(artifact) {
        const candidates = await this.search(`#packageArtifact="${artifact}"`);
        const notes = await Promise.all(candidates.map(({ noteId }) => this.getNote(noteId)));
        // A package can have historical/erased records with the same artifact
        // label after upgrades. Quick-search preserves the database's newest
        // matching order, so use the last live render rather than an old copy.
        const renders = notes.filter((note) => note?.type === 'render');
        return renders[renders.length - 1] || notes[notes.length - 1] || null;
    }

    async getNote(noteId) {
        return this.request(`api/notes/${encodeURIComponent(noteId)}`);
    }

    /** Read state from the authenticated frontend, including content and branches. */
    async getNoteState(noteId) {
        const liveState = await this.page.evaluate(async (id) => {
            const note = await window.glob?.froca?.getNote(id);
            if (!note) return null;
            const owned = typeof note.getOwnedAttributes === 'function'
                ? await Promise.resolve(note.getOwnedAttributes())
                : (note.attributes || []);
            const labels = (owned || [])
                .filter((attribute) => attribute.type === 'label')
                .map((attribute) => ({ name: attribute.name, value: attribute.value ?? '' }));
            const relations = (owned || [])
                .filter((attribute) => attribute.type === 'relation')
                .map((attribute) => ({ name: attribute.name, value: attribute.value ?? attribute.targetNoteId ?? '' }));
            const parentNoteIds = typeof note.getParentNoteIds === 'function'
                ? await Promise.resolve(note.getParentNoteIds())
                : (note.parentNoteIds || []);
            const children = typeof note.getChildNotes === 'function'
                ? await Promise.resolve(note.getChildNotes())
                : [];
            return {
                noteId: note.noteId,
                title: note.title,
                type: note.type,
                dateCreated: note.dateCreated,
                dateModified: note.dateModified,
                content: typeof note.getContent === 'function' ? await note.getContent() : (note.content || ''),
                labels,
                relations,
                parentNoteIds: parentNoteIds || [],
                childNoteIds: (children || []).map((child) => child.noteId),
            };
        }, noteId);
        // Direct persistence writes intentionally do not mutate Trilium's
        // in-memory note object. Merge the authenticated REST representation so
        // assertions observe the server's final labels immediately as well as
        // frontend-only content/branch methods.
        const raw = await this.getNote(noteId).catch(() => null);
        if (!liveState && !raw) return null;
        const rawAttributes = raw?.attributes || [];
        const rawLabels = rawAttributes
            .filter((attribute) => attribute.type === 'label')
            .map((attribute) => ({ name: attribute.name, value: attribute.value ?? '' }));
        const rawRelations = rawAttributes
            .filter((attribute) => attribute.type === 'relation')
            .map((attribute) => ({ name: attribute.name, value: attribute.value ?? attribute.targetNoteId ?? '' }));
        const mergeAttributes = (primary, secondary) => {
            const values = new Map((primary || []).map((attribute) => [attribute.name, attribute]));
            for (const attribute of secondary || []) values.set(attribute.name, attribute);
            return [...values.values()];
        };
        return {
            ...raw,
            ...liveState,
            noteId: liveState?.noteId || raw?.noteId || noteId,
            title: liveState?.title || raw?.title,
            type: liveState?.type || raw?.type,
            dateCreated: raw?.dateCreated || liveState?.dateCreated,
            dateModified: raw?.dateModified || liveState?.dateModified,
            content: liveState?.content ?? raw?.content ?? '',
            labels: mergeAttributes(liveState?.labels, rawLabels),
            relations: mergeAttributes(liveState?.relations, rawRelations),
            parentNoteIds: [...new Set([...(liveState?.parentNoteIds || []), ...(raw?.parentNoteIds || [])])],
            childNoteIds: liveState?.childNoteIds || [],
        };
    }

    async waitForNote(query, { timeout = 10_000, includeArchived = false } = {}) {
        const deadline = Date.now() + timeout;
        do {
            const matches = await this.search(query, { includeArchived });
            if (matches.length) return matches[0];
            await this.page.waitForTimeout(200);
        } while (Date.now() < deadline);
        return null;
    }

    async createNote(parentNoteId, { title, content = '', type = 'text', attributes = [], activate }) {
        return this.request(`api/notes/${encodeURIComponent(parentNoteId)}/children?target=into`, {
            method: 'POST',
            body: {
                title,
                content,
                type,
                attributes: attributes.map((attribute) => ({ isInheritable: false, ...attribute })),
                ...(activate === undefined ? {} : { activate }),
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
        // Trilium can render the shell and set document.title before the
        // frontend cache is exposed on window.glob. Wait for the same
        // application-owned API that a real tab open uses instead of making
        // a timing assumption based on the shell.
        await this.page.waitForFunction(() => Boolean(
            window.glob?.froca?.getNote && window.glob?.appContext?.tabManager?.openInSameTab
        ), null, {
            timeout: 12_000,
        });
        await this.page.evaluate(async (id) => {
            const note = await window.glob.froca.getNote(id);
            if (!note) throw new Error(`Note ${id} is not available in the frontend cache.`);
            // Use the same note-id entry point used by Trilium's own links.
            // It avoids depending on path resolution while the tab manager is
            // still restoring its initial context.
            await window.glob.appContext.tabManager.openInSameTab(id);
        }, noteId);
        await this.page.waitForTimeout(500);
    }

    async reloadNotes(noteIds) {
        await this.page.evaluate(async (ids) => {
            await window.glob?.froca?.reloadNotes(ids);
        }, noteIds);
    }
}
