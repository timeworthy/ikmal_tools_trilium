import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { TriliumBrowserApi } from './trilium-browser-api.mjs';
import { createE2EFixture, destroyE2EFixtureWithRequest } from './fixtures.mjs';

/*
 * These are deliberately black-box tests. The only setup shortcut is creating
 * a disposable, fixture-labelled note tree through the authenticated frontend;
 * every behavior under test starts with the same click, key press, or field
 * edit a user makes in the rendered bundle and ends by reading the resulting
 * Trilium state or browser artifact.
 */

const WEATHER_RESPONSE = readFileSync(new URL('./weather-response.json', import.meta.url), 'utf8');

const CAPTURE_CASES = [
    { action: 'New Project', marker: 'extProjectHub', content: 'OVERVIEW', noJournal: true },
    { action: 'New Scratch', marker: 'extScratch', content: 'Quick scratchpad' },
    { action: 'New Meeting', marker: 'extMeeting', content: 'AGENDA' },
    { action: 'New Task', marker: 'extTask', content: 'Task description' },
    { action: 'New Story', marker: 'extProjectHub', content: 'OVERVIEW', children: ['HED', 'Reporting Notes'], journalChild: true },
    { action: 'New Edit', marker: 'extProjectHub', content: 'OVERVIEW', children: ['LINKS'], journalChild: true },
    { action: 'New Email', marker: 'extEmailDraft', content: 'RECIPIENTS' },
    { action: 'New Person', marker: 'extPerson', content: 'CONTACT INFO', noJournal: true },
    { action: 'New Org', marker: 'extOrganization', content: 'ABOUT', noJournal: true },
    { action: 'New Topic', marker: 'extTopic', content: 'DESCRIPTION', noJournal: true },
];

const MARKER_FOR_TEMPLATE = {
    projectHub: 'extProjectHub',
    task: 'extTask',
    meeting: 'extMeeting',
    story: 'extStoryDraft',
    edit: 'extStoryDraft',
    email: 'extEmailDraft',
    scratch: 'extScratch',
    person: 'extPerson',
    organization: 'extOrganization',
    topic: 'extTopic',
};

function labelValue(state, name) {
    return state?.labels?.find((label) => label.name === name)?.value ?? '';
}

async function openDashboard(page) {
    const api = new TriliumBrowserApi(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Trilium/i);
    const dashboard = await api.findArtifact('notes-system-dashboard');
    expect(dashboard?.noteId, 'installed dashboard artifact').toBeTruthy();
    await api.openNote(dashboard.noteId);
    await expect(page.getByRole('heading', { name: 'Today Homepage' }).first()).toBeVisible();
    return api;
}

