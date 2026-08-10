/* Restore the Journal branches which the capture workflow created today. */

const dayNote = api.originEntity;
if (!dayNote || !dayNote.hasOwnedLabel('dateNote')) {
    return;
}

const day = dayNote.getOwnedLabelValue('dateNote');
// The day note is the index of today's work. Project-created notes must be
// included here too; the legacy repair path intentionally restored story
// drafts and Reporting Notes alongside ordinary captures.
const sources = [
    ['extTask'],
    ['extMeeting'],
    ['extStoryDraft'],
    ['extReportingNotes'],
    ['extEmailDraft'],
    ['extScratch'],
    ['extPerson'],
    ['extOrganization'],
    ['noteGroup', 'people'],
    ['noteGroup', 'organization'],
    ['extTemplate', 'projectHub'],
    ['extTemplate', 'person'],
    ['extTemplate', 'organization'],
    ['extTemplate', 'topic'],
    ['extProjectHub'],
    ['extTopic'],
    ['noteType', 'projectHub'],
    ['noteType', 'topic'],
];
const candidates = new Map();

for (const [name, value] of sources) {
    for (const note of api.getNotesWithLabel(name, value)) {
        candidates.set(note.noteId, note);
    }
}

for (const note of candidates.values()) {
    try {
        if (!note || !note.dateCreated || typeof api.dayjs !== 'function') continue;
        const createdDate = api.dayjs(note.dateCreated)?.format?.('YYYY-MM-DD');
        if (createdDate !== day) continue;
        api.ensureNoteIsPresentInParent(note.noteId, dayNote.noteId, '');
    } catch (err) {
        if (typeof api.log === 'function') {
            api.log(`Daily note repair skipped note ${note?.noteId}: ${err?.message || err}`);
        }
    }
}
