/**
 * Runtime dispatcher for the trigger types which do not happen inside the
 * frontend creation planner.
 *
 * The saved YAML specification is the source of truth. This backend artifact
 * loads that YAML from the package manifest, uses the same IfThenRuleEngine as
 * the frontend, and applies matching actions to notes changed directly in
 * Trilium. On backend startup it also runs scheduled rules once and keeps a
 * modest interval alive for later checks.
 */

import { IfThenRuleEngine, NoteContext } from '../engine/ifThenRuleEngine.js';
import { IfThenAction, IfThenRuleDef, TriggerType } from '../engine/types.js';
import { YamlParser } from '../engine/yamlParser.js';

declare const api: any;

const PACKAGE_ID = 'iansherr/ikmal_tools_trilium';
const YAML_SPEC_LABEL = 'packageData:yamlSpecification';
const SCHEDULE_INTERVAL_MS = 5 * 60 * 1000;
const SCHEDULE_TIMER_KEY = '__ikmal_if_then_schedule_timer';
const DISPATCH_GUARD_KEY = '__ikmal_if_then_dispatch_guard';

interface RuntimeModel {
    templates: any[];
    rules: IfThenRuleDef[];
}

// These are the minimal identity fields needed to evaluate scopes when a
// freshly installed or deliberately reset package has no saved YAML yet.
// They mirror TemplateEngine's built-in template registry; saved YAML still
// replaces them completely once it exists.
const BUILTIN_TEMPLATE_METADATA = [
    { id: 'task', marker: 'extTask', category: 'work' },
    { id: 'projectTask', marker: 'extTask', category: 'work' },
    { id: 'meeting', marker: 'extMeeting', category: 'work' },
    { id: 'meetingPrep', marker: 'extMeeting', category: 'work' },
    { id: 'story', marker: 'extStoryDraft', category: 'drafts' },
    { id: 'edit', marker: 'extStoryDraft', category: 'drafts' },
    { id: 'scratch', marker: 'extScratch', category: 'drafts' },
    { id: 'projectHub', marker: 'extProjectHub', category: 'work' },
    { id: 'reportingNotes', marker: 'extReportingNotes', category: 'work' },
    { id: 'person', marker: 'extPerson', category: 'people' },
    { id: 'organization', marker: 'extOrganization', category: 'people' },
    { id: 'topic', marker: 'extTopic', category: 'system' },
    { id: 'emailDraft', marker: 'extEmailDraft', category: 'drafts' },
];

function log(message: string): void {
    if (typeof api?.log === 'function') api.log(`[Ikmal If/Then] ${message}`);
}

function ownedValue(note: any, name: string): string | undefined {
    if (!note) return undefined;
    const value = note.getOwnedLabelValue?.(name);
    if (value !== undefined && value !== null) return String(value);
    return undefined;
}

function readYamlSpecification(): RuntimeModel | null {
    const manifests = api.getNotesWithLabel?.('packageOwner', PACKAGE_ID) || [];
    const manifest = manifests.find((note: any) => ownedValue(note, 'packageArtifact') === 'manifest');
    const raw = ownedValue(manifest, YAML_SPEC_LABEL);
    if (!raw) {
        return { templates: BUILTIN_TEMPLATE_METADATA, rules: new IfThenRuleEngine().getAllRules() };
    }

    try {
        const yaml = JSON.parse(raw);
        const spec = YamlParser.parse(typeof yaml === 'string' ? yaml : raw);
        if (!spec || !Array.isArray(spec.ifThenRules)) {
            return { templates: BUILTIN_TEMPLATE_METADATA, rules: new IfThenRuleEngine().getAllRules() };
        }
        const ruleEngine = new IfThenRuleEngine();
        const savedRules = spec.ifThenRules.filter((rule: any) => rule?.id).map((rule: any) => ({
            id: String(rule.id),
            name: String(rule.name || rule.id),
            description: String(rule.description || ''),
            enabled: rule.enabled !== false,
            isBuiltin: Boolean(rule.isBuiltin),
            trigger: {
                type: rule.trigger?.type || 'onNoteCreated',
                ...(rule.trigger?.targetCategory ? { targetCategory: String(rule.trigger.targetCategory) } : {}),
                ...(rule.trigger?.targetTemplateId ? { targetTemplateId: String(rule.trigger.targetTemplateId) } : {}),
                ...(rule.trigger?.targetContainerMarker ? { targetContainerMarker: String(rule.trigger.targetContainerMarker) } : {}),
                ...(rule.trigger?.attributeName ? { attributeName: String(rule.trigger.attributeName) } : {}),
            },
            conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
            actions: Array.isArray(rule.actions) ? rule.actions : [],
        }));
        savedRules.forEach((rule: any) => ruleEngine.registerRule(rule));
        return {
            templates: Array.isArray(spec.templates) && spec.templates.length ? spec.templates : BUILTIN_TEMPLATE_METADATA,
            rules: ruleEngine.getAllRules(),
        };
    } catch (error: any) {
        log(`saved YAML could not be loaded: ${error?.message || error}`);
        return { templates: BUILTIN_TEMPLATE_METADATA, rules: new IfThenRuleEngine().getAllRules() };
    }
}

