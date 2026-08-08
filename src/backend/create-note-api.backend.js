/*
 * Backend note-creation handler. Replaces the ikmal `create-note-*` commands.
 *
 * Exposed as an HTTP endpoint via #customRequestHandler so the same code path
 * the launcher buttons use can be exercised by external scripts and tests:
 *
 *   POST /custom/create-note  {"type": "meeting", "title": "Acme briefing"}
 *   -> {"noteId": "...", "title": "...", "dayNoteId": "..."}
 *
 * Every created note is cloned into today's day note. In Obsidian this was a
 * text linkback that Dataview had to re-derive; a clone is the real thing --
 * the note genuinely lives in both places, so the day note shows the day's work
 * with no query at all.
 */

const NOTE_TYPES = {
    task: { root: 'taskRoot', template: 'task', projectScoped: true },
    projectTask: { root: 'taskRoot', template: 'projectTask', projectScoped: true },
    meeting: { root: 'meetingRoot', template: 'meeting', projectScoped: true },
    meetingPrep: { root: 'meetingRoot', template: 'meetingPrep', projectScoped: true },
    story: { root: 'storyDraftRoot', template: 'storyDraft', projectScoped: true },
    reportingNotes: { root: 'storyDraftRoot', template: 'reportingNotes', projectScoped: true },
    email: { root: 'emailRoot', template: 'emailDraft', projectScoped: true },
    person: { root: 'peopleRoot', template: 'person' },
    organization: { root: 'orgRoot', template: 'organization' },
    topic: { root: 'topicRoot', template: 'topic', noJournalClone: true },
    projectHub: { root: 'projectRoot', template: 'projectHub' },
};

const NOTE_GROUPS = {
    task: 'task',
    projectTask: 'task',
    meeting: 'meeting',
    meetingPrep: 'meeting',
    story: 'draft',
    reportingNotes: 'reporting',
    email: 'email',
    person: 'people',
    organization: 'organization',
    topic: 'topic',
    projectHub: 'project',
};

const NOTE_MARKERS = {
    task: 'extTask',
    projectTask: 'extTask',
    meeting: 'extMeeting',
    meetingPrep: 'extMeeting',
    story: 'extStoryDraft',
    reportingNotes: 'extReportingNotes',
    email: 'extEmailDraft',
    topic: 'extTopic',
};

const LAUNCHERS = [
    { id: 'newProjectHub', marker: 'launcherProjectHub', type: 'projectHub', title: 'New Project Hub', icon: 'book', shortcut: '' },
    { id: 'newScratch', marker: 'launcherScratch', type: 'scratch', title: 'New Scratch', icon: 'file-blank', shortcut: '' },
    { id: 'newMeeting', marker: 'launcherMeeting', type: 'meeting', title: 'New Meeting', icon: 'calendar-event', shortcut: 'alt+m' },
    { id: 'newTask', marker: 'launcherTask', type: 'task', title: 'New Task', icon: 'check-square', shortcut: 'alt+t' },
    { id: 'newStory', marker: 'launcherStory', type: 'story', title: 'New Story', icon: 'news', shortcut: 'alt+s' },
    { id: 'newEdit', marker: 'launcherEdit', type: 'edit', title: 'New Edit', icon: 'edit-alt', shortcut: '' },
    { id: 'newEmail', marker: 'launcherEmail', type: 'email', title: 'New Email', icon: 'envelope', shortcut: '' },
    { id: 'newPerson', marker: 'launcherPerson', type: 'person', title: 'New Person', icon: 'user', shortcut: '' },
    { id: 'newOrganization', marker: 'launcherOrganization', type: 'organization', title: 'New Organization', icon: 'buildings', shortcut: '' },
    { id: 'newTopic', marker: 'launcherTopic', type: 'topic', title: 'New Topic', icon: 'purchase-tag', shortcut: '' },
];

const EDIT_ROUND_CONTENT =
    '<h2>LINKS</h2><ul><li></li></ul>'
    + '<h2>OPEN QUESTIONS</h2><ul><li></li></ul>'
    + '<h2>EDITORIAL NOTES</h2><p></p>'
    + '<h2>REQUESTED CHANGES</h2><ul><li></li></ul>'
    + '<h2>HED</h2><ul><li></li><li></li><li></li></ul>'
    + '<h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p>'
    + '<h2>STORYBODY</h2><p></p><p>--ENDIT--</p>'
    + '<h2>WRITER RESPONSE</h2><p></p>';

