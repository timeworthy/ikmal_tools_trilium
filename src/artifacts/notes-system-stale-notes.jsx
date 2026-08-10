/**
 * Ikmal Stale Note Reviewer (Standalone JSX Render Note)
 * Displays active untouched notes older than N days as an independent render note widget.
 */

import { SettingsEngine } from '../engine/settingsEngine.js';
import { escapeHtml, section, emptyState, listItem } from '../components/nativeUi.js';
import { findStaleNotes } from '../engine/noteInsightsEngine.js';
import { loadAutomationSettings } from '../engine/packagePersistence.js';

const WORK_NOTE_QUERY = '#extTask OR #extStoryDraft OR #extMeeting OR #extEmailDraft OR #extScratch OR #extReportingNotes';

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

export function initIkmalStaleNotes(containerEl) {
    const settingsEngine = new SettingsEngine();
    const shell = document.createElement('div');
    shell.className = 'notes-system-shell p-3';

    const { card } = section(shell, {
        title: 'Ikmal Stale Notes Reviewer',
        description: 'Active tasks and drafts untouched for longer than the configured threshold.',
    });

    function loadNotes() {
        if (typeof api === 'undefined' || !api.searchForNotes) {
            const sample = [
                { id: '1', title: 'Untouched Specification Draft', daysSinceModified: 21 },
                { id: '2', title: 'Legacy Architecture Review', daysSinceModified: 18 },
            ];
            renderList(sample);
            return;
        }

        const threshold = settingsEngine.get('staleThresholdDays') ?? 14;

        api.searchForNotes(WORK_NOTE_QUERY).then((notes) => {
            const summaries = (notes || []).map((n) => ({
                noteId: n.noteId,
                title: n.title || 'Untitled',
                dateCreated: timestamp(n, 'dateCreated', 'utcDateCreated'),
                dateModified: timestamp(n, 'dateModified', 'utcDateModified'),
                status: labelValue(n, 'status'),
            }));
            const stale = findStaleNotes(summaries, new Date(), threshold);
            renderList(stale);
        }).catch(() => {
            renderList([]);
        });
    }

    function renderList(stale) {
        if (!stale.length) {
            card.appendChild(emptyState('No stale notes found! All active notes are up to date.'));
            return;
        }

        for (const entry of stale.slice(0, 10)) {
            card.appendChild(listItem({
                icon: 'bx-time-five',
                title: entry.title,
                description: `Untouched for ${entry.daysSinceModified} days`,
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
    const frontendApi = typeof api !== 'undefined' ? api : null;
    loadAutomationSettings(frontendApi).then((loaded) => {
        settingsEngine.set('staleThresholdDays', loaded.staleThresholdDays);
    }).catch((error) => {
        console.warn(`[Ikmal Tools] Stale-note settings could not load: ${error}`);
    }).finally(() => loadNotes());
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.ikmal-stale-notes-root')
            || document.body;
        if (container) {
            initIkmalStaleNotes(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
