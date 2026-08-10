/* Keep derived Topics aligned with the notes a working note references.
 *
 * A note's explicit `topic` relations are user-owned. This script maintains a
 * separate `derivedTopic` relation containing the union of Topics on the
 * note's Project, Client, On behalf of, Organization, Attendee, and Writer
 * relations. Recomputing the union makes source changes reversible: removing
 * an Organization never removes a Topic the user chose explicitly.
 */

const SOURCE_RELATIONS = new Set([
    'project',
    'client',
    'companyOnBehalf',
    'organization',
    'attendee',
    'writer',
]);

const canonicalTopicId = (topicId) => {
    const seen = new Set();
    let current = api.getNote(topicId);
    while (current && !seen.has(current.noteId)) {
        seen.add(current.noteId);
        const alias = current.getOwnedRelations('aliasOf')[0];
        if (!alias || !alias.value) return current.noteId;
        current = api.getNote(alias.value);
    }
    return current ? current.noteId : topicId;
};

const isHidden = (note) => note && typeof note.isInHiddenSubtree === 'function'
    && note.isInHiddenSubtree();

const isSource = (note) => note && (
    note.hasLabel('extTemplate', 'projectHub')
    || note.hasLabel('extTemplate', 'person')
    || note.hasLabel('extTemplate', 'organization')
);

const relatedSources = (note) => {
    const sources = [];
    for (const relationName of SOURCE_RELATIONS) {
        for (const relation of note.getRelations(relationName)) {
            try {
                const source = api.getNote(relation.value);
                if (source && !isHidden(source)) sources.push(source);
            } catch (error) {
                api.log(`Topic association skipped missing ${relationName}: ${relation.value}`);
            }
        }
    }
    return sources;
};

const desiredTopicIds = (note) => {
    const ids = new Set();
    for (const source of relatedSources(note)) {
        for (const relation of source.getRelations('topic')) {
            if (relation.value) ids.add(canonicalTopicId(relation.value));
        }
    }
    return [...ids].sort();
};

const recompute = (note) => {
    if (!note || isHidden(note) || note.hasLabel('extTemplate', 'topic')) return;

    const desired = desiredTopicIds(note);
    const current = note.getOwnedRelations('derivedTopic')
        .map((relation) => relation.value)
        .filter(Boolean)
        .sort();
    if (desired.length === current.length
        && desired.every((value, index) => value === current[index])) return;

    note.getOwnedRelations('derivedTopic').forEach((relation) => {
        note.removeRelation('derivedTopic', relation.value);
    });
    desired.forEach((topicId) => note.addRelation('derivedTopic', topicId));
};

const originEntity = api.originEntity;
if (!originEntity || !originEntity.noteId) return;
if (originEntity.type === 'relation' && originEntity.name === 'derivedTopic') return;

const origin = api.getNote(originEntity.noteId);
if (!origin) return;

// Creation-time cloning does not cover an older task/person/organization/tag
// that is edited later today. This hook is already inherited by all of the
// work roots below, so use the same event to maintain the Today index. The
// operation is deliberately idempotent and excludes package internals.
const ownedMarker = (note, name, value) => {
    const actual = note?.getOwnedLabelValue?.(name);
    return value === undefined
        ? actual !== undefined && actual !== null
        : actual === value;
};

const isTouchedWorkNote = (note) => {
    if (!note || note.isInHiddenSubtree?.()) return false;
    if (ownedMarker(note, 'packageOwner') || ownedMarker(note, 'packageArtifact')) return false;
    if (ownedMarker(note, 'dateNote') || ownedMarker(note, 'calendarRoot') || ownedMarker(note, 'todayRoot')) return false;
    return ownedMarker(note, 'extProjectHub')
        || ownedMarker(note, 'extTask')
        || ownedMarker(note, 'extStoryDraft')
        || ownedMarker(note, 'extReportingNotes')
        || ownedMarker(note, 'extMeeting')
        || ownedMarker(note, 'extEmailDraft')
        || ownedMarker(note, 'extScratch')
        || ownedMarker(note, 'extPerson')
        || ownedMarker(note, 'extOrganization')
        || ownedMarker(note, 'extTopic')
        || ownedMarker(note, 'extTemplate', 'projectHub')
        || ownedMarker(note, 'extTemplate', 'person')
        || ownedMarker(note, 'extTemplate', 'organization')
        || ownedMarker(note, 'extTemplate', 'topic')
        || ownedMarker(note, 'noteType', 'projectHub')
        || ownedMarker(note, 'noteType', 'task')
        || ownedMarker(note, 'noteType', 'projectTask')
        || ownedMarker(note, 'noteType', 'person')
        || ownedMarker(note, 'noteType', 'organization')
        || ownedMarker(note, 'noteType', 'topic')
        || ownedMarker(note, 'noteGroup', 'people')
        || ownedMarker(note, 'noteGroup', 'organization');
};

if (isTouchedWorkNote(origin)) {
    try {
        const today = api.getTodayNote();
        if (today && today.noteId !== origin.noteId) {
            api.ensureNoteIsPresentInParent(origin.noteId, today.noteId, '');
        }
    } catch (error) {
        api.log(`Daily touch filing skipped ${origin.noteId}: ${error.message}`);
    }
}
const candidates = new Map([[origin.noteId, origin]]);

if (isSource(origin)) {
    origin.getTargetRelations()
        .filter((relation) => SOURCE_RELATIONS.has(relation.name))
        .forEach((relation) => {
            try {
                const target = api.getNote(relation.noteId);
                candidates.set(target.noteId, target);
            } catch (error) {
                api.log(`Topic association skipped missing dependent note: ${relation.noteId}`);
            }
        });
}

if (origin.hasOwnedLabel('extTopic')) {
    origin.getTargetRelations().forEach((relation) => {
        try {
            const dependent = api.getNote(relation.noteId);
            if (relation.name === 'derivedTopic') {
                candidates.set(dependent.noteId, dependent);
            } else if (relation.name === 'topic') {
                dependent.getTargetRelations()
                    .filter((target) => SOURCE_RELATIONS.has(target.name))
                    .forEach((target) => {
                        const note = api.getNote(target.noteId);
                        candidates.set(note.noteId, note);
                    });
            }
        } catch (error) {
            api.log(`Topic association skipped missing dependent note: ${relation.noteId}`);
        }
    });
}

const update = () => candidates.forEach(recompute);
if (typeof api.transactional === 'function') api.transactional(update);
else update();