const STORY_DRAFT_CONTENT =
    '<h2>HED</h2><ul><li></li><li></li><li></li></ul>'
    + '<h2>DEK</h2><ul><li></li><li></li><li></li></ul>'
    + '<h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p>'
    + '<h2>STORYBODY</h2><p></p><p>--ENDIT--</p>';

const REPORTING_NOTES_CONTENT =
    '<h2>LINKS</h2><ul><li></li></ul>'
    + '<h2>OPEN QUESTIONS</h2><ul><li></li></ul>'
    + '<h2>IDEA / ANGLE</h2><p></p>'
    + '<h2>REPORTING NOTES</h2><p></p>'
    + "<div class='reporting-note-actions-placeholder' data-reporting-note-actions='true'></div>";

function reportingNotesTitle(projectTitle) {
    return `${projectTitle} — Reporting Notes`;
}

function findTemplate(marker) {
    const templateRoot = api.getNoteWithLabel('templateRoot');
    if (!templateRoot) {
        return null;
    }
    for (const child of templateRoot.getChildNotes()) {
        if (child.getOwnedLabelValue('extTemplate') === marker) {
            return child;
        }
    }
    return null;
}

function findScript(marker) {
    const scriptsRoot = api.getNoteWithLabel('scriptRoot');
    if (!scriptsRoot) {
        return null;
    }
    const pending = [scriptsRoot];
    while (pending.length) {
        const note = pending.shift();
        if (note.getOwnedLabelValue('extScript') === marker) {
            return note;
        }
        pending.push(...note.getChildNotes());
    }
    return null;
}

function ensureLaunchers() {
    const launcherIds = [];
    for (const launcher of LAUNCHERS) {
        const script = findScript(launcher.marker);
        if (!script) {
            return { error: `missing launcher script '${launcher.marker}'` };
        }
        const result = api.createOrUpdateLauncher({
            id: launcher.id,
            title: launcher.title,
            icon: launcher.icon,
            keyboardShortcut: launcher.shortcut,
            isVisible: true,
            type: 'script',
            scriptNoteId: script.noteId,
            targetNoteId: 'root',
        });
        result.note.setRelation('script', script.noteId);
        result.note.setLabel('iconClass', `bx bx-${launcher.icon}`);
        result.note.setLabel('extLauncherType', launcher.type);
        result.note.setLabel('extLauncherLabel', launcher.title);
        result.note.setContent(script.getContent());
        result.note.setLabel('scriptInLauncherContent');
        result.note.mime = 'application/javascript;env=frontend';
        result.note.save();
        launcherIds.push(result.note.noteId);
    }
    return { launcherIds };
}

function ensureHubDashboard(hub) {
    const markup = findScript('hubDashboardMarkup');
    if (!markup) {
        return null;
    }
    for (const child of hub.getChildNotes()) {
        if (child.getOwnedLabelValue('extHubDashboard')) {
            return child.noteId;
        }
    }
    const { note } = api.createNewNote({
        parentNoteId: hub.noteId,
        title: `Dashboard: ${hub.title}`,
        content: '',
        type: 'render',
    });
    note.setRelation('renderNote', markup.noteId);
    note.setLabel('extHubDashboard', 'projectHub');
    return note.noteId;
}

function findProjectHub(noteId) {
    if (!noteId) {
        return null;
    }
    let hub;
    try {
        hub = api.getNote(noteId);
    } catch (error) {
        return null;
    }
    return hub && hub.hasLabel('extTemplate', 'projectHub') ? hub : null;
}

function nextRound(hub) {
    const rounds = hub.getTargetRelations()
        .filter((relation) => relation.type === 'relation' && relation.name === 'project')
        .map((relation) => api.getNote(relation.noteId))
        .filter((note) => note.hasLabel('extTemplate', 'storyDraft'))
        .map((note) => Number(note.getLabelValue('round')))
        .filter((round) => Number.isFinite(round));
    return rounds.length ? Math.max(...rounds) + 1 : 1;
}

function projectHubFor(note) {
    return note.getRelations('project')
        .map((relation) => api.getNote(relation.value))
        .find((hub) => hub.hasLabel('extTemplate', 'projectHub')) || null;
}