async function waitForTitle(api, marker, title, timeout = 12_000) {
    const deadline = Date.now() + timeout;
    do {
        const notes = await api.search(`#${marker}`);
        const note = notes.find((candidate) => candidate.title === title);
        if (note) return note;
        await api.page.waitForTimeout(250);
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for #${marker} note ${title}`);
}

async function waitForTitlePrefix(api, marker, prefix, timeout = 12_000) {
    const deadline = Date.now() + timeout;
    do {
        const notes = await api.search(`#${marker}`);
        const note = notes.find((candidate) => candidate.title?.startsWith(prefix));
        if (note) return note;
        await api.page.waitForTimeout(250);
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for #${marker} note beginning ${prefix}`);
}

async function findTodayJournal(api) {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const notes = await api.search('#dateNote');
    return notes.find((note) => String(note.title || '').startsWith(iso))
        || (await api.search('#extDailyNote')).find((note) => String(note.title || '').startsWith(iso));
}

async function chooseCombobox(scope, id, label) {
    const input = scope.locator(`#${id}`);
    await expect(input).toBeVisible();
    await input.click();
    const visibleLabel = label.replaceAll('_', ' ');
    await input.fill(visibleLabel);
    // Select the exact visible option produced by the component's own search
    // list. This remains deterministic when the disposable database contains
    // other realistic notes from earlier acceptance actions.
    const option = input.locator('xpath=..').locator('[role="option"]').filter({ hasText: visibleLabel }).first();
    await expect(option).toBeVisible();
    await option.click();
}

async function captureFromDashboard(page, action, title, { projectTitle, relations = {} } = {}) {
    const dashboardShell = page.locator('.notes-system-shell').last();
    await dashboardShell.locator('.ns-quick-capture-action').filter({ hasText: action }).first().click();
    const modal = page.locator('.modal.show').last();
    await expect(modal).toBeVisible();
    await modal.locator('.title-input').fill(title);

    if (projectTitle) {
        const chip = modal.locator('.project-quick-chips button').filter({ hasText: projectTitle }).first();
        if (await chip.count()) await chip.click();
        else await chooseCombobox(modal, 'rel-project', projectTitle);
    }
    for (const [id, label] of Object.entries(relations)) {
        await chooseCombobox(modal, id, label);
    }
    await modal.getByRole('button', { name: /Create/ }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
}

async function assertContainsLabel(state, name, value) {
    expect(state?.labels, `label #${name}`).toEqual(expect.arrayContaining([{ name, value }]));
}

async function assertClone(api, noteId, parentId, expected = true, label = 'note') {
    await expect.poll(async () => (await api.getNoteState(noteId))?.parentNoteIds?.includes(parentId), {
        timeout: 12_000,
        message: `${label} journal branch`,
    }).toBe(expected);
}

test.describe('Ikmal end-to-end acceptance coverage', () => {
    test.describe.configure({ mode: 'serial' });

    let api;
    let fixture;

    test.beforeEach(async ({ page }) => {
        api = await openDashboard(page);
    });

    test.afterEach(async ({ page }) => {
        if (fixture) {
            const fixtureToDelete = fixture;
            fixture = null;
            const context = page.context();
            const origin = new URL(page.url()).origin;
            const headers = await page.evaluate(() => ({
                'x-csrf-token': window.glob?.csrfToken || '',
                'trilium-component-id': window.glob?.componentId || '',
            }));
            await page.close();
            await destroyE2EFixtureWithRequest(context.request, origin, headers, fixtureToDelete);
        }
    });

    test('each dashboard destination creates the advertised artifact from a real UI action', async ({ page }) => {
        fixture = await createE2EFixture(api, `capture-${Date.now()}`);
        const journal = await findTodayJournal(api);
        expect(journal?.noteId, 'today journal fixture').toBeTruthy();
        await page.getByRole('tab', { name: 'Settings' }).first().click();
        const autoJournal = page.getByRole('switch', { name: "File new notes under today's journal note" }).first();
        if (!(await autoJournal.isChecked())) await autoJournal.check();
        await page.getByRole('tab', { name: 'Today' }).first().click();
        await expect(page.getByRole('heading', { name: 'Today Homepage' }).first()).toBeVisible();

        for (const candidate of CAPTURE_CASES) {
            const rawTitle = `${candidate.action} acceptance ${fixture.runId}`;
            const expectedTitle = candidate.action === 'New Meeting' ? `Meeting: ${rawTitle}`
                : candidate.action === 'New Email' ? `Email: ${rawTitle}` : rawTitle;
            await captureFromDashboard(page, candidate.action, rawTitle);
            const created = await waitForTitle(api, candidate.marker, expectedTitle);
            const state = await api.getNoteState(created.noteId);
            expect(state.title).toBe(expectedTitle);
            expect(state.content).toContain(candidate.content);
            expect(state.type).toBeTruthy();
            if (candidate.noJournal) await assertClone(api, created.noteId, journal.noteId, false, candidate.action);
            else if (!candidate.journalChild) await assertClone(api, created.noteId, journal.noteId, true, candidate.action);
            else await assertClone(api, created.noteId, journal.noteId, false, `${candidate.action} hub`);

            if (candidate.children) {
                const children = await Promise.all((state.childNoteIds || []).map((id) => api.getNoteState(id)));
                expect(children.some((child) => child?.content?.includes(candidate.children[0]))).toBeTruthy();
                if (candidate.children[1]) {
                    expect(children.some((child) => child?.title?.includes(candidate.children[1]))).toBeTruthy();
                }
                if (candidate.journalChild) {
                    const draft = children.find((child) => child?.content?.includes(candidate.children[0]));
                    expect(draft?.noteId, `${candidate.action} draft child`).toBeTruthy();
                    await assertClone(api, draft.noteId, journal.noteId, true, `${candidate.action} draft`);
                }
            }
        }
    });

    test('supported destination combinations file work under project, journal, and relation targets', async ({ page }) => {
        fixture = await createE2EFixture(api, `destinations-${Date.now()}`);
        const journal = await findTodayJournal(api);
        const relationCases = [
            { action: 'New Project', template: 'projectHub', relations: { 'rel-client': fixture.titles.organization, 'attr-companyOnBehalf': fixture.titles.organization } },
            { action: 'New Person', template: 'person', relations: { 'rel-organization': fixture.titles.organization, 'rel-employer': fixture.titles.organization } },
            { action: 'New Org', template: 'organization', relations: { 'rel-keyContact': fixture.titles.person } },
            { action: 'New Topic', template: 'topic', relations: { 'attr-aliasOf': fixture.titles.topic } },
        ];
        for (const candidate of relationCases) {
            const rawTitle = `${candidate.action} relation combination ${fixture.runId}`;
            await captureFromDashboard(page, candidate.action, rawTitle, { relations: candidate.relations });
            const expectedTitle = rawTitle;
            const note = await waitForTitle(api, MARKER_FOR_TEMPLATE[candidate.template] || 'extProjectHub', expectedTitle);
            const state = await api.getNoteState(note.noteId);
            for (const [pickerId, targetTitle] of Object.entries(candidate.relations)) {
                const relationName = pickerId.startsWith('attr-') ? pickerId.slice(5) : pickerId.slice(4);
                const target = ['client', 'companyOnBehalf', 'organization', 'employer'].includes(relationName)
                    ? fixture.organizationId
                    : relationName === 'aliasOf' ? fixture.topicId : fixture.personId;
                expect(state.relations).toEqual(expect.arrayContaining([{ name: relationName, value: target }]));
                expect(targetTitle).toBeTruthy();
            }
        }
        const projectCases = [
            { action: 'New Task', template: 'task', attr: { priority: 'high', complexity: 'multi' } },
            { action: 'New Meeting', template: 'meeting', attr: { startDate: '2026-09-11', startTime: '09:45' }, relations: { 'attr-attendee': fixture.titles.person } },
            { action: 'New Story', template: 'story', relations: { 'attr-client': fixture.titles.organization } },
            { action: 'New Edit', template: 'edit' },
            { action: 'New Email', template: 'email', attr: { status: 'awaiting_reply', waitingOn: 'Maya Chen' } },
            { action: 'New Scratch', template: 'scratch' },
        ];

        for (const candidate of projectCases) {
            const rawTitle = `${candidate.action} project combination ${fixture.runId}`;
            await page.locator('.notes-system-shell').last().locator('.ns-quick-capture-action').filter({ hasText: candidate.action }).first().click();
            const modal = page.locator('.modal.show').last();
            await modal.locator('.title-input').fill(rawTitle);
            for (const [name, value] of Object.entries(candidate.attr || {})) {
                const input = modal.locator(`[data-attr="${name}"]`);
                if (await input.count()) await input.fill(value);
                else await chooseCombobox(modal, `attr-${name}`, value);
            }
            await chooseCombobox(modal, 'rel-project', fixture.titles.activeProject);
            for (const [id, label] of Object.entries(candidate.relations || {})) await chooseCombobox(modal, id, label);
            await modal.getByRole('button', { name: /Create/ }).click();
            await expect(page.locator('.modal.show')).toHaveCount(0);

            const marker = MARKER_FOR_TEMPLATE[candidate.template];
            const expectedTitle = candidate.template === 'meeting' ? `Meeting: ${rawTitle}`
                : candidate.template === 'email' ? `Email: ${rawTitle}`
                    : candidate.template === 'story' ? `${rawTitle} — Draft 1`
                        : candidate.template === 'edit' ? `${rawTitle} — Round 1`
                            : rawTitle;
            const note = candidate.template === 'edit'
                ? await waitForTitlePrefix(api, marker, rawTitle)
                : await waitForTitle(api, marker, expectedTitle);
            if (candidate.template === 'edit') expect(note.title).toMatch(new RegExp(`^${rawTitle} — (?:Draft|Round) \\d+$`));
            const state = await api.getNoteState(note.noteId);
            expect(state.content).not.toBe('');
            await assertClone(api, note.noteId, fixture.projectId);
            await assertClone(api, note.noteId, journal.noteId);
            if (candidate.attr) {
                for (const [name, value] of Object.entries(candidate.attr)) await assertContainsLabel(state, name, value);
            }
            for (const [name, label] of Object.entries(candidate.relations || {})) {
                const relationName = name.startsWith('attr-') ? name.slice(5) : name;
                const relation = state.relations.find((item) => item.name === relationName);
                expect(relation?.value, `relation ~${relationName}`).toEqual(expect.any(String));
                if (name === 'attr-attendee') expect(relation.value).toBe(fixture.personId);
            }
        }
    });

    test('quick capture keeps user input on a failed request and succeeds on retry', async ({ page }) => {
        fixture = await createE2EFixture(api, `retry-${Date.now()}`);
        const title = `Retryable capture ${fixture.runId}`;
        let failNextCreate = true;
        let failedPayload;
        await page.route((url) => {
            const parsed = new URL(url);
            return parsed.pathname.endsWith('/children') && parsed.searchParams.get('target') === 'into';
        }, async (route) => {
            if (route.request().method() !== 'POST' || !failNextCreate) return route.continue();
            failedPayload = route.request().postDataJSON();
            failNextCreate = false;
            await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'fixture storage temporarily unavailable' }) });
        });

        await page.locator('.notes-system-shell').last().getByRole('button', { name: 'New Task' }).first().click();
        const modal = page.locator('.modal.show').last();
        await modal.locator('.title-input').fill(title);
        await modal.getByRole('button', { name: /Create/ }).click();
        await expect(modal.locator('.create-error')).toContainText(/Could not create the note/);
        await expect(modal.locator('.title-input')).toHaveValue(title);
        expect(failedPayload.title).toBe(title);
        expect(failedPayload.content).toContain('Task description');
        expect(failedPayload.attributes).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'label', name: 'extTask' }),
            expect.objectContaining({ type: 'label', name: 'status', value: 'todo' }),
        ]));

        await modal.getByRole('button', { name: /Create/ }).click();
        await expect(page.locator('.modal.show')).toHaveCount(0);
        await waitForTitle(api, 'extTask', title);
    });

    test('realistic source notes populate widgets, filters, and persisted Kanban transitions', async ({ page }) => {
        fixture = await createE2EFixture(api, `widgets-${Date.now()}`);
        // The fixture is created after the initial dashboard render. Reopen the
        // same installed artifact so its real search-backed widgets consume the
        // newly created source notes.
        api = await openDashboard(page);
        await expect(page.getByText(fixture.titles.researchTask).first()).toBeVisible();

        const dashboardShell = page.locator('.notes-system-shell').last();
        const filter = dashboardShell.locator('.today-dashboard-filter').first();
        const dashboard = dashboardShell.locator('.today-homepage-wrapper').first();
        await expect(dashboard.locator('.ns-kanban-card, .kanban-card')
            .filter({ hasText: fixture.titles.activeProject }).first()).toBeVisible();
        await filter.fill(fixture.titles.researchTask);
        await expect(dashboard.locator('.kanban-card, .ns-kanban-card').filter({ hasText: fixture.titles.researchTask }).first()).toBeVisible();
        await expect(dashboard.locator('.kanban-card, .ns-kanban-card').filter({ hasText: fixture.titles.writingTask }).first()).toBeHidden();
        await filter.fill('');

        await dashboard.locator('button[aria-pressed]').filter({ hasText: /^\s*Edit\s*$/ }).first().click();
        await dashboard.locator('#journal-width').fill('90');
        await dashboard.locator('#journal-width').blur();
        await expect(dashboard.locator('#journal-width')).toHaveValue('85');
        await dashboard.locator('#grid-columns').selectOption('2');
        await dashboard.locator('#grid-density').selectOption('compact');
        await dashboard.locator('#writing-goal-words').fill('800');
        await dashboard.locator('#writing-goal-words').blur();
        await expect(dashboard.locator('#writing-goal-words')).toHaveValue('800');
        await dashboard.locator('#stale-threshold-days').fill('5');
        await dashboard.locator('#stale-threshold-days').blur();
        await expect(dashboard.locator('#stale-threshold-days')).toHaveValue('5');
        const openTasksRow = dashboard.locator('.ns-list-item').filter({ hasText: 'Open Tasks' }).first();
        await openTasksRow.locator('select').selectOption('2');
        await openTasksRow.getByRole('button', { name: 'Move Open Tasks down' }).click();
        await dashboard.getByRole('button', { name: 'Move Open Tasks up' }).last().click();
        await expect(dashboard).toHaveClass(/ns-compact/);
        const quickBar = dashboard.getByRole('switch', { name: 'Show the quick capture bar' });
        await quickBar.uncheck();
        for (const widgetId of ['activityHeatmap', 'onThisDay', 'writingGoal', 'moonPhase', 'staleNotes']) {
            const widget = dashboard.locator(`#widget-${widgetId}`);
            if (!(await widget.isChecked())) await widget.check();
        }
        await dashboard.locator('button[aria-pressed]').filter({ hasText: /^\s*Preview\s*$/ }).first().click();
        await expect(dashboard.getByText('Quick capture', { exact: true })).toHaveCount(0);
        await expect(dashboard.getByText('Activity', { exact: true })).toBeVisible();
        await expect(dashboard.getByText('On This Day', { exact: true })).toBeVisible();
        await expect(dashboard.getByText('Writing Goal', { exact: true })).toBeVisible();
        await expect(dashboard.getByText('Moon & Daylight', { exact: true })).toBeVisible();
        await expect(dashboard.getByText('Needs Attention', { exact: true })).toBeVisible();
        await expect(dashboard.getByText(fixture.titles.historical).first()).toBeVisible();
        await expect(dashboard.getByText(fixture.titles.staleTask).first()).toBeVisible();
        const staleRow = dashboard.locator('.ns-list-item').filter({ hasText: fixture.titles.staleTask }).last();
        const staleBeforeTouched = await api.getNoteState(fixture.staleTaskId);
        await staleRow.locator('button[title="Mark Touched"]').click();
        const beforeTouchedLabel = labelValue(staleBeforeTouched, 'utcDateModified');
        await expect.poll(async () => labelValue(await api.getNoteState(fixture.staleTaskId), 'utcDateModified'))
            .not.toBe(beforeTouchedLabel);
        await dashboard.locator('button[aria-pressed]').filter({ hasText: /^\s*Edit\s*$/ }).first().click();
        await dashboard.getByRole('switch', { name: 'Show the quick capture bar' }).check();

        const kanbanArtifact = await api.findArtifact('notes-system-kanban');
        expect(kanbanArtifact?.noteId, 'installed standalone Kanban artifact').toBeTruthy();
        await api.openNote(kanbanArtifact.noteId);
        const kanbanShell = page.locator('.notes-system-shell:visible').filter({ has: page.locator('.ns-kanban') }).last();
        const researchCard = kanbanShell.locator('.ns-kanban-card').filter({ hasText: fixture.titles.researchTask });
        await researchCard.locator('button.move-btn[data-target="done"]').click();
        await expect.poll(async () => labelValue(await api.getNoteState(fixture.taskId), 'status')).toBe('done');
        await expect.poll(async () => Boolean(labelValue(await api.getNoteState(fixture.taskId), 'doneDate'))).toBeTruthy();
    });

    test('settings fields persist state, YAML file content, and request payloads', async ({ page }) => {
        await page.getByRole('tab', { name: 'Settings' }).first().click();
        await page.locator('.accent-swatch-btn[title="Emerald"]').click();
        await expect.poll(() => page.locator('html').evaluate((element) => element.style.getPropertyValue('--accent-color'))).toBe('#10b981');
        await page.locator('#card-style-mode').selectOption('solid');
        await expect(page.locator('html')).toHaveAttribute('data-ikmal-card-style', 'solid');
        await page.getByRole('button', { name: 'Run Health Verification' }).click();
        await expect(page.getByText(/All 15 system containers|Found .* missing system element/)).toBeVisible();
        await page.getByRole('button', { name: 'Clean & Auto-Archive Projects' }).click();
        await expect(page.getByText(/Project reconciliation complete|requires live Trilium session context|Project reconciliation error/)).toBeVisible();
        const manifestMatches = await api.search('#packageOwner="iansherr/ikmal_tools_trilium" #packageArtifact="manifest"');
        const manifest = manifestMatches[0] ? await api.getNote(manifestMatches[0].noteId) : null;
        expect(manifest?.noteId, 'package manifest').toBeTruthy();
        api.clearRequestLog();

        for (const [title, color] of [['Indigo', '#6366f1'], ['Royal Blue', '#3b82f6'], ['Emerald', '#10b981'], ['Amber', '#f59e0b'], ['Crimson', '#ef4444']]) {
            await page.locator(`.accent-swatch-btn[title="${title}"]`).click();
            await expect.poll(() => page.locator('html').evaluate((element) => element.style.getPropertyValue('--accent-color'))).toBe(color);
        }

        const autoJournal = page.getByRole('switch', { name: "File new notes under today's journal note" });
        const original = await autoJournal.isChecked();
        await autoJournal.click();
        await expect(autoJournal).toBeChecked({ checked: !original });
        await expect.poll(async () => labelValue(await api.getNoteState(manifest.noteId), 'packageSetting:autoJournalClone')).toBe(JSON.stringify(!original));
        expect(api.requestsMatching(/set-attribute/).some((request) => request.postData?.name === 'packageSetting:autoJournalClone')).toBeTruthy();
        await autoJournal.click();

        for (const [label, key] of [
            ['Auto-execute if/then automation rules', 'autoRunIfThenRulesOnCreation'],
            ['Enable derived topic propagation', 'enableDerivedTopics'],
        ]) {
            const toggle = page.getByRole('switch', { name: label });
            const before = await toggle.isChecked();
            await toggle.click();
            await expect(toggle).toBeChecked({ checked: !before });
            await expect.poll(async () => labelValue(await api.getNoteState(manifest.noteId), `packageSetting:${key}`)).toBe(JSON.stringify(!before));
            await toggle.click();
        }

        await page.locator('#default-capture-tpl').fill('meeting');
        await page.locator('#default-capture-tpl').blur();
        await page.locator('#stale-threshold-input').fill('21');
        await page.locator('#stale-threshold-input').blur();
        await page.locator('#writing-goal-input').fill('750');
        await page.locator('#writing-goal-input').blur();
        await expect.poll(async () => labelValue(await api.getNoteState(manifest.noteId), 'packageSetting:defaultQuickCaptureTemplate')).toBe('meeting');
        await expect.poll(async () => labelValue(await api.getNoteState(manifest.noteId), 'packageSetting:staleThresholdDays')).toBe('21');
        await expect.poll(async () => labelValue(await api.getNoteState(manifest.noteId), 'packageSetting:writingGoalWords')).toBe('750');

        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.getByRole('button', { name: 'Copy Spec' }).click();
        await expect(page.getByText('Specification copied to clipboard.')).toBeVisible();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toContain('templates:');

        const validYaml = await page.locator('.ns-code').first().inputValue();
        await page.locator('.ns-code').first().fill(validYaml.replace('columns: auto', 'columns: 2'));
        await page.getByRole('button', { name: 'Save specification' }).click();
        await expect(page.getByText(/Applied homepage layout|Loaded the starter specification/)).toBeVisible();
        await expect.poll(async () => labelValue(await api.getNoteState(manifest.noteId), 'packageData:yamlSpecification')).not.toBe('');
        const persistedYaml = JSON.parse(labelValue(await api.getNoteState(manifest.noteId), 'packageData:yamlSpecification'));
        expect(persistedYaml).toContain('packageId: iansherr/ikmal_tools_trilium');

        await page.getByRole('button', { name: 'Export Single Template' }).click();
        const exportModal = page.locator('[role="dialog"]').last();
        await expect(exportModal).toBeVisible();
        await expect(exportModal.locator('.export-tpl-out')).toHaveValue(/id: task/);
        const exportedTemplate = await exportModal.locator('.export-tpl-out').inputValue();
        await exportModal.getByRole('button', { name: /Copy Template YAML/ }).click();
        await expect(page.getByText(/exported to clipboard/i)).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('id: task');

        await page.getByRole('button', { name: 'Import Single Template' }).click();
        const singleImportModal = page.locator('[role="dialog"]').last();
        await singleImportModal.locator('.import-tpl-input').fill(exportedTemplate);
        await singleImportModal.getByRole('button', { name: 'Import Template' }).click();
        await expect(page.getByText(/Successfully imported template/)).toBeVisible();

        // Restore mutable package settings for the next acceptance scenario.
        await page.locator('#default-capture-tpl').fill('task');
        await page.locator('#default-capture-tpl').blur();
        await page.locator('#stale-threshold-input').fill('14');
        await page.locator('#stale-threshold-input').blur();
        await page.locator('#writing-goal-input').fill('500');
        await page.locator('#writing-goal-input').blur();
    });

    test('Template Studio edits, preview, import/export, category, rule, relationship, and attribute controls', async ({ page }) => {
        await page.getByRole('tab', { name: 'Template Studio' }).first().click();
        await page.locator('button[aria-pressed]').filter({ hasText: /^\s*Preview\s*$/ }).first().click();
        await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue(/Sample Note Title/);
        await page.getByRole('button', { name: /Schema/ }).click();

        const originalSchema = {
            title: await page.locator('#tpl-title').inputValue(),
            pattern: await page.locator('#tpl-pattern').inputValue(),
            icon: await page.locator('#tpl-icon').inputValue(),
            content: await page.locator('#tpl-content').inputValue(),
        };
        await page.locator('#tpl-title').fill('Acceptance Task Schema');
        await page.locator('#tpl-pattern').fill('Acceptance: {title}');
        await page.locator('#tpl-icon').fill('check');
        await page.locator('#tpl-content').fill('<h2>ACCEPTANCE BODY</h2><p>Schema content loaded through the editor.</p>');
        await chooseCombobox(page, 'tpl-category', 'Draft & Editorial');
        await page.getByRole('button', { name: 'Save template' }).click();
        await expect(page.getByRole('heading', { name: 'Acceptance Task Schema' })).toBeVisible();
        await expect(page.locator('#tpl-content')).toHaveValue(/ACCEPTANCE BODY/);
        await page.locator('#tpl-title').fill(originalSchema.title);
        await page.locator('#tpl-pattern').fill(originalSchema.pattern);
        await page.locator('#tpl-icon').fill(originalSchema.icon);
        await page.locator('#tpl-content').fill(originalSchema.content);
        await chooseCombobox(page, 'tpl-category', 'Work & Project Scoped');
        await page.getByRole('button', { name: 'Save template' }).click();
        await page.getByRole('button', { name: 'Split Preview: OFF' }).click();
        await expect(page.locator('#tpl-content')).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible();
        await page.getByRole('button', { name: 'Split Preview: ON' }).click();

        await page.getByRole('button', { name: 'Add attribute' }).click();
        const attrModal = page.locator('[role="dialog"]').last();
        const attrName = `acceptance_${Date.now()}`;
        await attrModal.locator('#attr-name').fill(attrName);
        await attrModal.locator('#attr-kind').selectOption('label');
        await attrModal.locator('#attr-type').selectOption('number');
        await attrModal.getByRole('button', { name: 'Add attribute' }).click();
        await expect(page.getByText(`#${attrName}`, { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Add rule', exact: true }).first().click();
        const ruleModal = page.locator('[role="dialog"]').last();
        await ruleModal.locator('#rule-name').fill(`Acceptance rule ${Date.now()}`);
        await ruleModal.locator('#rule-desc').fill('Loaded from an end-to-end user workflow.');
        await ruleModal.locator('#rule-action').selectOption('prependContent');
        await ruleModal.locator('#param-lval').fill('<p>Acceptance checklist</p>');
        await ruleModal.getByRole('button', { name: /Save rule|Create rule|Confirm/ }).click();
        await expect(page.getByText('Loaded from an end-to-end user workflow.').first()).toBeVisible();

        await page.getByRole('button', { name: 'Add parent link' }).click();
        const relationModal = page.locator('[role="dialog"]').last();
        await relationModal.locator('#rel-name').fill('acceptanceParent');
        await relationModal.getByRole('button', { name: 'Save link' }).click();
        await expect(page.getByText('~acceptanceParent').first()).toBeVisible();

        await page.getByRole('button', { name: 'Export YAML' }).click();
        const templateModal = page.locator('[role="dialog"]').last();
        await expect(templateModal.locator('.yaml-export-text')).toHaveValue(/defaultContent|attributes/);
        const exportedTemplate = await templateModal.locator('.yaml-export-text').inputValue();
        await templateModal.getByLabel('Close').click();

        await page.getByRole('button', { name: 'Import template' }).click();
        const importModal = page.locator('[role="dialog"]').last();
        await importModal.locator('#import-yaml-input').fill(exportedTemplate);
        await importModal.getByRole('button', { name: 'Import Template' }).click();
        await expect(page.locator('.ns-modal-backdrop')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Template Studio' })).toBeVisible();

        await page.getByRole('button', { name: 'Categories' }).click();
        await page.getByRole('button', { name: 'New category' }).click();
        const categoryModal = page.locator('[role="dialog"]').last();
        const categoryTitle = `Acceptance Category ${Date.now()}`;
        await categoryModal.locator('#cat-title').fill(categoryTitle);
        await categoryModal.locator('#cat-desc').fill('A category created by a complete browser workflow.');
        await categoryModal.getByRole('button', { name: 'Create category' }).click();
        await expect(page.getByRole('heading', { name: categoryTitle })).toBeVisible();
        await page.locator('#cat-root').fill('unassignedRoot');
        await page.getByRole('switch', { name: "File under today's journal note" }).uncheck();
        await page.getByRole('switch', { name: 'Inherit parent topics and metadata' }).uncheck();
        await page.getByRole('switch', { name: 'Require a project hub' }).check();
        await page.getByRole('button', { name: 'Save category' }).click();
        await expect(page.getByText(/Default root container/)).toBeVisible();

        await page.getByRole('button', { name: 'Templates' }).click();
    });

    test('project dashboard controls persist child creation, report artifact, archive, reopen, and failure status', async ({ page }) => {
        test.setTimeout(90_000);
        fixture = await createE2EFixture(api, `project-${Date.now()}`);
        await api.openNote(fixture.dashboardId);
        const panel = page.locator(`.ikmal-project-dashboard[data-project-hub-id="${fixture.projectId}"]`).last();
        await expect(panel).toBeVisible();

        await panel.getByRole('button', { name: 'New round' }).click();
        const roundModal = page.locator('.modal.show').last();
        const roundTitle = `Editorial round ${fixture.runId}`;
        await roundModal.locator('.title-input').fill(roundTitle);
        await roundModal.getByRole('button', { name: /Create/ }).click();
        await expect.poll(async () => (await api.search('#extStoryDraft')).some((note) => note.title.startsWith(roundTitle))).toBeTruthy();
        const round = (await api.search('#extStoryDraft')).find((note) => note.title.startsWith(roundTitle));
        const roundState = await api.getNoteState(round.noteId);
        await assertContainsLabel(roundState, 'round', '1');
        expect(roundState.relations).toEqual(expect.arrayContaining([{ name: 'project', value: fixture.projectId }]));
        await assertClone(api, round.noteId, fixture.projectId);

        // Creating the round can refresh the active render context. Reopen the
        // hub before the next user action so the task click targets a live panel.
        await api.openNote(fixture.dashboardId);
        const taskPanel = page.locator(`.ikmal-project-dashboard[data-project-hub-id="${fixture.projectId}"]`)
            .filter({ hasText: roundTitle }).last();
        await taskPanel.getByRole('button', { name: 'New task' }).click();
        await expect.poll(async () => (await api.search('#extTask')).some((note) => note.title === 'New project task')).toBeTruthy();
        const taskCandidates = (await api.search('#extTask')).filter((note) => note.title === 'New project task');
        let newTask;
        for (const candidate of taskCandidates) {
            const candidateState = await api.getNoteState(candidate.noteId);
            if (candidateState?.relations?.some((relation) =>
                relation.name === 'project' && relation.value === fixture.projectId
            )) {
                newTask = candidate;
                break;
            }
        }
        expect(newTask, 'task created by the visible project dashboard').toBeTruthy();
        const newTaskState = await api.getNoteState(newTask.noteId);
        await assertContainsLabel(newTaskState, 'status', 'todo');
        expect(newTaskState.relations).toEqual(expect.arrayContaining([{ name: 'project', value: fixture.projectId }]));
        await assertClone(api, newTask.noteId, fixture.projectId);

        // Branch updates can cause Trilium to replace the rendered panel while
        // keeping the same project in another visible pane. Reopen the hub as
        // a user would, then target this run's unique round title.
        await api.openNote(fixture.dashboardId);
        const projectPanel = page.locator(`.ikmal-project-dashboard[data-project-hub-id="${fixture.projectId}"]`)
            .filter({ hasText: roundTitle }).last();
        const popup = page.waitForEvent('popup');
        await projectPanel.locator('button[data-project-action="export-summary"]').click({ force: true });
        const report = await popup;
        await expect(report.locator('h1')).toContainText(fixture.titles.activeProject);
        await expect(report.locator('body')).toContainText('Tasks Completed');

        await projectPanel.getByRole('button', { name: 'Archive project' }).click();
        await expect(projectPanel.getByText('complete', { exact: true })).toBeVisible();
        await expect.poll(async () => labelValue(await api.getNoteState(fixture.projectId), 'status')).toBe('complete');
        const archiveRoot = (await api.search('#archiveProjectRoot'))[0];
        const activeRoot = (await api.search('#activeProjectRoot'))[0];
        await assertClone(api, fixture.projectId, archiveRoot.noteId);
        await assertClone(api, fixture.projectId, activeRoot.noteId, false);

        await page.evaluate(() => { window.__ikmalToast = () => {}; });
        await projectPanel.getByRole('button', { name: 'Reopen project' }).click();
        await expect(projectPanel.getByText('active', { exact: true })).toBeVisible();
        await expect.poll(async () => labelValue(await api.getNoteState(fixture.projectId), 'status')).toBe('active');
        await assertClone(api, fixture.projectId, activeRoot.noteId);

        // Reopen can refresh the project tab and discard the neighboring
        // homepage shell. Navigate to the installed homepage artifact before
        // exercising its visible repair-error path.
        const todayArtifact = await api.findArtifact('notes-system-dashboard');
        await api.openNote(todayArtifact.noteId);
        await page.evaluate(() => { window.__ikmal_workspace_repair = async () => { throw new Error('simulated repair outage'); }; });
        await page.getByRole('tab', { name: 'Settings' }).first().click();
        await page.getByRole('button', { name: 'Repair Workspace Alignment' }).click();
        await expect(page.getByText('Repair error: simulated repair outage')).toBeVisible();
    });

    test('weather request payload, visible failure, and retry use the configured destination', async ({ page }) => {
        let attempts = 0;
        const weatherUrls = [];
        await page.route('https://api.open-meteo.com/**', async (route) => {
            attempts += 1;
            weatherUrls.push(route.request().url());
            if (attempts === 1) await route.fulfill({ status: 503, body: 'service unavailable' });
            else await route.fulfill({ status: 200, contentType: 'application/json', body: WEATHER_RESPONSE });
        });

        const dashboard = page.locator('.notes-system-shell').filter({ hasText: 'Today Homepage' }).last();
        await page.locator('button[aria-pressed]').filter({ hasText: /^\s*Edit\s*$/ }).first().click();
        await page.locator('#weather-label').fill('Northstar field office');
        await page.locator('#weather-lat').fill('37.8715');
        await page.locator('#weather-lat').blur();
        await page.locator('#weather-lon').fill('-122.2730');
        await page.locator('#weather-lon').blur();
        await page.locator('#weather-units').selectOption('metric');
        await page.context().grantPermissions(['geolocation']);
        await page.context().setGeolocation({ latitude: 38.5816, longitude: -121.4944 });
        await page.getByRole('button', { name: 'Use my current location' }).click();
        await expect(page.locator('#weather-lat')).toHaveValue('38.5816');
        await expect(page.locator('#weather-lon')).toHaveValue('-121.4944');
        const weatherToggle = page.locator('#widget-weather');
        if (!(await weatherToggle.isChecked())) await weatherToggle.check();
        await page.locator('button[aria-pressed]').filter({ hasText: /^\s*Preview\s*$/ }).first().click();
        await expect(page.getByText(/Could not load the forecast/)).toBeVisible();
        await expect.poll(() => attempts).toBe(1);
        await page.getByRole('button', { name: /Retry/ }).first().click();
        await expect(page.getByText('Partly cloudy')).toBeVisible();
        await expect.poll(() => attempts).toBe(2);
        expect(weatherUrls.some((url) => url.includes('latitude=38.5816') && url.includes('longitude=-121.4944'))).toBeTruthy();
    });

    test('standalone sources and micro-tool controls produce observable results', async ({ page }) => {
        fixture = await createE2EFixture(api, `micro-${Date.now()}`);
        const standalone = await api.findArtifact('notes-system-quick-capture');
        await api.openNote(standalone.noteId);
        const toolbar = page.locator('.notes-system-shell:visible').filter({ hasText: 'Quick Capture Toolbar' }).first();
        await expect(toolbar.getByRole('heading', { name: 'Quick Capture Toolbar' })).toBeVisible();
        const toolbarActions = toolbar.locator('.ns-actions button');
        expect(await toolbarActions.count()).toBeGreaterThanOrEqual(5);
        await toolbarActions.filter({ hasText: /^\s*Task\s*$/ }).first().click();
        await expect(page.locator('.modal.show .title-input')).toBeVisible();
        await page.locator('.modal.show .title-input').fill(`Toolbar task ${fixture.runId}`);
        await page.locator('.modal.show').getByRole('button', { name: /Create/ }).click();
        await waitForTitle(api, 'extTask', `Toolbar task ${fixture.runId}`);
        const toolbarCases = [
            { label: 'Diagram & Whiteboard', marker: 'extCanvas', suffix: ' (Diagram)' },
            { label: 'Project Task', marker: 'extTask', suffix: '' },
            { label: 'Meeting', marker: 'extMeeting', suffix: 'Meeting: ' },
            { label: 'Meeting Prep', marker: 'extMeeting', suffix: 'Meeting Prep: ' },
            { label: 'Story Project', marker: 'extProjectHub', suffix: '' },
        ];
        for (const candidate of toolbarCases) {
            const rawTitle = `Toolbar ${candidate.label} ${fixture.runId}`;
            await toolbarActions.filter({ hasText: candidate.label }).first().click();
            const modal = page.locator('.modal.show').last();
            await modal.locator('.title-input').fill(rawTitle);
            await modal.getByRole('button', { name: /Create/ }).click();
            const expectedTitle = candidate.suffix === ' (Diagram)' ? `${rawTitle}${candidate.suffix}` : `${candidate.suffix}${rawTitle}`;
            const created = await waitForTitle(api, candidate.marker, expectedTitle);
            expect((await api.getNoteState(created.noteId)).content).toBeDefined();
        }

        const kanban = await api.findArtifact('notes-system-kanban');
        await api.openNote(kanban.noteId);
        await expect(page.getByRole('heading', { name: 'Task Kanban Board' })).toBeVisible();
        await page.getByRole('button', { name: 'High Priority' }).click();
        await expect(page.getByText(fixture.titles.researchTask)).toBeVisible();
        await expect(page.locator('.filter-pill').filter({ hasText: 'High Priority' })).toHaveClass(/btn-primary/);
        const boardCard = page.locator('.ns-kanban-card').filter({ hasText: fixture.titles.researchTask });
        await boardCard.locator('button.move-btn[data-target="in_progress"]').click();
        await expect.poll(async () => labelValue(await api.getNoteState(fixture.taskId), 'status')).toBe('in_progress');

        const canvas = await api.findArtifact('notes-system-canvas');
        await api.openNote(canvas.noteId);
        await page.getByRole('button', { name: 'Flowchart' }).click();
        await expect(page.getByText('1. Receive Input')).toBeVisible();
        await page.getByRole('button', { name: 'Architecture' }).click();
        await expect(page.getByText('Backend Handler')).toBeVisible();
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await expect(page.locator('#canvas-nodes-container')).toHaveAttribute('data-zoom', '1.1');
        await page.getByRole('button', { name: 'Zoom out' }).click();
        await expect(page.locator('#canvas-nodes-container')).toHaveAttribute('data-zoom', '1');

        const insights = await api.findArtifact('notes-system-insights');
        await api.openNote(insights.noteId);
        await expect(page.getByText('Daily Productivity & Writing Insights')).toBeVisible();
        await expect(page.getByText(/notes across the last 12 weeks|No activity found/)).toBeVisible();
        await page.getByRole('button', { name: 'Copy Accomplishments for Standup' }).click();
        await expect(page.getByText('Copied daily accomplishments to clipboard!')).toBeVisible();

        const onThisDay = await api.findArtifact('notes-system-on-this-day');
        await api.openNote(onThisDay.noteId);
        await expect(page.getByText(fixture.titles.historical)).toBeVisible();
        await page.locator(`button[title="Open ${fixture.titles.historical}"]`).click();

        const stale = await api.findArtifact('notes-system-stale-notes');
        await api.openNote(stale.noteId);
        const staleShell = page.locator('.notes-system-shell:visible').filter({ hasText: 'Stale Notes' }).first();
        await expect(staleShell.getByText(fixture.titles.staleTask).first()).toBeVisible();
        await expect(staleShell.locator(`button[title="Open ${fixture.titles.staleTask}"]`)).toBeVisible();
    });
});
