/**
 * Turns a NoteCreationPlan (see noteCreationEngine.ts) into a real note in
 * Trilium's note tree: creates it under its root container with its computed
 * labels/relations, clones it under every auto-clone target and today's
 * journal note when the plan calls for it, and creates its child notes.
 *
 * `api.createNote` is the only piece of this exposed on the frontend script
 * API. Cloning a note to a second parent uses toggle-in-parent or
 * `api.ensureNoteIsPresentInParent` via `TriliumApiBridge`.
 */

import { NoteCreationPlan } from './noteCreationEngine.js';
import { RelationshipEngine } from './relationshipEngine.js';
import { TemplateEngine } from './templateEngine.js';

// Trilium injects `api` as a scoped variable into backend script execution; it is
// not a property of `globalThis` there. Closures passed to `runOnBackend` are
// serialised to source and re-parsed on the backend, so they must reference this
// bare identifier rather than capturing anything from the frontend scope.
declare const api: any;

interface TriliumFNote {
    noteId: string;
    title: string;
    type?: string;
    isArchived?: boolean;
    attributes?: Array<{ type?: 'label' | 'relation'; name: string; value?: string; targetNoteId?: string }>;
    getOwnedLabelValue?: (name: string) => string | undefined;
    getRelations?: (name: string) => Array<{ targetNoteId?: string; value?: string }>;
    getChildNotes?: () => Promise<TriliumFNote[]>;
}

interface CreateNoteOpts {
    title?: string;
    content?: string;
    type?: string;
    activate?: boolean;
    attributes?: Array<{ type: 'label' | 'relation'; name: string; value?: string; isInheritable?: boolean }>;
}

interface TriliumFrontendApi {
    searchForNote(searchString: string): Promise<TriliumFNote | null>;
    searchForNotes(searchString: string): Promise<TriliumFNote[]>;
    searchForNotesIncludingHidden?(searchString: string): Promise<TriliumFNote[]>;
    getNotes?(noteIds: string[], silentNotFoundError?: boolean): Promise<TriliumFNote[]>;
    getNote?(noteId: string): Promise<TriliumFNote | null>;
    createNote(parentNotePath: string, opts?: CreateNoteOpts): Promise<{ note: TriliumFNote | null }>;
    getTodayNote(): Promise<TriliumFNote | null>;
}

function triliumApi(): TriliumFrontendApi | null {
    const a = (globalThis as any).api;
    return a && typeof a.createNote === 'function' ? a : null;
}

async function fetchNoteTopics(api: TriliumFrontendApi, noteId: string): Promise<string[]> {
    try {
        if (typeof api.getNote !== 'function') return [];
        const note = await api.getNote(noteId);
        if (!note) return [];
        const topics: string[] = [];

        if (typeof note.getRelations === 'function') {
            const rels = note.getRelations('topic') || [];
            for (const rel of rels) {
                const targetId = rel.targetNoteId || rel.value;
                if (targetId) topics.push(targetId);
            }
        }

        if (Array.isArray(note.attributes)) {
            for (const attr of note.attributes) {
                if (attr.name === 'topic') {
                    const targetId = attr.targetNoteId || attr.value;
                    if (targetId && !topics.includes(targetId)) {
                        topics.push(targetId);
                    }
                }
            }
        }

        return topics;
    } catch {
        return [];
    }
}

/**
 * Merges derived topics into the plan's relationsToCreate array using RelationshipEngine.
 * Pure/isolated logic so it can be called and tested independently.
 */
export function applyDerivedTopics(
    plan: NoteCreationPlan,
    parentTopicMap: Record<string, string[]>,
    relEngine: RelationshipEngine = new RelationshipEngine(new TemplateEngine())
): void {
    if (!plan.inheritedTopicSources || plan.inheritedTopicSources.length === 0) return;

    const explicitTopicIds = plan.relationsToCreate
        .filter((r) => r.name === 'topic')
        .map((r) => r.value);

    const derivedRes = relEngine.computeDerivedTopics(explicitTopicIds, parentTopicMap);

    for (const derivedTopicId of derivedRes.derivedTopics) {
        if (!plan.relationsToCreate.some((r) => r.name === 'topic' && r.value === derivedTopicId)) {
            plan.relationsToCreate.push({ name: 'topic', value: derivedTopicId });
        }
    }
}