function latestRoundForHub(hub) {
    return hub.getTargetRelations()
        .filter((relation) => relation.type === 'relation' && relation.name === 'project')
        .map((relation) => api.getNote(relation.noteId))
        .filter((note) => note.hasLabel('extTemplate', 'storyDraft'))
        .sort((a, b) => {
            const roundA = Number(a.getLabelValue('round'));
            const roundB = Number(b.getLabelValue('round'));
            return (Number.isFinite(roundB) ? roundB : 0) - (Number.isFinite(roundA) ? roundA : 0);
        })[0] || null;
}

function reportingNotesForHub(hub) {
    return hub.getTargetRelations()
        .filter((relation) => relation.type === 'relation' && relation.name === 'project')
        .map((relation) => api.getNote(relation.noteId))
        .filter((note) => note.hasLabel('extTemplate', 'reportingNotes'))[0] || null;
}

function syncHubFromRound(hub, round = latestRoundForHub(hub)) {
    if (!hub) {
        return;
    }

    const reporting = reportingNotesForHub(hub);
    if (!round && !reporting) return;

    for (const [relationName, overrideName] of [
        ['client', 'clientOverride'],
        ['companyOnBehalf', 'companyOnBehalfOverride'],
    ]) {
        const relation = (round && round.getRelations(relationName)[0])
            || hub.getRelations(relationName)[0]
            || (reporting && reporting.getRelations(relationName)[0]);
        const notes = [hub, round, reporting].filter(Boolean);
        if (relation) {
            notes.forEach((note) => note.setRelation(relationName, relation.value));
        }
        const override = (round && round.getOwnedLabelValue(overrideName))
            || hub.getOwnedLabelValue(overrideName)
            || (reporting && reporting.getOwnedLabelValue(overrideName));
        if (override) {
            hub.setLabel(overrideName, override);
            if (round) round.setLabel(overrideName, override);
            if (reporting) reporting.setLabel(overrideName, override);
        }
    }
    if (round && round.getLabelValue('round')) {
        hub.setLabel('currentRound', round.getLabelValue('round'));
    }
}

function normalizedRoundTitle(title, hub, options) {
    if (!hub) {
        return title;
    }
    if (/(?:\bround\s*\d+\b|\bdraft\s*\d+\b|\bv\s*\d+\b)/i.test(title)) {
        return title;
    }
    const round = String(options.round || nextRound(hub));
    return `${title} — ${hub.getLabelValue('kind') === 'edit' ? 'Round' : 'Draft'} ${round}`;
}

function validIsoDate(value) {
    return typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && api.dayjs(value).format('YYYY-MM-DD') === value;
}

function validateDate(value, field) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    return validIsoDate(value) ? null : `${field} must be a valid YYYY-MM-DD date`;
}

function validateEditorialFields(options) {
    for (const [field, value] of [
        ['followUpDate', options.followUpDate],
        ['lastSentDate', options.lastSentDate],
    ]) {
        const error = validateDate(value, field);
        if (error) return error;
    }
    if (options.waitingOn !== undefined && typeof options.waitingOn !== 'string') {
        return 'waitingOn must be text';
    }
    return null;
}

function applyEditorialFields(note, typeKey, options, hub) {
    if (typeKey === 'projectHub') {
        const kind = options.kind || 'project';
        note.setLabel('iconClass', kind === 'edit' ? 'bx bx-edit-alt' : 'bx bx-book');
        note.setLabel('extHubIcon', kind);
        if (options.kind) {
            note.setLabel('kind', options.kind);
        }
        if (options.status) {
            note.setLabel('status', options.status);
        }
    }
    if (hub) {
        note.setRelation('project', hub.noteId);
        if (typeKey === 'story') {
            hub.setLabel('status', 'active');
            const round = String(options.round || nextRound(hub));
            note.setLabel('round', round);
            note.setLabel('status', options.status || 'editing');
            hub.setLabel('currentRound', round);
            syncHubFromRound(hub, note);
        }
    }
    if (options.waitingOn) {
        note.setLabel('waitingOn', options.waitingOn);
    }
    if (options.followUpDate) {
        note.setLabel('followUpDate', options.followUpDate);
    }
    if (options.lastSentDate) {
        note.setLabel('lastSentDate', options.lastSentDate);
    }
    return { hub };
}

function inTransaction(callback) {
    return typeof api.transactional === 'function' ? api.transactional(callback) : callback();
}

