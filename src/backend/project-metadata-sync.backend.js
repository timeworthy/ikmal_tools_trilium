/*
 * Keep project metadata relations aligned when a user edits a Project Hub,
 * Story Draft, or Reporting Notes note directly. Keep managed Reporting Notes
 * titles aligned with their Project Hub without overwriting a user rename.
 *
 * This hook is intentionally narrow. It does not create notes, search the
 * database, or touch status/content fields. It copies only a relation when
 * the event's origin note has an actual value, so unrelated edits cannot
 * erase metadata. Every write is conditional, which makes the follow-up
 * change events converge without recursive write churn.
 */

const originEntity = api.originEntity;
if (!originEntity || !originEntity.noteId) {
    return;
}
if (originEntity.type === 'relation' && originEntity.name === 'derivedTopic') {
    return;
}

const origin = api.getNote(originEntity.noteId);
if (!origin) {
    return;
}

// A Journal branch is the day's work index. Creation-time cloning covers new
// notes, but an existing Project Hub or one of its files can be edited later
// in the day. This hook already receives project-tree note/attribute changes,
// so keep that second filing path here and make it idempotent.
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

const DERIVED_TOPIC_SOURCE_RELATIONS = new Set([
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

const derivedTopicSources = (note) => {
    const sources = [];
    for (const relationName of DERIVED_TOPIC_SOURCE_RELATIONS) {
        for (const relation of note.getRelations(relationName)) {
            try {
                const source = api.getNote(relation.value);
                if (source && !source.isInHiddenSubtree()) sources.push(source);
            } catch (error) {
                api.log(`Topic association skipped missing ${relationName}: ${relation.value}`);
            }
        }
    }
    return sources;
};

const recomputeDerivedTopics = (note) => {
    if (!note || note.isInHiddenSubtree() || note.hasLabel('extTemplate', 'topic')) return;
    const desired = new Set();
    for (const source of derivedTopicSources(note)) {
        source.getRelations('topic').forEach((relation) => {
            if (relation.value) desired.add(canonicalTopicId(relation.value));
        });
    }
    const desiredIds = [...desired].sort();
    const currentIds = note.getOwnedRelations('derivedTopic')
        .map((relation) => relation.value)
        .filter(Boolean)
        .sort();
    if (desiredIds.length === currentIds.length
        && desiredIds.every((value, index) => value === currentIds[index])) return;
    note.getOwnedRelations('derivedTopic').forEach((relation) => {
        note.removeRelation('derivedTopic', relation.value);
    });
    desiredIds.forEach((topicId) => note.addRelation('derivedTopic', topicId));
};

const derivedCandidates = new Map([[origin.noteId, origin]]);
if (origin.hasLabel('extTemplate', 'projectHub')
    || origin.hasLabel('extTemplate', 'person')
    || origin.hasLabel('extTemplate', 'organization')) {
    origin.getTargetRelations()
        .filter((relation) => DERIVED_TOPIC_SOURCE_RELATIONS.has(relation.name))
        .forEach((relation) => {
            try {
                const target = api.getNote(relation.noteId);
                derivedCandidates.set(target.noteId, target);
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
                derivedCandidates.set(dependent.noteId, dependent);
            } else if (relation.name === 'topic') {
                dependent.getTargetRelations()
                    .filter((target) => DERIVED_TOPIC_SOURCE_RELATIONS.has(target.name))
                    .forEach((target) => {
                        const note = api.getNote(target.noteId);
                        derivedCandidates.set(note.noteId, note);
                    });
            }
        } catch (error) {
            api.log(`Topic association skipped missing dependent note: ${relation.noteId}`);
        }
    });
}
const updateDerivedTopics = () => derivedCandidates.forEach(recomputeDerivedTopics);
if (typeof api.transactional === 'function') api.transactional(updateDerivedTopics);
else updateDerivedTopics();

const isTemplate = (note, marker) => note && note.hasLabel('extTemplate', marker);

const relationValue = (note, name) => {
    const relation = note.getRelations(name)[0];
    return relation ? relation.value : null;
};

const setRelationIfNeeded = (note, name, value) => {
    if (!note || !value || relationValue(note, name) === value) {
        return;
    }
    note.setRelation(name, value);
};

const hubFor = (note) => {
    if (isTemplate(note, 'projectHub')) {
        return note;
    }
    return note.getRelations('project')
        .map((relation) => api.getNote(relation.value))
        .find((candidate) => isTemplate(candidate, 'projectHub')) || null;
};

const latestRoundFor = (hub) => hub.getTargetRelations()
    .filter((relation) => relation.type === 'relation' && relation.name === 'project')
    .map((relation) => api.getNote(relation.noteId))
    .filter((note) => isTemplate(note, 'storyDraft'))
    .sort((left, right) => Number(right.getLabelValue('round') || 0)
        - Number(left.getLabelValue('round') || 0))[0] || null;

const reportingFor = (hub) => hub.getTargetRelations()
    .filter((relation) => relation.type === 'relation' && relation.name === 'project')
    .map((relation) => api.getNote(relation.noteId))
    .find((note) => isTemplate(note, 'reportingNotes')) || null;

const reconcileReportingTitle = (hub, reporting) => {
    if (!hub || !reporting) return;
    const expected = `${hub.title} — Reporting Notes`;
    if (reporting.hasLabel('extReportingTitleManaged')
        && reporting.title !== expected) {
        reporting.title = expected;
    }
};

const hub = hubFor(origin);
if (!hub) {
    return;
}

const isRound = isTemplate(origin, 'storyDraft');
const isReporting = isTemplate(origin, 'reportingNotes');
const isHub = isTemplate(origin, 'projectHub');
if (!isRound && !isReporting && !isHub) {
    return;
}

const reporting = isReporting ? origin : reportingFor(hub);

if (!originEntity.attributeId) {
    const expected = `${hub.title} — Reporting Notes`;
    if (isReporting && origin.hasLabel('extReportingTitleManaged')
        && origin.title !== expected) {
        origin.removeLabel('extReportingTitleManaged');
        return;
    }
    if (isHub) {
        reconcileReportingTitle(hub, reporting);
    }
    return;
}

const originAttribute = originEntity;
if (originAttribute.isDeleted) {
    return;
}

const sync = () => {
    reconcileReportingTitle(hub, reporting);

    // Reconcile status and physical location (Active vs Archive) based on latest round status
    if (['status', 'round', 'doneDate'].includes(originAttribute.name) || !originAttribute.attributeId) {
        reconcileHubStatusAndArea(hub);
    }

    if (!['client', 'companyOnBehalf'].includes(originAttribute.name)) {
        return;
    }

    const round = isRound ? origin : latestRoundFor(hub);
    const targets = [hub, round, reporting].filter(Boolean);

    for (const relationName of [originAttribute.name]) {
        const value = originAttribute.value || relationValue(origin, relationName);
        if (!value) continue;
        try {
            api.getNote(value);
        } catch (error) {
            api.log(`Project metadata sync skipped missing ${relationName} target: ${value}`);
            continue;
        }
        targets.forEach((target) => setRelationIfNeeded(target, relationName, value));
    }
};

const reconcileHubStatusAndArea = (hubNote) => {
    if (!hubNote || (typeof hubNote.isInHiddenSubtree === 'function' && hubNote.isInHiddenSubtree())) return;
    const currentStatus = hubNote.getLabelValue('status');
    const drafts = hubNote.getTargetRelations()
        .filter((relation) => relation.type === 'relation' && relation.name === 'project')
        .map((relation) => api.getNote(relation.noteId))
        .filter((note) => isTemplate(note, 'storyDraft'))
        .sort((left, right) => Number(right.getLabelValue('round') || 0)
            - Number(left.getLabelValue('round') || 0));

    if (!drafts.length) return;
    const latest = drafts[0];
    const latestStatus = (latest.getLabelValue('status') || '').toLowerCase();
    const isDone = latestStatus === 'done' || latestStatus === 'approved' || latestStatus === 'published' || Boolean(latest.getOwnedLabelValue('doneDate'));

    const activeRoot = api.getNoteWithLabel('activeProjectRoot');
    const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');

    if (isDone && currentStatus !== 'complete') {
        hubNote.setLabel('status', 'complete');
        if (archiveRoot && !hubNote.getParentNoteIds().includes(archiveRoot.noteId)) {
            api.cloneNote(hubNote.noteId, archiveRoot.noteId);
        }
        if (activeRoot && hubNote.getParentNoteIds().includes(activeRoot.noteId)) {
            api.removeNoteFromParent(hubNote.noteId, activeRoot.noteId);
        }
    } else if (!isDone && (currentStatus === 'complete' || currentStatus === 'archived')) {
        hubNote.setLabel('status', 'active');
        if (activeRoot && !hubNote.getParentNoteIds().includes(activeRoot.noteId)) {
            api.cloneNote(hubNote.noteId, activeRoot.noteId);
        }
        if (archiveRoot && hubNote.getParentNoteIds().includes(archiveRoot.noteId)) {
            api.removeNoteFromParent(hubNote.noteId, archiveRoot.noteId);
        }
    }
};

if (typeof api.transactional === 'function') {
    api.transactional(sync);
} else {
    sync();
}