async function cloneNoteToParentNote(childNoteId: string, parentNoteId: string): Promise<void> {
    const frontendApi = (globalThis as any).api;
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
        } catch {}
    }

    const glob = (globalThis as any).glob;
    if (!glob) throw new Error('Not running inside Trilium.');

    const headers: Record<string, string> = {
        'x-csrf-token': glob.csrfToken,
        'trilium-component-id': glob.componentId,
        'content-type': 'application/json',
    };
    const path = `${glob.baseApiUrl}notes/${childNoteId}/toggle-in-parent/${parentNoteId}/true`;
    const send = () => (globalThis as any).fetch(path, {
        method: 'PUT',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({}),
    });

    let response = await send();
    if (response.status === 403) {
        const bootstrapUrl = `./bootstrap${(globalThis as any).location?.search ?? ''}`;
        const bootstrap = await (globalThis as any).fetch(bootstrapUrl, { credentials: 'same-origin', cache: 'no-store' });
        if (bootstrap.ok) {
            const refreshed = await bootstrap.json();
            glob.csrfToken = refreshed.csrfToken;
            headers['x-csrf-token'] = refreshed.csrfToken;
            response = await send();
        }
    }

    if (!response.ok) {
        throw new Error(`Failed to file the note under ${parentNoteId} (HTTP ${response.status})`);
    }
}

async function setNoteAttribute(
    noteId: string,
    type: 'label' | 'relation',
    name: string,
    value: string,
): Promise<void> {
    const glob = (globalThis as any).glob;
    if (!glob) throw new Error('Not running inside Trilium.');

    const headers: Record<string, string> = {
        'x-csrf-token': glob.csrfToken,
        'trilium-component-id': glob.componentId,
        'content-type': 'application/json',
    };
    const path = `${glob.baseApiUrl}notes/${noteId}/set-attribute`;
    const body = JSON.stringify({ type, name, value, isInheritable: false });
    const send = () => (globalThis as any).fetch(path, {
        method: 'PUT',
        credentials: 'same-origin',
        headers,
        body,
    });

    let response = await send();
    if (response.status === 403) {
        const bootstrapUrl = `./bootstrap${(globalThis as any).location?.search ?? ''}`;
        const bootstrap = await (globalThis as any).fetch(bootstrapUrl, {
            credentials: 'same-origin',
            cache: 'no-store',
        });
        if (bootstrap.ok) {
            const refreshed = await bootstrap.json();
            glob.csrfToken = refreshed.csrfToken;
            headers['x-csrf-token'] = refreshed.csrfToken;
            response = await send();
        }
    }
    if (!response.ok) throw new Error(`Failed to set ${name} (HTTP ${response.status})`);
}

async function searchManagedPackageNotes(api: TriliumFrontendApi): Promise<TriliumFNote[]> {
    if (typeof api.searchForNotesIncludingHidden === 'function') {
        return await api.searchForNotesIncludingHidden('#packageArtifact');
    }

    const glob = (globalThis as any).glob;
    if (!glob || typeof api.getNotes !== 'function') return [];
    const response = await (globalThis as any).fetch(
        `${glob.baseApiUrl}quick-search/${encodeURIComponent('#packageArtifact')}`,
        { credentials: 'same-origin' },
    );
    if (!response.ok) return [];
    const result = await response.json();
    return await api.getNotes(result.searchResultNoteIds || [], true);
}