function findStorageParent(spec, hub) {
    if (hub && spec.projectScoped) {
        return hub;
    }
    if (spec.template === 'projectHub') {
        return api.getNoteWithLabel('activeProjectRoot')
            || api.getNoteWithLabel('projectRoot');
    }
    if (spec.projectScoped) {
        return api.getNoteWithLabel('unassignedRoot') || api.getNoteWithLabel(spec.root);
    }
    return api.getNoteWithLabel(spec.root);
}

function startStory(title, mode) {
    if (mode !== 'project' && mode !== 'edit') {
        return { error: "mode must be 'project' or 'edit'" };
    }
    const hubResult = createNote('projectHub', title, {
        kind: mode,
        status: 'active',
    });
    if (hubResult.error) {
        return hubResult;
    }
    const storyResult = createNote('story', title, {
        projectId: hubResult.noteId,
        status: mode === 'edit' ? 'editing' : 'drafting',
        workflow: mode,
    });
    if (storyResult.error) {
        return storyResult;
    }
    let reportingNoteId = null;
    if (mode === 'project') {
        const reportingResult = createNote(
            'reportingNotes',
            reportingNotesTitle(hubResult.title),
            { projectId: hubResult.noteId },
        );
        if (reportingResult.error) {
            return reportingResult;
        }
        reportingNoteId = reportingResult.noteId;
    }
    return {
        ...storyResult,
        hubId: hubResult.noteId,
        dashboardNoteId: hubResult.dashboardNoteId,
        mode,
        reportingNoteId,
    };
}

function createScratch(title, projectId) {
    const hub = findProjectHub(projectId);
    if (projectId && !hub) {
        return { error: 'projectId must identify a Project Hub' };
    }
    const parent = hub
        || api.getNoteWithLabel('unassignedRoot')
        || api.getNoteWithLabel('projectRoot');
    if (!parent) {
        return { error: 'missing #unassignedRoot -- run apply_skeleton.py' };
    }

    const { note } = api.createTextNote(parent.noteId, title, '');
    note.setLabel('noteGroup', 'scratch');
    note.setLabel('extScratch');
    if (hub) {
        note.setRelation('project', hub.noteId);
    }

    const dayNote = api.getTodayNote();
    if (dayNote) {
        api.ensureNoteIsPresentInParent(note.noteId, dayNote.noteId, '');
    }
    return {
        noteId: note.noteId,
        title: note.title,
        dayNoteId: dayNote ? dayNote.noteId : null,
    };
}

function syncProjectHub(hubId) {
    const hub = findProjectHub(hubId);
    if (!hub) {
        return { error: 'hubId must identify a Project Hub' };
    }
    syncHubFromRound(hub);
    return { hubId: hub.noteId, roundId: latestRoundForHub(hub)?.noteId || null };
}

function projectHubForAreaAction(noteId) {
    let note;
    try {
        note = api.getNote(noteId);
    } catch (error) {
        return null;
    }
    if (!note) {
        return null;
    }
    if (note.hasLabel('extTemplate', 'projectHub')) {
        return note;
    }
    return projectHubFor(note);
}

function updateProjectArea(noteId, action) {
    if (!['archiveProject', 'reopenProject'].includes(action)) {
        return { error: `unknown project action '${action}'` };
    }
    const hub = projectHubForAreaAction(noteId);
    if (!hub) {
        return { error: 'project actions require a Project Hub or one of its rounds' };
    }
    const projectRoot = api.getNoteWithLabel('projectRoot');
    const activeRoot = api.getNoteWithLabel('activeProjectRoot');
    const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
    if (!projectRoot || !activeRoot || !archiveRoot) {
        return { error: 'project areas are not installed; rerun install.py' };
    }

    const destination = action === 'archiveProject' ? archiveRoot : activeRoot;
    api.ensureNoteIsPresentInParent(hub.noteId, destination.noteId, '');
    for (const area of [projectRoot, activeRoot, archiveRoot]) {
        if (area.noteId !== destination.noteId) {
            api.ensureNoteIsAbsentFromParent(hub.noteId, area.noteId);
        }
    }
    if (action === 'reopenProject') {
        hub.setLabel('status', 'active');
    }
    return {
        noteId,
        hubId: hub.noteId,
        action,
        area: action === 'archiveProject' ? 'archive' : 'active',
        status: hub.getLabelValue('status') || 'active',
    };
}