function getTemplateNoteId(note: any): string | null {
    const relation = note?.getRelations?.('template')?.[0];
    return relation?.value || relation?.targetNoteId || null;
}

function templateInfo(note: any, model: RuntimeModel): { id: string; category?: string; marker?: string } {
    const marker = ownedValue(note, 'extTemplate');
    const byId = model.templates.find((template) => template?.id === marker);
    if (byId) return { id: String(byId.id), category: byId.category, marker: byId.marker };

    const markerMap = new Map<string, any>();
    model.templates.forEach((template) => {
        if (template?.marker && template?.id) markerMap.set(String(template.marker), template);
    });

    const ownedAttributes = note?.getOwnedAttributes?.() || [];
    const markerAttribute = ownedAttributes.find((attribute: any) => attribute.type === 'label' && markerMap.has(attribute.name));
    if (markerAttribute) {
        const template = markerMap.get(markerAttribute.name);
        return { id: String(template.id), category: template.category, marker: template.marker };
    }

    const templateNoteId = getTemplateNoteId(note);
    if (templateNoteId) {
        const templateNote = api.getNote(templateNoteId);
        const templateMarker = ownedValue(templateNote, 'extTemplate');
        const template = model.templates.find((candidate) => candidate?.marker === templateMarker || candidate?.id === templateMarker);
        if (template) return { id: String(template.id), category: template.category, marker: template.marker };
    }

    return { id: marker || '', marker: marker || undefined };
}

function containerMarker(note: any): string | undefined {
    const parentIds = note?.getParentNoteIds?.() || [];
    for (const parentId of parentIds) {
        const parent = api.getNote(parentId);
        const attributes = parent?.getOwnedAttributes?.() || [];
        const root = attributes.find((attribute: any) => attribute.type === 'label' && /Root$/.test(attribute.name));
        if (root) return root.name;
    }
    return undefined;
}

function buildContext(note: any, model: RuntimeModel): NoteContext {
    const info = templateInfo(note, model);
    const attributes: Record<string, any> = {};
    const relations: Record<string, string | string[]> = {};
    for (const attribute of note?.getOwnedAttributes?.() || []) {
        if (!attribute?.name) continue;
        if (attribute.type === 'relation') {
            const current = relations[attribute.name];
            const value = attribute.value || attribute.targetNoteId;
            if (!value) continue;
            relations[attribute.name] = current
                ? [...(Array.isArray(current) ? current : [current]), String(value)]
                : String(value);
        } else {
            attributes[attribute.name] = attribute.value ?? '';
        }
    }

    return {
        noteId: note.noteId,
        title: note.title || '',
        templateId: info.id,
        category: info.category,
        containerMarker: containerMarker(note),
        attributes,
        relations,
    };
}

function findContainer(marker: string | undefined): any | null {
    if (!marker) return null;
    return api.getNoteWithLabel?.(marker) || null;
}

function relationValues(note: any, name: string): string[] {
    return (note?.getRelations?.(name) || [])
        .map((relation: any) => relation.value || relation.targetNoteId)
        .filter(Boolean)
        .map(String);
}

function guardKey(noteId: string, eventType: TriggerType, changedAttribute?: string): string {
    return `${noteId}:${eventType}:${changedAttribute || ''}`;
}

function isGuarded(key: string): boolean {
    const root = globalThis as any;
    const guards: Map<string, number> = root[DISPATCH_GUARD_KEY] || new Map<string, number>();
    root[DISPATCH_GUARD_KEY] = guards;
    const now = Date.now();
    for (const [guardKeyValue, timestamp] of guards) {
        if (now - timestamp > 5000) guards.delete(guardKeyValue);
    }
    if (guards.has(key)) return true;
    guards.set(key, now);
    return false;
}

function ensurePresent(note: any, parent: any): void {
    if (!note || !parent || note.noteId === parent.noteId) return;
    if (!(note.getParentNoteIds?.() || []).includes(parent.noteId)) {
        api.cloneNote(note.noteId, parent.noteId);
    }
}

function ensureAbsent(note: any, parent: any): void {
    if (!note || !parent || !(note.getParentNoteIds?.() || []).includes(parent.noteId)) return;
    api.removeNoteFromParent(note.noteId, parent.noteId);
}

