/**
 * Standalone Daily Insights & Heatmap (JSX Render Note)
 * Renders Writing Goal Progress, 30-Day Activity Heatmap, On This Day Anniversaries,
 * Stale Notes Review, and Daily Weather & Moon Phase as a standalone render note widget.
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { TodayEngine } from '../engine/todayEngine.js';
import { NoteCreationEngine } from '../engine/noteCreationEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { escapeHtml, section, emptyState, listItem } from '../components/nativeUi.js';
import {
    buildActivityHeatmap,
    computeMoonPhase,
    computeWritingGoalProgress,
    countWords,
    findOnThisDay,
    findStaleNotes,
    pickDailyQuote,
} from '../engine/noteInsightsEngine.js';
import { loadRuntimeModel } from '../engine/runtimeModel.js';

export function initNotesSystemInsights(containerEl) {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const todayEngine = new TodayEngine();
    const settingsEngine = new SettingsEngine();
    const frontendApi = typeof api !== 'undefined' ? api : null;
    const modelReady = loadRuntimeModel(templateEngine, todayEngine, ifThenRuleEngine, settingsEngine, frontendApi);

    const shell = document.createElement('div');
    shell.className = 'notes-system-shell p-3';

    const { card: outerCard } = section(shell, {
        title: 'Daily Productivity & Writing Insights',
        description: 'Writing progress, activity heatmap, anniversaries, and stale notes overview.',
    });

    const grid = document.createElement('div');
    grid.className = 'row g-3 mt-1';

    function timestamp(note, field, label) {
        const raw = note?.getOwnedLabelValue?.(label) || note?.[field];
        if (typeof raw === 'number') return raw;
        if (typeof raw !== 'string') return NaN;
        const parsed = Date.parse(raw.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
        return Number.isNaN(parsed) ? NaN : parsed;
    }

    function insightCard(title, icon) {
        const el = document.createElement('div');
        el.className = 'ns-card p-3';
        el.innerHTML = `<h6 class="ns-card-title"><i class="bx ${icon} text-primary me-1"></i> ${escapeHtml(title)}</h6>`;
        return el;
    }

    function appendEntries(parent, entries, emptyText) {
        if (!entries.length) {
            parent.appendChild(emptyState(emptyText));
            return;
        }
        entries.slice(0, 10).forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'ns-list-item py-1';
            row.innerHTML = `<div class="fw-semibold">${escapeHtml(entry.title)}</div><div class="ns-meta">${escapeHtml(entry.description || '')}</div>`;
            if (frontendApi?.openNote && entry.noteId) row.addEventListener('click', () => frontendApi.openNote(entry.noteId));
            parent.appendChild(row);
        });
    }

    async function loadSummaries() {
        if (!frontendApi?.searchForNotes) return { notes: [], summaries: [], words: 0 };
        const query = '#extTask OR #extStoryDraft OR #extMeeting OR #extEmailDraft OR #extScratch OR #extReportingNotes OR #extProjectHub OR #extPerson OR #extOrganization OR #extTopic';
        const notes = await frontendApi.searchForNotes(query);
        const summaries = (notes || []).map((note) => ({
            noteId: note.noteId,
            title: note.title || 'Untitled',
            dateCreated: timestamp(note, 'dateCreated', 'utcDateCreated'),
            dateModified: timestamp(note, 'dateModified', 'utcDateModified'),
            status: note.getOwnedLabelValue?.('status') || note.getLabelValue?.('status') || '',
        }));
        let words = 0;
        const todayKey = new Date().toDateString();
        for (const note of notes || []) {
            if (new Date(timestamp(note, 'dateModified', 'utcDateModified')).toDateString() !== todayKey) continue;
            if (typeof note.getContent === 'function') words += countWords(await note.getContent());
        }
        return { notes, summaries, words };
    }

    function renderLoadedData({ summaries, words }) {
        const today = new Date();
        const quote = pickDailyQuote(today);
        const goal = settingsEngine.get('writingGoalWords') ?? 500;
        const progress = computeWritingGoalProgress(words, goal);

        const goalCard = insightCard('Writing Goal Progress', 'bx-target-lock');
        goalCard.innerHTML += `<blockquote class="ns-quote mb-3"><p>&ldquo;${escapeHtml(quote.text)}&rdquo;</p><cite class="small text-muted">&mdash; ${escapeHtml(quote.author)}</cite></blockquote>`;
        goalCard.innerHTML += `<div class="ns-progress mb-2"><div class="ns-progress-fill" style="width: ${progress.percent}%"></div></div><div class="ns-meta">${progress.current} / ${progress.goal} words (${progress.remaining} to go)</div>`;

        const activityCard = insightCard('Activity', 'bx-bar-chart-alt-2');
        const weeks = buildActivityHeatmap(summaries.map((entry) => entry.dateCreated), today, 12);
        activityCard.appendChild(weeks.length ? document.createTextNode(`${weeks.flatMap((week) => week.days).reduce((total, day) => total + day.count, 0)} notes across the last 12 weeks.`) : emptyState('No activity found.'));

        const onThisDayCard = insightCard('On This Day', 'bx-history');
        appendEntries(onThisDayCard, findOnThisDay(summaries, today).map((entry) => ({ ...entry, description: `${entry.yearsAgo} year${entry.yearsAgo === 1 ? '' : 's'} ago today` })), 'No historical notes found.');

        const staleCard = insightCard('Needs Attention', 'bx-time-five');
        appendEntries(staleCard, findStaleNotes(summaries, today, settingsEngine.get('staleThresholdDays') ?? 14).map((entry) => ({ ...entry, description: `Untouched for ${entry.daysSinceModified} days` })), 'Nothing has gone stale.');

        const phase = computeMoonPhase(today);
        const moonCard = insightCard('Daily Insights', 'bx-moon');
        moonCard.innerHTML += `<div class="d-flex align-items-center gap-3 my-2"><span class="fs-2"><i class="bx bx-${escapeHtml(phase.icon)}"></i></span><div><div class="fw-bold">${escapeHtml(phase.name)}</div><div class="small text-muted">${Math.round(phase.illumination * 100)}% illumination</div></div></div>`;
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button'; copyBtn.className = 'btn btn-sm btn-outline-primary'; copyBtn.textContent = 'Copy Accomplishments for Standup';
        copyBtn.addEventListener('click', async () => {
            const text = `**Daily Accomplishments (${today.toLocaleDateString('en-CA')})**\n- Writing Progress: ${progress.current}/${progress.goal} words (${progress.percent}%)\n- Moon Phase: ${phase.name} (${Math.round(phase.illumination * 100)}% illumination)`;
            try { await navigator.clipboard?.writeText(text); window.__ikmalToast?.('Copied daily accomplishments to clipboard!', 'success'); } catch {}
        });
        moonCard.appendChild(copyBtn);

        grid.replaceChildren(goalCard, activityCard, onThisDayCard, staleCard, moonCard);
    }

    const loading = insightCard('Loading insights', 'bx-loader-alt');
    loading.appendChild(emptyState('Loading live note activity…'));
    grid.appendChild(loading);
    modelReady.then(() => loadSummaries()).then(renderLoadedData).catch((error) => {
        loading.replaceChildren(emptyState(`Insights unavailable: ${error.message}`));
    });

    outerCard.appendChild(grid);
    shell.appendChild(card);
    containerEl.appendChild(shell);
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.notes-system-insights-root')
            || document.body;
        if (container) {
            initNotesSystemInsights(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