function createEntityFor(noteId, title, relationName, entityType = 'organization') {
    const allowedRelations = new Set(['client', 'companyOnBehalf', 'organization', 'employer']);
    if (!allowedRelations.has(relationName)) {
        return { error: `entity relation '${relationName}' is not supported` };
    }
    if (!['person', 'organization'].includes(entityType)) {
        return { error: "entityType must be 'person' or 'organization'" };
    }
    if (typeof title !== 'string' || !title.trim()) {
        return { error: 'entity title is required' };
    }

    let source;
    try {
        source = api.getNote(noteId);
    } catch (error) {
        return { error: 'noteId does not identify an existing note' };
    }
    const supportedSource = [
        ['projectHub', ['client', 'companyOnBehalf']],
        ['storyDraft', ['client', 'companyOnBehalf']],
        ['reportingNotes', ['client']],
        ['emailDraft', ['client', 'companyOnBehalf']],
        ['meeting', ['organization']],
        ['meetingPrep', ['organization']],
        ['person', ['employer']],
    ].some(([template, relations]) => source.hasLabel('extTemplate', template)
        && relations.includes(relationName));
    if (!supportedSource) {
        return { error: 'entity creation is not available for this note and field' };
    }

    const hub = source.hasLabel('extTemplate', 'projectHub') ? source : projectHubFor(source);
    const created = createNote(entityType, title.trim(), {
        projectId: hub ? hub.noteId : undefined,
    });
    if (created.error) {
        return created;
    }
    const entity = api.getNote(created.noteId);
    source.setRelation(relationName, entity.noteId);
    if (hub && ['client', 'companyOnBehalf'].includes(relationName)) {
        hub.setRelation(relationName, entity.noteId);
    }
    return {
        noteId: source.noteId,
        entityId: entity.noteId,
        entityType,
        organizationId: entityType === 'organization' ? entity.noteId : undefined,
        personId: entityType === 'person' ? entity.noteId : undefined,
        title: entity.title,
        relationName,
    };
}

function createOrganizationFor(noteId, title, relationName) {
    return createEntityFor(noteId, title, relationName, 'organization');
}

function updateEditorialState(noteId, action, options = {}) {
    if (!['awaiting', 'returned', 'complete'].includes(action)) {
        return { error: `unknown editorial action '${action}'` };
    }
    const fieldError = validateEditorialFields(options);
    if (fieldError) {
        return { error: fieldError };
    }
    if (action === 'awaiting' && (!options.waitingOn || !options.waitingOn.trim())) {
        return { error: 'waitingOn is required when marking a round awaiting' };
    }
    if (action === 'awaiting' && !options.followUpDate) {
        return { error: 'followUpDate is required when marking a round awaiting' };
    }
    let note;
    try {
        note = api.getNote(noteId);
    } catch (error) {
        return { error: 'noteId does not identify an existing note' };
    }
    if (!note || !note.hasLabel('extTemplate', 'storyDraft')) {
        return { error: 'state actions only apply to Story Draft notes' };
    }

    const hub = projectHubFor(note);

    const today = api.dayjs().format('YYYY-MM-DD');
    if (action === 'awaiting') {
        if (hub) {
            hub.setLabel('status', 'active');
        }
        note.setLabel('status', 'awaiting');
        note.setLabel('doneDate', '');
        note.setLabel('lastSentDate', options.lastSentDate || today);
        if (options.waitingOn) {
            note.setLabel('waitingOn', options.waitingOn);
        }
        if (options.followUpDate) {
            note.setLabel('followUpDate', options.followUpDate);
        }
    } else if (action === 'returned') {
        if (hub) {
            hub.setLabel('status', 'active');
        }
        note.setLabel('status', 'editing');
        note.setLabel('doneDate', '');
        note.setLabel('waitingOn', '');
        note.setLabel('followUpDate', '');
    } else if (action === 'complete') {
        if (hub) {
            hub.setLabel('status', 'complete');
        }
        note.setLabel('status', 'done');
        note.setLabel('doneDate', today);
        note.setLabel('waitingOn', '');
        note.setLabel('followUpDate', '');
    }

    return {
        noteId: note.noteId,
        title: note.title,
        action,
        status: note.getLabelValue('status'),
    };
}