function executeAction(note: any, action: IfThenAction, context: NoteContext): void {
    const params = action.params || {};
    switch (action.type) {
        case 'setLabel': {
            if (!params.labelName) return;
            const value = params.labelValue || '';
            if (ownedValue(note, params.labelName) !== value) note.setLabel(params.labelName, value);
            return;
        }
        case 'removeLabel':
            if (params.labelName && ownedValue(note, params.labelName) !== undefined) note.removeLabel(params.labelName);
            return;
        case 'setRelation':
            if (params.relationName && params.targetNoteId) {
                const current = relationValues(note, params.relationName);
                if (!current.includes(String(params.targetNoteId))) note.setRelation(params.relationName, String(params.targetNoteId));
            }
            return;
        case 'setTaskStatus':
            if (params.status && ownedValue(note, 'status') !== String(params.status)) note.setLabel('status', String(params.status));
            return;
        case 'cloneToContainer': {
            const targets = params.relationName
                ? relationValues(note, params.relationName).map((id) => api.getNote(id)).filter(Boolean)
                : [findContainer(params.containerMarker)];
            targets.filter(Boolean).forEach((target) => ensurePresent(note, target));
            return;
        }
        case 'archiveNote': {
            const archive = findContainer(params.containerMarker || 'archiveProjectRoot');
            const active = findContainer('activeProjectRoot');
            const project = findContainer('projectRoot');
            if (archive) ensurePresent(note, archive);
            if (active) ensureAbsent(note, active);
            if (project) ensureAbsent(note, project);
            if (ownedValue(note, 'status') !== 'complete') note.setLabel('status', 'complete');
            return;
        }
        case 'prependContent': {
            if (!params.content || typeof note.setContent !== 'function') return;
            const current = typeof note.getContent === 'function' ? note.getContent() : '';
            const prefix = String(params.content);
            if (!String(current || '').startsWith(prefix)) note.setContent(`${prefix}\n${current || ''}`);
            return;
        }
        case 'syncDerivedTopics':
            // Topic Association Sync is already attached to the same roots and
            // recomputes this relation when the source relation changes. Avoid
            // duplicating that graph algorithm in the dispatcher.
            return;
        case 'createLinkedNote': {
            if (!params.templateId || typeof api.createTextNote !== 'function') return;
            const parent = findContainer(params.containerMarker) || api.getNote(context.noteId);
            if (!parent) return;
            const title = String(params.title || `${context.title} — Linked Note`);
            const created = api.createTextNote(parent.noteId, title, String(params.content || ''))?.note;
            if (created && params.relationName) note.setRelation(params.relationName, created.noteId);
            return;
        }
        case 'runScript':
            log(`rule action runScript was intentionally skipped for ${note.noteId}; arbitrary script execution is not enabled`);
            return;
        default:
            return;
    }
}

function dispatch(note: any, eventType: TriggerType, changedAttribute?: string, model?: RuntimeModel): number {
    if (!note || note.isInHiddenSubtree?.()) return 0;
    const runtimeModel = model || readYamlSpecification();
    if (!runtimeModel) return 0;

    const key = guardKey(note.noteId, eventType, changedAttribute);
    if (isGuarded(key)) return 0;

    const context = buildContext(note, runtimeModel);
    const engine = new IfThenRuleEngine(runtimeModel.rules);
    const results = engine.evaluateEvent(eventType, context, changedAttribute);
    const matched = results.filter((result) => result.matched);
    if (!matched.length) return 0;

    const apply = () => matched.forEach((result) => result.executedActions.forEach((action) => executeAction(note, action, context)));
    if (typeof api.transactional === 'function') api.transactional(apply);
    else apply();
    return matched.length;
}

function dispatchAttributeChange(): void {
    const origin = api.originEntity;
    if (!origin?.noteId || !origin.attributeId) return;
    const note = api.getNote(origin.noteId);
    const count = dispatch(note, 'onAttributeChanged', origin.name);
    if (count) log(`applied ${count} attribute-change rule(s) to ${origin.noteId} for ${origin.name}`);
}

function dispatchScheduled(): void {
    const model = readYamlSpecification();
    if (!model) return;
    const markers = model.templates.map((template) => template?.marker).filter(Boolean);
    const notes = new Map<string, any>();
    markers.forEach((marker) => (api.getNotesWithLabel?.(marker) || []).forEach((note: any) => notes.set(note.noteId, note)));
    let count = 0;
    notes.forEach((note) => { count += dispatch(note, 'onScheduledCheck', undefined, model); });
    if (count) log(`applied ${count} scheduled rule(s)`);
}

const origin = api.originEntity;
if (origin?.attributeId) {
    dispatchAttributeChange();
} else if (typeof setInterval === 'function') {
    const root = globalThis as any;
    if (!root[SCHEDULE_TIMER_KEY]) {
        root[SCHEDULE_TIMER_KEY] = true;
        dispatchScheduled();
        setInterval(dispatchScheduled, SCHEDULE_INTERVAL_MS);
    }
}
