/* Restore the Journal branches which the capture workflow created today. */

const dayNote = api.originEntity;
if (!dayNote || !dayNote.hasOwnedLabel('dateNote')) {
    return;
}

const day = dayNote.getOwnedLabelValue('dateNote');
// Story drafts and Reporting Notes are attached by the explicit New Story
// workflow. Do not infer that relationship from the day a note was created:
// opening a new journal should not pull every same-day story project into it.
const sources = [
    ['extTask'],
    ['extMeeting'],
    ['extEmailDraft'],
    ['extScratch'],
    ['noteGroup', 'people'],
    ['noteGroup', 'organization'],
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