function createNote(typeKey, title, options = {}) {
    const spec = NOTE_TYPES[typeKey];
    if (!spec) {
        return { error: `unknown note type '${typeKey}'` };
    }
    const fieldError = validateEditorialFields(options);
    if (fieldError) {
        return { error: fieldError };
    }
    if (options.round !== undefined && options.round !== null && options.round !== '') {
        const round = Number(options.round);
        if (!Number.isInteger(round) || round < 1) {
            return { error: 'round must be a positive integer' };
        }
    }
    if (typeKey === 'projectHub' && options.kind && !['project', 'edit'].includes(options.kind)) {
        return { error: "kind must be 'project' or 'edit'" };
    }

    const template = findTemplate(spec.template);
    if (!template) {
        return { error: `missing template '${spec.template}' -- run apply_templates.py` };
    }

    const hub = findProjectHub(options.projectId);
    if (options.projectId && !hub) {
        return { error: 'projectId must identify a Project Hub' };
    }

    const parent = findStorageParent(spec, hub);
    if (!parent) {
        const marker = spec.projectScoped ? 'unassignedRoot' : spec.root;
        return { error: `missing container #${marker} -- run apply_skeleton.py` };
    }

    const noteTitle = typeKey === 'story'
        ? normalizedRoundTitle(title, hub, options)
        : title;
    const { note } = api.createTextNote(parent.noteId, noteTitle, '');
    note.setRelation('template', template.noteId);
    note.setLabel('noteType', spec.template);
    note.setLabel('noteGroup', NOTE_GROUPS[typeKey]);
    if (NOTE_MARKERS[typeKey]) {
        note.setLabel(NOTE_MARKERS[typeKey]);
    }
    applyEditorialFields(note, typeKey, options, hub);
    if (typeKey === 'story') {
        note.setContent(options.workflow === 'edit' ? EDIT_ROUND_CONTENT : STORY_DRAFT_CONTENT);
    } else if (typeKey === 'reportingNotes') {
        note.setContent(REPORTING_NOTES_CONTENT);
        if (hub) {
            note.setLabel('extReportingTitleManaged');
        }
    }

    let dayNoteId = null;
    if (typeKey !== 'projectHub' && !spec.noJournalClone) {
        const dayNote = api.getTodayNote();
        if (dayNote) {
            api.ensureNoteIsPresentInParent(note.noteId, dayNote.noteId, '');
            dayNoteId = dayNote.noteId;
        }
    }

    return {
        noteId: note.noteId,
        title: note.title,
        dayNoteId,
        dashboardNoteId: typeKey === 'projectHub' ? ensureHubDashboard(note) : null,
    };
}

function reconcileAllProjects() {
    const projectRoot = api.getNoteWithLabel('projectRoot');
    const activeRoot = api.getNoteWithLabel('activeProjectRoot');
    const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
    if (!projectRoot || !activeRoot || !archiveRoot) {
        return { error: 'project containers not found' };
    }
    const isTemplate = (n, m) => n && n.hasLabel('extTemplate', m);
    let moved = 0;
    let statusUpdated = 0;

    function getDescendants(rootNote) {
        const pending = [rootNote];
        const seen = new Set();
        const resList = [];
        while (pending.length) {
            const current = pending.pop();
            if (!current || seen.has(current.noteId)) continue;
            seen.add(current.noteId);
            resList.push(current);
            pending.push(...current.getChildNotes());
        }
        return resList;
    }

    const hubs = getDescendants(projectRoot).filter((n) => n.noteId !== projectRoot.noteId && isTemplate(n, 'projectHub'));
    for (const hubNote of hubs) {
        const drafts = hubNote.getTargetRelations()
            .filter((r) => r.type === 'relation' && r.name === 'project')
            .map((r) => api.getNote(r.noteId))
            .filter((n) => isTemplate(n, 'storyDraft'))
            .sort((a, b) => Number(b.getLabelValue('round') || 0) - Number(a.getLabelValue('round') || 0));

        if (!drafts.length) continue;
        const latest = drafts[0];
        const latestStatus = (latest.getLabelValue('status') || '').toLowerCase();
        const isDone = latestStatus === 'done' || latestStatus === 'approved' || latestStatus === 'published' || Boolean(latest.getOwnedLabelValue('doneDate'));
        const currentStatus = hubNote.getLabelValue('status');

        if (isDone && currentStatus !== 'complete') {
            hubNote.setLabel('status', 'complete');
            statusUpdated++;
            if (!hubNote.getParentNoteIds().includes(archiveRoot.noteId)) {
                api.ensureNoteIsPresentInParent(hubNote.noteId, archiveRoot.noteId, '');
                moved++;
            }
            if (hubNote.getParentNoteIds().includes(activeRoot.noteId)) {
                api.ensureNoteIsAbsentFromParent(hubNote.noteId, activeRoot.noteId);
            }
        } else if (!isDone && (currentStatus === 'complete' || currentStatus === 'archived')) {
            hubNote.setLabel('status', 'active');
            statusUpdated++;
            if (!hubNote.getParentNoteIds().includes(activeRoot.noteId)) {
                api.ensureNoteIsPresentInParent(hubNote.noteId, activeRoot.noteId, '');
                moved++;
            }
            if (hubNote.getParentNoteIds().includes(archiveRoot.noteId)) {
                api.ensureNoteIsAbsentFromParent(hubNote.noteId, archiveRoot.noteId);
            }
        }
    }
    return { reconciledCount: hubs.length, movedCount: moved, statusUpdatedCount: statusUpdated };
}

