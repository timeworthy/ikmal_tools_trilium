import { IfThenRuleEngine, NoteContext } from './ifThenRuleEngine.js';
import { IfThenAction } from './types.js';
import { TriliumApiBridge } from './triliumApiBridge.js';

declare const api: any;

function labelValue(note: any, name: string): string | undefined {
    const owned = note?.getOwnedLabelValue?.(name);
    if (owned !== undefined && owned !== null) return String(owned);
    return undefined;
}

function buildManualContext(note: any, templateEngine?: any): NoteContext {
    const explicitTemplate = labelValue(note, 'extTemplate');
    const markerTemplate = templateEngine?.getAllTemplates?.().find((candidate: any) => (
        labelValue(note, candidate.marker) !== undefined
    ));
    const templateId = explicitTemplate || markerTemplate?.id || '';
    const template = templateEngine?.getTemplate?.(templateId) || markerTemplate;
    const attributes: Record<string, any> = {};
    const relations: Record<string, string | string[]> = {};
    for (const attribute of note?.getOwnedAttributes?.() || []) {
        if (!attribute?.name) continue;
        if (attribute.type === 'relation') {
            const value = attribute.value || attribute.targetNoteId;
            if (value) relations[attribute.name] = String(value);
        } else {
            attributes[attribute.name] = attribute.value ?? '';
        }
    }
    // The manual path is intentionally tolerant: rules scoped by template use
    // the stored extTemplate marker, while category-scoped rules can still use
    // the note's category label when a frontend note has not hydrated its
    // template relation yet.
    return {
        noteId: note.noteId,
        title: note.title || '',
        templateId,
        category: template?.category || labelValue(note, 'category'),
        containerMarker: labelValue(note, 'rootContainerMarker'),
        attributes,
        relations,
    };
}

async function applyManualAction(note: any, action: IfThenAction, frontendApi: any): Promise<void> {
    const params = action.params || {};
    switch (action.type) {
        case 'setLabel':
            if (params.labelName) await TriliumApiBridge.setNoteAttribute(note.noteId, 'label', params.labelName, params.labelValue || '', undefined, frontendApi);
            return;
        case 'removeLabel':
            if (params.labelName) {
                await frontendApi.runOnBackend?.((noteId: string, name: string) => {
                    const target = api.getNote(noteId);
                    if (target?.getOwnedLabelValue?.(name) !== undefined) target.removeLabel(name);
                    return true;
                }, [note.noteId, params.labelName]);
            }
            return;
        case 'setRelation':
            if (params.relationName && params.targetNoteId) {
                await TriliumApiBridge.setNoteAttribute(note.noteId, 'relation', params.relationName, '', params.targetNoteId, frontendApi);
            }
            return;
        case 'setTaskStatus':
            if (params.status) await TriliumApiBridge.setNoteAttribute(note.noteId, 'label', 'status', String(params.status), undefined, frontendApi);
            return;
        case 'cloneToContainer': {
            const targets = params.relationName
                ? (note.getRelations?.(params.relationName) || []).map((relation: any) => relation.value || relation.targetNoteId).filter(Boolean)
                : [frontendApi.getNoteWithLabel?.(params.containerMarker)?.noteId];
            for (const targetId of targets) {
                if (targetId) await TriliumApiBridge.ensureNotePresentInParent(note.noteId, String(targetId), frontendApi);
            }
            return;
        }
        case 'archiveNote': {
            const archive = frontendApi.getNoteWithLabel?.(params.containerMarker || 'archiveProjectRoot');
            const active = frontendApi.getNoteWithLabel?.('activeProjectRoot');
            const project = frontendApi.getNoteWithLabel?.('projectRoot');
            if (archive) await TriliumApiBridge.ensureNotePresentInParent(note.noteId, archive.noteId, frontendApi);
            if (active) await TriliumApiBridge.ensureNoteAbsentFromParent(note.noteId, active.noteId, frontendApi);
            if (project) await TriliumApiBridge.ensureNoteAbsentFromParent(note.noteId, project.noteId, frontendApi);
            await TriliumApiBridge.setNoteAttribute(note.noteId, 'label', 'status', 'complete', undefined, frontendApi);
            return;
        }
        case 'prependContent':
            if (params.content && frontendApi.runOnBackend) {
                await frontendApi.runOnBackend((noteId: string, prefix: string) => {
                    const target = api.getNote(noteId);
                    const current = typeof target?.getContent === 'function' ? target.getContent() : '';
                    if (target?.setContent && !String(current || '').startsWith(prefix)) target.setContent(`${prefix}\n${current || ''}`);
                    return true;
                }, [note.noteId, String(params.content)]);
            }
            return;
        case 'syncDerivedTopics':
            if (frontendApi.runOnBackend) {
                await frontendApi.runOnBackend((noteId: string) => {
                    const target = api.getNote(noteId);
                    if (!target) return false;
                    const sourceRelations = ['project', 'client', 'companyOnBehalf', 'organization', 'attendee', 'writer'];
                    const desired = new Set<string>();
                    for (const relationName of sourceRelations) {
                        for (const relation of target.getRelations(relationName) || []) {
                            const source = api.getNote(relation.value);
                            for (const topic of source?.getRelations?.('topic') || []) {
                                if (topic.value) desired.add(topic.value);
                            }
                        }
                    }
                    target.getOwnedRelations?.('derivedTopic')?.forEach((relation: any) => target.removeRelation('derivedTopic', relation.value));
                    desired.forEach((topicId) => target.addRelation('derivedTopic', topicId));
                    return true;
                }, [note.noteId]);
            }
            return;
        case 'createLinkedNote':
            if (params.templateId && frontendApi.createNote) {
                const parent = frontendApi.getNoteWithLabel?.(params.containerMarker)?.noteId || note.noteId;
                const result = await frontendApi.createNote(parent, {
                    title: params.title || `${note.title} — Linked Note`,
                    type: 'text',
                    content: params.content || '',
                });
                if (result?.note && params.relationName) {
                    await TriliumApiBridge.setNoteAttribute(note.noteId, 'relation', params.relationName, '', result.note.noteId, frontendApi);
                }
            }
            return;
        case 'runScript':
            throw new Error('runScript actions are disabled for safety');
        default:
            return;
    }
}

/** Executes rules explicitly marked `onManualAction` against the active note. */
export async function runManualIfThenRules(
    ruleEngine: IfThenRuleEngine,
    frontendApi: any,
    noteId?: string,
    templateEngine?: any,
): Promise<number> {
    if (!frontendApi || !frontendApi.getNote) return 0;
    const targetId = noteId || frontendApi.currentNote?.noteId;
    if (!targetId) return 0;
    const note = frontendApi.getNote(targetId);
    if (!note) return 0;

    const context = buildManualContext(note, templateEngine);
    const results = ruleEngine.evaluateEvent('onManualAction', context).filter((result) => result.matched);
    for (const result of results) {
        for (const action of result.executedActions) {
            await applyManualAction(note, action, frontendApi);
        }
    }
    return results.length;
}
