/**
 * Ikmal Time Machine / On This Day (Standalone JSX Render Note)
 * Displays notes created on the exact calendar day in previous years as an independent render note widget.
 */

import { escapeHtml, section, emptyState, listItem } from '../components/nativeUi.js';
import { findOnThisDay } from '../engine/noteInsightsEngine.js';

const WORK_NOTE_QUERY = '#extTask OR #extStoryDraft OR #extMeeting OR #extEmailDraft OR #extScratch OR #extReportingNotes OR #extProjectHub OR #extPerson OR #extOrganization OR #extTopic';

function labelValue(note, name) {
    return note?.getOwnedLabelValue?.(name)
        ?? note?.getLabelValue?.(name)
        ?? note?.labels?.find?.((label) => label.name === name)?.value
        ?? note?.attributes?.find?.((attribute) => attribute.type === 'label' && attribute.name === name)?.value
        ?? '';
}

function timestamp(note, field, label) {
    const raw = labelValue(note, label) || note?.[field];
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string') return NaN;
    const parsed = Date.parse(raw.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return Number.isNaN(parsed) ? NaN : parsed;
}

export function initIkmalOnThisDay(containerEl) {
    const shell = document.createElement('div');
    shell.className = 'notes-system-shell p-3';

    const { card } = section(shell, {
        title: 'Ikmal Time Machine (On This Day)',
        description: 'Notes and journal entries written on this day in past years.',
    });

    function loadEntries() {
        if (typeof api === 'undefined' || !api.searchForNotes) {
            const sample = [
                { id: '1', title: 'Productivity System Draft', yearsAgo: 1 },
                { id: '2', title: 'Architecture Refactoring Notes', yearsAgo: 2 },
            ];
            renderList(sample);
            return;
        }

        api.searchForNotes(WORK_NOTE_QUERY).then((notes) => {
            const summaries = (notes || []).map((n) => ({
                noteId: n.noteId,
                title: n.title || 'Untitled',
                dateCreated: timestamp(n, 'dateCreated', 'utcDateCreated'),
                dateModified: timestamp(n, 'dateModified', 'utcDateModified'),
            }));
            const results = findOnThisDay(summaries, new Date());
            renderList(results);
        }).catch(() => {
            renderList([]);
        });
    }

    function renderList(entries) {
        if (!entries.length) {
            card.appendChild(emptyState('No historical notes found from this calendar day in previous years.'));
            return;
        }

        for (const entry of entries) {
            card.appendChild(listItem({
                icon: 'bx-history',
                title: entry.title,
                description: `${entry.yearsAgo} year${entry.yearsAgo === 1 ? '' : 's'} ago today`,
                actions: typeof api !== 'undefined' && api.openNote ? [{
                    icon: 'bx-link-external',
                    title: `Open ${entry.title}`,
                    onClick: () => api.openNote(entry.noteId),
                }] : [],
            }));
        }
    }

    shell.appendChild(card);
    containerEl.appendChild(shell);
    loadEntries();
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.ikmal-on-this-day-root')
            || document.body;
        if (container) {
            initIkmalOnThisDay(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