function isAuthorized(req) {
    const config = api.getNoteWithLabel('extConfig');
    const expected = config && config.getOwnedLabelValue('createNoteSecret');
    if (!expected) {
        return { ok: false, status: 500, error: 'handler not configured: missing #createNoteSecret' };
    }
    if (req.headers['x-extension-secret'] !== expected) {
        return { ok: false, status: 401, error: 'unauthorized' };
    }
    return { ok: true };
}

/*
 * The single dispatch point for every note-creation action. Both entry points
 * -- the HTTP handler below and the in-process global registered after it --
 * route through this, so they cannot drift apart.
 */
function dispatchAction(body = {}) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (body.action === 'ensureLaunchers') {
        return inTransaction(ensureLaunchers);
    }
    if (body.action === 'startStory') {
        return title
            ? inTransaction(() => startStory(title, body.mode))
            : { error: 'title is required' };
    }
    if (body.action === 'scratch') {
        return title
            ? inTransaction(() => createScratch(title, body.projectId))
            : { error: 'title is required' };
    }
    if (body.action === 'syncHub') {
        return inTransaction(() => syncProjectHub(body.hubId));
    }
    if (body.action === 'reconcileProjects') {
        return inTransaction(reconcileAllProjects);
    }
    if (body.action === 'archiveProject' || body.action === 'reopenProject') {
        return inTransaction(() => updateProjectArea(body.noteId, body.action));
    }
    if (body.action === 'createOrganization') {
        return inTransaction(() => createOrganizationFor(
            body.noteId, body.title, body.relationName,
        ));
    }
    if (body.action === 'createEntity') {
        return inTransaction(() => createEntityFor(
            body.noteId, body.title, body.relationName, body.entityType,
        ));
    }
    if (body.action) {
        return inTransaction(() => updateEditorialState(body.noteId, body.action, {
            waitingOn: body.waitingOn,
            followUpDate: body.followUpDate,
            lastSentDate: body.lastSentDate,
        }));
    }
    return title
        ? inTransaction(() => createNote(body.type, title, {
            projectId: body.projectId,
            round: body.round,
            status: body.status,
            kind: body.kind,
            workflow: body.workflow,
            waitingOn: body.waitingOn,
            followUpDate: body.followUpDate,
            lastSentDate: body.lastSentDate,
        }))
        : { error: 'title is required' };
}

// In-process entry point for frontend callers that already hold `runOnBackend`.
// Reaching the HTTP handler from the frontend means pulling #createNoteSecret
// into page JS, where any other script sharing the window can read it; calling
// this instead keeps the secret on the server. Registered on every load of this
// script, including the request-less startup load below.
globalThis.__ikmalCreateNote = dispatchAction;

const { req, res } = api || {};

// Trilium loads custom request handlers once during startup without a request
// object. Do not execute the request path until the handler is invoked.
if (req && res) {
    const auth = isAuthorized(req);

    if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
    } else if (req.method !== 'POST') {
        res.status(405).json({ error: 'POST only' });
    } else {
        try {
            const result = dispatchAction(req.body || {});
            res.status(result.error ? 400 : 200).json(result);
        } catch (handlerErr) {
            if (typeof api.log === 'function') {
                api.log(`create-note-api handler error: ${handlerErr?.message || handlerErr}`);
            }
            res.status(500).json({ error: handlerErr?.message || 'Internal server error' });
        }
    }
}