async function attachProjectDashboard(noteId: string): Promise<void> {
    const api = triliumApi();
    if (!api) return;

    const dashboardNotes = await searchManagedPackageNotes(api);
    const dashboardCode = dashboardNotes.find((note) => {
        const artifact = note.getOwnedLabelValue?.('packageArtifact');
        return note.type === 'code'
            && !note.isArchived
            && note.getOwnedLabelValue?.('packageOwner') === 'iansherr/ikmal_tools_trilium'
            && ['notes-system-project-dashboard', 'notes-system-project-dashboard-script'].includes(artifact || '');
    });
    if (!dashboardCode) return;

    const project = typeof api.getNote === 'function' ? await api.getNote(noteId) : null;
    const { note: dashboard } = await api.createNote(noteId, {
        title: project?.title ? `Dashboard: ${project.title}` : 'Project Dashboard',
        type: 'render',
        activate: false,
    });
    if (!dashboard) throw new Error('Trilium did not return the project dashboard.');
    await setNoteAttribute(dashboard.noteId, 'label', 'extProjectDashboard', 'projectHub');
    await setNoteAttribute(dashboard.noteId, 'relation', 'renderNote', dashboardCode.noteId);
}

/** Pure — the part of "where does this note go" that doesn't need Trilium, so it's unit-testable. */
export function buildAttributeRows(plan: NoteCreationPlan): Array<{ type: 'label' | 'relation'; name: string; value: string }> {
    return [
        ...plan.labelsToCreate.map((l) => ({ type: 'label' as const, name: l.name, value: l.value })),
        ...plan.relationsToCreate.map((r) => ({ type: 'relation' as const, name: r.name, value: r.value })),
    ];
}

export interface MaterializeResult {
    noteId: string;
    title: string;
    /** Container noteIds the note ended up filed under, beyond its root container — auto-clone targets plus today's journal, in that order. */
    clonedUnder: string[];
    childNoteIds: string[];
}

/** Resolves where a plan's note goes: an explicit target, or a search for its root container's marker (auto-provisioning missing containers). */
async function resolveParentNoteId(api: TriliumFrontendApi, plan: NoteCreationPlan): Promise<string> {
    if (plan.targetContainerId) return plan.targetContainerId;

    let marker = plan.rootContainerMarker || (plan.templateId === 'projectHub' ? 'activeProjectRoot' : 'projectRoot');
    if (plan.templateId === 'projectHub' && marker === 'projectRoot') {
        marker = 'activeProjectRoot';
    }

    // Standalone project-scoped notes without a specific project hub target land under Unassigned
    const isProjectScopedType = ['task', 'projectTask', 'story', 'reportingNotes', 'email', 'meeting', 'meetingPrep', 'scratch'].includes(plan.templateId);
    const hasProjectHubRel = plan.relationsToCreate.some((r) => r.name === 'project');
    if (isProjectScopedType && !hasProjectHubRel && plan.templateId !== 'projectHub') {
        const unassigned = await api.searchForNote('#unassignedRoot');
        if (unassigned) {
            return unassigned.noteId;
        }
    }

    let container = await api.searchForNote(`#${marker}`);
    if (!container && marker === 'activeProjectRoot') {
        const projectRoot = await api.searchForNote('#projectRoot');
        const parentId = projectRoot ? projectRoot.noteId : 'root';
        const { note: created } = await api.createNote(parentId, {
            title: 'Active',
            type: 'book',
            activate: false,
            attributes: [
                { type: 'label', name: 'activeProjectRoot', value: '' },
                { type: 'label', name: 'iconClass', value: 'bx bx-folder-open' },
                { type: 'label', name: 'projectArea', value: 'active', isInheritable: true },
            ],
        });
        container = created;
    } else if (!container && marker === 'archiveProjectRoot') {
        const projectRoot = await api.searchForNote('#projectRoot');
        const parentId = projectRoot ? projectRoot.noteId : 'root';
        const { note: created } = await api.createNote(parentId, {
            title: 'Archive',
            type: 'book',
            activate: false,
            attributes: [
                { type: 'label', name: 'archiveProjectRoot', value: '' },
                { type: 'label', name: 'iconClass', value: 'bx bx-archive' },
                { type: 'label', name: 'projectArea', value: 'archive', isInheritable: true },
                { type: 'label', name: 'projectArchive', value: '', isInheritable: true },
            ],
        });
        container = created;
    } else if (!container && marker === 'unassignedRoot') {
        const projectRoot = await api.searchForNote('#projectRoot');
        const parentId = projectRoot ? projectRoot.noteId : 'root';
        const { note: created } = await api.createNote(parentId, {
            title: 'Unassigned',
            type: 'book',
            activate: false,
            attributes: [
                { type: 'label', name: 'unassignedRoot', value: '' },
                { type: 'label', name: 'iconClass', value: 'bx bx-inbox' },
            ],
        });
        container = created;
    }

    if (!container) {
        container = await api.searchForNote('#projectRoot') || await api.searchForNote('#root');
    }

    if (!container) {
        throw new Error(`Could not find or create a container note tagged #${marker}.`);
    }
    return container.noteId;
}

