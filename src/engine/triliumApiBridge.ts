/**
 * Unified Trilium API Bridge
 *
 * Single source of truth for all note, branch, and attribute operations.
 * Handles native in-process backend execution when `api.runOnBackend` is
 * available, with a resilient REST fallback (handling CSRF token refresh)
 * when executing in standard browser/frontend contexts.
 */

// Trilium injects `api` as a scoped variable into backend script execution; it is
// not a property of `globalThis` there. Closures passed to `runOnBackend` are
// serialised to source and re-parsed on the backend, so they must reference this
// bare identifier rather than capturing anything from the frontend scope.
declare const api: any;

export interface TriliumApiBridgeHeaders {
    'x-csrf-token': string;
    'trilium-component-id': string;
    'content-type': string;
}

export class TriliumApiBridge {
    private static getGlob(): any {
        return (globalThis as any).glob || (typeof window !== 'undefined' ? (window as any).glob : null);
    }

    private static getFrontendApi(): any {
        return (globalThis as any).api || (typeof window !== 'undefined' ? (window as any).api : null);
    }

    private static async authenticatedFetch(pathRelative: string, options: RequestInit = {}): Promise<Response> {
        const glob = this.getGlob();
        if (!glob) {
            throw new Error('Trilium session context is unavailable.');
        }

        const headers: Record<string, string> = {
            'x-csrf-token': glob.csrfToken || '',
            'trilium-component-id': glob.componentId || '',
            'content-type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        const fetchFn = (globalThis as any).fetch || (typeof window !== 'undefined' ? window.fetch : null);
        if (!fetchFn) {
            throw new Error('Global fetch API is unavailable.');
        }

        const fullPath = `${glob.baseApiUrl}${pathRelative}`;
        const send = () => fetchFn(fullPath, {
            credentials: 'same-origin',
            ...options,
            headers: { ...headers },
        });

        let response = await send();

        // If 403 Forbidden, attempt CSRF token refresh via /bootstrap
        if (response.status === 403) {
            const locSearch = (globalThis as any).location?.search || (typeof window !== 'undefined' ? window.location?.search : '') || '';
            const bootstrapUrl = `./bootstrap${locSearch}`;
            const bootstrapResp = await fetchFn(bootstrapUrl, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
            if (bootstrapResp && bootstrapResp.ok) {
                const refreshed = await bootstrapResp.json().catch(() => null);
                if (refreshed?.csrfToken) {
                    glob.csrfToken = refreshed.csrfToken;
                    headers['x-csrf-token'] = refreshed.csrfToken;
                    response = await send();
                }
            }
        }

        return response;
    }

    /**
     * Ensures a child note is attached/cloned under a parent note.
     */
    static async ensureNotePresentInParent(childNoteId: string, parentNoteId: string): Promise<void> {
        if (!childNoteId || !parentNoteId) return;

        const frontendApi = this.getFrontendApi();
        if (frontendApi && typeof frontendApi.runOnBackend === 'function') {
            try {
                const applied = await frontendApi.runOnBackend((cId: string, pId: string) => {
                    if (typeof api === 'undefined' || typeof api.ensureNoteIsPresentInParent !== 'function') {
                        return false;
                    }
                    api.ensureNoteIsPresentInParent(cId, pId, '');
                    return true;
                }, [childNoteId, parentNoteId]);
                if (applied) return;
            } catch (err) {
                // If runOnBackend throws, fall through to REST bridge
            }
        }

        const response = await this.authenticatedFetch(`notes/${childNoteId}/toggle-in-parent/${parentNoteId}/true`, {
            method: 'PUT',
            body: JSON.stringify({}),
        });

        if (!response.ok) {
            throw new Error(`Failed to clone note ${childNoteId} under ${parentNoteId} (HTTP ${response.status})`);
        }
    }

    /**
     * Ensures a child note is removed/unlinked from a parent note.
     */
    static async ensureNoteAbsentFromParent(childNoteId: string, parentNoteId: string): Promise<void> {
        if (!childNoteId || !parentNoteId) return;

        const frontendApi = this.getFrontendApi();
        if (frontendApi && typeof frontendApi.runOnBackend === 'function') {
            try {
                const applied = await frontendApi.runOnBackend((cId: string, pId: string) => {
                    if (typeof api === 'undefined' || typeof api.ensureNoteIsAbsentFromParent !== 'function') {
                        return false;
                    }
                    api.ensureNoteIsAbsentFromParent(cId, pId);
                    return true;
                }, [childNoteId, parentNoteId]);
                if (applied) return;
            } catch (err) {
                // Fall through to REST bridge
            }
        }

        const response = await this.authenticatedFetch(`notes/${childNoteId}/toggle-in-parent/${parentNoteId}/false`, {
            method: 'PUT',
            body: JSON.stringify({}),
        });

        if (!response.ok && response.status !== 404) {
            throw new Error(`Failed to remove note ${childNoteId} from ${parentNoteId} (HTTP ${response.status})`);
        }
    }

    /**
     * Sets or updates a note attribute (label or relation).
     */
    static async setNoteAttribute(
        noteId: string,
        type: 'label' | 'relation',
        name: string,
        value?: string,
        targetNoteId?: string
    ): Promise<void> {
        if (!noteId || !name) return;

        const frontendApi = this.getFrontendApi();
        if (frontendApi && typeof frontendApi.runOnBackend === 'function') {
            try {
                const applied = await frontendApi.runOnBackend(
                    (nId: string, aType: string, aName: string, aVal: string, tId: string) => {
                        if (typeof api === 'undefined') return false;
                        const note = api.getNote?.(nId);
                        if (!note) return false;
                        if (aType === 'label') {
                            note.setLabel(aName, aVal || '');
                            return true;
                        }
                        if (aType === 'relation' && tId) {
                            note.setRelation(aName, tId);
                            return true;
                        }
                        return false;
                    },
                    [noteId, type, name, value || '', targetNoteId || '']
                );
                if (applied) return;
            } catch (err) {
                // Fall through to REST bridge
            }
        }

        const payload: Record<string, any> = { type, name, isInheritable: false };
        if (type === 'label') payload.value = value || '';
        if (type === 'relation') payload.value = targetNoteId || value || '';

        const response = await this.authenticatedFetch(`notes/${noteId}/set-attribute`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Failed to set attribute '${name}' on note ${noteId} (HTTP ${response.status})`);
        }
    }

    /**
     * Sets a note title.
     */
    static async setNoteTitle(noteId: string, title: string): Promise<void> {
        if (!noteId) return;

        const frontendApi = this.getFrontendApi();
        if (frontendApi && typeof frontendApi.runOnBackend === 'function') {
            try {
                const applied = await frontendApi.runOnBackend((nId: string, newTitle: string) => {
                    if (typeof api === 'undefined') return false;
                    const note = api.getNote?.(nId);
                    if (!note) return false;
                    note.title = newTitle;
                    // BNote only persists on an explicit save().
                    note.save();
                    return true;
                }, [noteId, title]);
                if (applied) return;
            } catch (err) {
                // Fall through
            }
        }

        const response = await this.authenticatedFetch(`notes/${noteId}/title`, {
            method: 'PUT',
            body: JSON.stringify({ title }),
        });

        if (!response.ok) {
            throw new Error(`Failed to set title on note ${noteId} (HTTP ${response.status})`);
        }
    }
}
