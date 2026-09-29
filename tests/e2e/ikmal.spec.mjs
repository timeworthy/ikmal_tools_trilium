import { test, expect } from '@playwright/test';
import { TriliumBrowserApi } from './trilium-browser-api.mjs';
import { createE2EFixture, destroyE2EFixtureWithRequest } from './fixtures.mjs';

test.describe('Ikmal Tools visual and workflow coverage', () => {
    test.describe.configure({ mode: 'serial' });

    let api;
    let fixture;

    test.beforeEach(async ({ page }) => {
        api = new TriliumBrowserApi(page);
        await page.goto('/');
        await expect(page).toHaveTitle(/Trilium/i);
        const dashboard = await api.findArtifact('notes-system-dashboard');
        expect(dashboard?.noteId, 'installed Today dashboard artifact').toBeTruthy();
        await api.openNote(dashboard.noteId);
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

    async function tab(page, name) {
        const control = page.getByRole('tab', { name }).first();
        await expect(control).toBeVisible();
        await control.click();
        return control;
    }

    test('Today dashboard exposes quick capture, widgets, edit, and responsive layout', async ({ page }) => {
        const dashboard = page.locator('.notes-system-shell').last();
        await expect(dashboard.getByRole('heading', { name: 'Today Homepage' })).toBeVisible();
        for (const name of ['New Project', 'New Scratch', 'New Meeting', 'New Task', 'New Story', 'New Edit', 'New Email', 'New Person', 'New Org', 'New Topic']) {
            await expect(page.locator('.ns-quick-capture-action').filter({ hasText: name }).first()).toBeVisible();
        }
        for (const heading of ['Open Tasks', 'Overdue Work', 'Due Soon', 'Active Projects', 'High Priority', 'Follow-ups & Replies', 'Stories & Drafts', 'Recently Touched']) {
            await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
        }

        await dashboard.locator('button[aria-pressed]').filter({ hasText: /^\s*Edit\s*$/ }).first().click();
        await expect(dashboard.getByText('Layout', { exact: true })).toBeVisible();
        await expect(dashboard.getByText(/Widgets \(/)).toBeVisible();
        await dashboard.locator('button[aria-pressed]').filter({ hasText: /^\s*Preview\s*$/ }).first().click();
        await expect(dashboard.getByRole('heading', { name: 'Today Homepage' })).toBeVisible();

        await page.setViewportSize({ width: 540, height: 900 });
        await expect(dashboard.getByRole('heading', { name: 'Today Homepage' })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
        expect(overflow, 'the app should not introduce page-level horizontal overflow').toBeTruthy();
        await page.screenshot({ path: `test-results/today-mobile-${Date.now()}.png`, fullPage: true });
    });

    test('Template Studio and Package Settings expose editable controls', async ({ page }) => {
        await tab(page, 'Template Studio');
        await expect(page.getByRole('heading', { name: 'Template Studio' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add rule' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add attribute' }).first()).toBeVisible();
        await expect(page.locator('#tpl-content')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export YAML' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible();

        await tab(page, 'Settings');
        await expect(page.getByRole('heading', { name: 'Package Settings' })).toBeVisible();
        for (const name of ['Auto-execute if/then automation rules', 'Enable derived topic propagation', 'File new notes under today\'s journal note']) {
            const checkbox = page.getByRole('switch', { name }).first();
            await expect(checkbox).toBeVisible();
            const before = await checkbox.isChecked();
            await checkbox.click();
            await expect(checkbox).toBeChecked({ checked: !before });
            await checkbox.click();
            await expect(checkbox).toBeChecked({ checked: before });
        }
        await expect(page.getByRole('textbox', { name: 'Default Quick Capture template ID' })).toBeVisible();
        await expect(page.getByRole('spinbutton', { name: /Stale Notes inactivity threshold/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'System Health & Workspace Maintenance' })).toBeVisible();
        const healthButton = page.getByRole('button', { name: 'Run Health Verification' });
        await expect(healthButton).toBeVisible();
        await healthButton.click();
        await expect(page.getByText(/System verification requires live Trilium session context|All 15 system containers|Found .* missing system element/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Repair Workspace Alignment' })).toBeVisible();
    });

    test('quick capture opens every supported template variation', async ({ page }) => {
        const actions = ['New Task', 'New Meeting', 'New Story', 'New Edit', 'New Email', 'New Project', 'New Scratch', 'New Person', 'New Org', 'New Topic'];
        for (const action of actions) {
            await page.locator('.ns-quick-capture-action').filter({ hasText: action }).first().click();
            await expect(page.locator('.modal.show')).toBeVisible();
            await expect(page.locator('.modal.show .title-input')).toBeVisible();
            await expect(page.locator('.modal.show .create-btn')).toBeVisible();
            await page.locator('.modal.show .close-btn').last().click();
            await expect(page.locator('.modal.show')).toHaveCount(0);
        }
    });

    test('fixture creation appears in the project dashboard surface', async ({ page }) => {
        fixture = await createE2EFixture(api, `pw-${Date.now()}`);
        await api.openNote(fixture.dashboardId);
        // Trilium can retain the previous render context briefly while the
        // cloned dashboard activates. The newest matching panel is the fixture panel.
        const projectPanel = page.locator(`.ikmal-project-dashboard[data-project-hub-id="${fixture.projectId}"]`).last();
        await expect(projectPanel).toBeVisible();
        await expect(projectPanel.getByRole('group', { name: 'Project actions' })).toBeVisible();
        await expect(projectPanel.getByRole('button', { name: 'New task' })).toBeVisible();
        await expect(projectPanel.getByRole('button', { name: 'Archive project' })).toBeVisible();
        await expect(projectPanel.getByText(/Tasks Completed/)).toBeVisible();
        await expect.poll(async () => projectPanel.locator('[data-project-current-round]').textContent())
            .not.toContain('loading');

    });
});

const MICRO_TOOLS = [
    ['notes-system-kanban', /Kanban|To do|In progress/],
    ['notes-system-insights', /Writing|Productivity|Insights/],
    ['notes-system-quick-capture', /Quick Capture Toolbar/],
    ['notes-system-weather', /Weather|location/i],
    ['notes-system-on-this-day', /On This Day|Time Machine/],
    ['notes-system-stale-notes', /Stale|Needs Attention/],
    ['notes-system-canvas', /Canvas|Excalidraw|Interactive Canvas/],
];

for (const [artifact, expected] of MICRO_TOOLS) {
    test(`micro-tool ${artifact} renders its primary surface`, async ({ page }) => {
        const api = new TriliumBrowserApi(page);
        await page.goto('/');
        await expect(page).toHaveTitle(/Trilium/i);
        const note = await api.findArtifact(artifact);
        expect(note?.noteId, `installed artifact ${artifact}`).toBeTruthy();
        await api.openNote(note.noteId);
        const renderedShell = page.locator('.notes-system-shell:visible').filter({ hasText: expected }).first();
        await expect(renderedShell).toBeVisible({ timeout: 15_000 });
    });
}