export async function materializeNoteCreation(
    plan: NoteCreationPlan,
    options?: {
        relationshipEngine?: RelationshipEngine;
        topicFetcher?: (noteId: string) => Promise<string[]>;
    }
): Promise<MaterializeResult> {
    const api = triliumApi();
    if (!api) throw new Error('Not running inside Trilium.');

    if (plan.inheritedTopicSources && plan.inheritedTopicSources.length > 0) {
        const parentTopicMap: Record<string, string[]> = {};
        for (const sourceId of plan.inheritedTopicSources) {
            parentTopicMap[sourceId] = options?.topicFetcher
                ? await options.topicFetcher(sourceId)
                : await fetchNoteTopics(api, sourceId);
        }
        const relEngine = options?.relationshipEngine ?? new RelationshipEngine(new TemplateEngine());
        applyDerivedTopics(plan, parentTopicMap, relEngine);
    }

    const parentNoteId = await resolveParentNoteId(api, plan);

    let projectHubId = plan.relationsToCreate.find(r => r.name === 'project')?.value;
    if (!projectHubId && plan.templateId === 'story' && parentNoteId) {
        try {
            const potentialHub = typeof api.getNote === 'function' ? await api.getNote(parentNoteId) : null;
            if (potentialHub && (potentialHub.getOwnedLabelValue?.('extProjectHub') !== undefined || potentialHub.getOwnedLabelValue?.('extTemplate') === 'projectHub')) {
                projectHubId = parentNoteId;
            }
        } catch {}
    }

    if (projectHubId && (plan.templateId === 'story' || plan.templateId === 'edit')) {
        try {
            const hub = typeof api.getNote === 'function' ? await api.getNote(projectHubId) : null;
            if (hub) {
                const hubStatus = hub.getOwnedLabelValue?.('status');
                if (hubStatus === 'complete' || hubStatus === 'archived') {
                    await reopenProjectNote(hub.noteId);
                }
                const children = typeof hub.getChildNotes === 'function' ? await hub.getChildNotes() : [];
                const rounds = children
                    .filter((c: any) => c.getOwnedLabelValue?.('extStoryDraft') !== undefined || c.getOwnedLabelValue?.('extTemplate') === 'story')
                    .map((c: any) => Number(c.getOwnedLabelValue?.('round')))
                    .filter((r: number) => Number.isFinite(r));
                const nextRoundNum = rounds.length ? Math.max(...rounds) + 1 : 1;

                if (!plan.labelsToCreate.some(l => l.name === 'round')) {
                    plan.labelsToCreate.push({ name: 'round', value: String(nextRoundNum) });
                }

                const hubKind = hub.getOwnedLabelValue?.('kind') || plan.mode || 'project';
                const roundLabel = hubKind === 'edit' ? 'Round' : 'Draft';
                if (!/(?:\bround\s*\d+\b|\bdraft\s*\d+\b|\bv\s*\d+\b)/i.test(plan.formattedTitle)) {
                    plan.formattedTitle = `${plan.formattedTitle} — ${roundLabel} ${nextRoundNum}`;
                }

                await setNoteAttribute(hub.noteId, 'label', 'currentRound', String(nextRoundNum));

                const clientRel = hub.getRelations?.('client')?.[0];
                const clientId = clientRel?.value || clientRel?.targetNoteId;
                if (clientId && !plan.relationsToCreate.some(r => r.name === 'client')) {
                    plan.relationsToCreate.push({ name: 'client', value: clientId });
                }
            }
        } catch (err) {
            console.warn(`[Ikmal Tools] Story round reconciliation deferred: ${err}`);
        }
    }

    let noteContent = plan.content;
    if (noteContent && noteContent.includes('__OPEN_TASKS_VIEW__')) {
        try {
            const openTasksNote = await api.searchForNote('#extView=openTasks');
            if (openTasksNote) {
                noteContent = noteContent.replace(/__OPEN_TASKS_VIEW__/g, openTasksNote.noteId);
            }
        } catch (err) {
            console.warn(`[Ikmal Tools] Open tasks saved search lookup deferred: ${err}`);
        }
    }

    const { note } = await api.createNote(parentNoteId, {
        title: plan.formattedTitle,
        content: noteContent,
        type: plan.noteType || 'text',
        activate: false,
        attributes: buildAttributeRows(plan),
    });
    if (!note) throw new Error('Trilium did not return the created note.');

    // A Project Hub is a user-facing workspace note. Attach its dashboard at creation time.
    if (plan.templateId === 'projectHub') {
        try {
            await attachProjectDashboard(note.noteId);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[Ikmal Tools] Project dashboard attachment deferred: ${message}`);
        }
    }

    const clonedUnder: string[] = [];
    for (const containerId of plan.autoCloneContainers) {
        await cloneNoteToParentNote(note.noteId, containerId);
        clonedUnder.push(containerId);
    }

    if (plan.journalClone) {
        const journalNote = await api.getTodayNote();
        if (journalNote) {
            await cloneNoteToParentNote(note.noteId, journalNote.noteId);
            clonedUnder.push(journalNote.noteId);
        }
    }

    const childNoteIds: string[] = [];
    for (const child of plan.childNotesToCreate ?? []) {
        const childAttributes: Array<{ type: 'label' | 'relation'; name: string; value?: string }> = child.labels.map((l) => ({ type: 'label' as const, name: l.name, value: l.value }));
        if (plan.templateId === 'projectHub') {
            childAttributes.push({ type: 'relation', name: 'project', value: note.noteId });
        }
        const { note: childNote } = await api.createNote(note.noteId, {
            title: child.title,
            content: child.content || '',
            activate: false,
            attributes: childAttributes,
        });
        if (childNote) {
            childNoteIds.push(childNote.noteId);
            const journalNote = await api.getTodayNote();
            if (journalNote) {
                try {
                    await cloneNoteToParentNote(childNote.noteId, journalNote.noteId);
                } catch {
                    // Non-critical journal clone
                }
            }
        }
    }

    if (['task', 'projectTask', 'story', 'edit'].includes(plan.templateId)) {
        try {
            await reconcileProjectHubStatuses();
        } catch {
            // Non-critical auto-reconciliation
        }
    }

    return { noteId: note.noteId, title: note.title, clonedUnder, childNoteIds };
}

async function removeNoteFromParentNote(childNoteId: string, parentNoteId: string): Promise<void> {
    const frontendApi = (globalThis as any).api;
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
        } catch {}
    }

    const glob = (globalThis as any).glob;
    if (!glob) return;

    const headers: Record<string, string> = {
        'x-csrf-token': glob.csrfToken,
        'trilium-component-id': glob.componentId,
        'content-type': 'application/json',
    };
    const path = `${glob.baseApiUrl}notes/${childNoteId}/toggle-in-parent/${parentNoteId}/false`;
    const send = () => (globalThis as any).fetch(path, {
        method: 'PUT',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({}),
    });

    let response = await send();
    if (response.status === 403) {
        const bootstrapUrl = `./bootstrap${(globalThis as any).location?.search ?? ''}`;
        const bootstrap = await (globalThis as any).fetch(bootstrapUrl, { credentials: 'same-origin', cache: 'no-store' });
        if (bootstrap.ok) {
            const refreshed = await bootstrap.json();
            glob.csrfToken = refreshed.csrfToken;
            headers['x-csrf-token'] = refreshed.csrfToken;
            response = await send();
        }
    }
}

/** Archives a Project Hub by setting status: complete and moving it to #archiveProjectRoot. */
export async function archiveProjectNote(hubNoteId: string): Promise<void> {
    const api = triliumApi();
    if (!api) return;
    const archiveRoot = await api.searchForNote('#archiveProjectRoot');
    const activeRoot = await api.searchForNote('#activeProjectRoot');
    const projectRoot = await api.searchForNote('#projectRoot');

    if (archiveRoot) {
        await cloneNoteToParentNote(hubNoteId, archiveRoot.noteId);
    }
    if (activeRoot) {
        try { await removeNoteFromParentNote(hubNoteId, activeRoot.noteId); } catch {}
    }
    if (projectRoot) {
        try { await removeNoteFromParentNote(hubNoteId, projectRoot.noteId); } catch {}
    }
    await setNoteAttribute(hubNoteId, 'label', 'status', 'complete');
}

/** Reopens an Archived Project Hub by setting status: active and moving it to #activeProjectRoot. */
export async function reopenProjectNote(hubNoteId: string): Promise<void> {
    const api = triliumApi();
    if (!api) return;
    const activeRoot = await api.searchForNote('#activeProjectRoot');
    const archiveRoot = await api.searchForNote('#archiveProjectRoot');
    const projectRoot = await api.searchForNote('#projectRoot');

    if (activeRoot) {
        await cloneNoteToParentNote(hubNoteId, activeRoot.noteId);
    }
    if (archiveRoot) {
        try { await removeNoteFromParentNote(hubNoteId, archiveRoot.noteId); } catch {}
    }
    if (projectRoot) {
        try { await removeNoteFromParentNote(hubNoteId, projectRoot.noteId); } catch {}
    }
    await setNoteAttribute(hubNoteId, 'label', 'status', 'active');
}

/** Reconciles project hub statuses based on child story draft round states. */
export async function reconcileProjectHubStatuses(): Promise<number> {
    const api = triliumApi();
    if (!api || typeof api.searchForNotes !== 'function') return 0;

    const hubs = await api.searchForNotes('#extTemplate=projectHub') || [];
    const legacyHubs = await api.searchForNotes('#extProjectHub') || [];
    const allHubs = [...hubs];
    for (const h of legacyHubs) {
        if (!allHubs.some((existing) => existing.noteId === h.noteId)) {
            allHubs.push(h);
        }
    }
    let updated = 0;

    for (const hub of allHubs) {
        const status = hub.getOwnedLabelValue?.('status');

        const drafts: TriliumFNote[] = [];
        if (typeof hub.getChildNotes === 'function') {
            const children = await hub.getChildNotes();
            for (const c of children) {
                if (
                    c.getOwnedLabelValue?.('extStoryDraft') !== undefined ||
                    c.getOwnedLabelValue?.('extTemplate') === 'story' ||
                    c.getOwnedLabelValue?.('extTemplate') === 'edit'
                ) {
                    drafts.push(c);
                }
            }
        }

        const relDrafts = await api.searchForNotes(`~project='${hub.noteId}' AND (#extStoryDraft OR #extTemplate=story OR #extTemplate=edit)`);
        for (const rd of relDrafts || []) {
            if (!drafts.some((d) => d.noteId === rd.noteId)) {
                drafts.push(rd);
            }
        }

        if (!drafts.length) continue;

        drafts.sort((a, b) => Number(b.getOwnedLabelValue?.('round') || 0) - Number(a.getOwnedLabelValue?.('round') || 0));
        const latestDraft = drafts[0];
        const latestStatus = (latestDraft.getOwnedLabelValue?.('status') || '').toLowerCase();
        const isLatestDone = latestStatus === 'done' || latestStatus === 'approved' || latestStatus === 'published' || Boolean(latestDraft.getOwnedLabelValue?.('doneDate'));

        if (isLatestDone && status !== 'complete') {
            await archiveProjectNote(hub.noteId);
            updated++;
        } else if (!isLatestDone && (status === 'complete' || status === 'archived')) {
            await reopenProjectNote(hub.noteId);
            updated++;
        }
    }
    return updated;
}


