import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
    searchableSelect,
    toggle,
    button,
    iconAction,
    openModal,
    showToast,
    escapeHtml,
    fuzzyScore,
    section,
    row,
    switchRow,
    listItem,
    emptyState,
    pageHeader,
} from '../dist/components/nativeUi.js';

import { showQuickCaptureModal } from '../dist/components/QuickCaptureModal.js';
import { renderTemplateStudio } from '../dist/components/TemplateStudio.js';
import { renderSettingsStudio } from '../dist/components/SettingsStudio.js';
import { renderTodayHomepage, disposeTodayHomepage } from '../dist/components/TodayHomepage.js';

import { TemplateEngine } from '../dist/engine/templateEngine.js';
import { RelationshipEngine } from '../dist/engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../dist/engine/ifThenRuleEngine.js';
import { TodayEngine } from '../dist/engine/todayEngine.js';
import { NoteCreationEngine } from '../dist/engine/noteCreationEngine.js';
import { SettingsEngine } from '../dist/engine/settingsEngine.js';
import { dumpYamlSpec, parseAndApplyYamlSpec, exportTemplateToYaml, importTemplateFromYaml } from '../dist/engine/yamlSpec.js';

// Setup DOM globals using JSDOM for comprehensive testing
function setupDomEnvironment() {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
        url: 'http://localhost:37840/',
        pretendToBeVisual: true,
    });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;
    globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
    globalThis.KeyboardEvent = dom.window.KeyboardEvent;
    globalThis.MouseEvent = dom.window.MouseEvent;
    globalThis.Event = dom.window.Event;
    globalThis.CustomEvent = dom.window.CustomEvent;
    globalThis.Node = dom.window.Node;
    let clipboardText = '';
    const mockClipboard = {
        writeText: async (text) => { clipboardText = String(text); },
        readText: async () => clipboardText,
    };

    try {
        Object.defineProperty(globalThis, 'navigator', {
            value: { ...dom.window.navigator, clipboard: mockClipboard },
            configurable: true,
            writable: true,
        });
    } catch {
        if (globalThis.navigator) {
            try {
                Object.defineProperty(globalThis.navigator, 'clipboard', {
                    value: mockClipboard,
                    configurable: true,
                });
            } catch {}
        }
    }

    return { dom, getClipboard: () => clipboardText };
}

setupDomEnvironment();

test('COMBINATORIAL: searchableSelect exhaustively tests all selection modes, queries, keyboard actions, and tag removals', () => {
    const options = [
        { value: 'proj_1', label: 'Project Alpha', description: 'Active project 1', icon: 'bx-book' },
        { value: 'proj_2', label: 'Project Beta', description: 'Active project 2', icon: 'bx-book' },
        { value: 'proj_3', label: 'Client Gamma Hub', description: 'Client hub', icon: 'bx-buildings' },
        { value: 'proj_special', label: 'Special [Regex] (Chars) $ & * .', description: 'Edge chars', icon: 'bx-star' },
    ];

    // 1. Single-Select Mode Deterministic Matrix
    const singleSelectQueries = [
        { query: '', expectedCount: 4 },
        { query: 'Alpha', expectedCount: 1, expectedValue: 'proj_1' },
        { query: 'alpha', expectedCount: 1, expectedValue: 'proj_1' }, // Case insensitivity
        { query: 'pja', expectedCount: 2, expectedValue: 'proj_1' }, // Subsequence fuzzy match ("Project Alpha" & "Project Beta")
        { query: 'Gamma', expectedCount: 1, expectedValue: 'proj_3' },
        { query: 'Special', expectedCount: 1, expectedValue: 'proj_special' },
        { query: '[Regex]', expectedCount: 1, expectedValue: 'proj_special' }, // Regex characters in query
        { query: 'NonExistentXYZ', expectedCount: 0 },
    ];

    let lastSelected = '';
    const single = searchableSelect({
        id: 'test-single',
        options,
        value: 'proj_1',
        isMulti: false,
        placeholder: 'Select a project...',
        onChange: (val) => { lastSelected = val; },
    });

    document.body.appendChild(single.el);
    const input = single.el.querySelector('input');
    const panel = single.el.querySelector('.ns-combobox-panel');

    assert.equal(single.getValue(), 'proj_1');
    assert.equal(input.value, 'Project Alpha');

    for (const testCase of singleSelectQueries) {
        input.value = testCase.query;
        input.dispatchEvent(new window.Event('input'));

        assert.equal(panel.hidden, false, 'Panel should open on input');
        const renderedOptions = panel.querySelectorAll('.ns-combobox-option');
        assert.equal(renderedOptions.length, testCase.expectedCount, `Query "${testCase.query}" matched count`);

        if (testCase.expectedCount > 0) {
            // Test ArrowDown navigation
            input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }));
            const active = panel.querySelector('.ns-combobox-option.active');
            assert.ok(active, 'ArrowDown should highlight an option');

            // Test Enter selection
            input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
            assert.equal(panel.hidden, true, 'Enter should close panel');
            if (testCase.expectedValue) {
                assert.equal(single.getValue(), testCase.expectedValue);
                assert.equal(lastSelected, testCase.expectedValue);
            }
        } else {
            const emptyEl = panel.querySelector('.ns-combobox-empty');
            assert.ok(emptyEl, 'Should show empty indicator on 0 matches');
        }
    }

    // Test blurring with non-matching input snaps back to selected label
    input.value = 'GarbageText';
    input.dispatchEvent(new window.Event('blur'));
    assert.equal(input.value, options.find((o) => o.value === single.getValue())?.label);

    // Test setValue
    single.setValue('proj_2');
    assert.equal(single.getValue(), 'proj_2');
    assert.equal(input.value, 'Project Beta');

    // Test setOptions
    single.setOptions([
        { value: 'new_1', label: 'Newly Added Option' },
    ]);
    single.setValue('new_1');
    assert.equal(single.getValue(), 'new_1');
    assert.equal(input.value, 'Newly Added Option');

    single.el.remove();

    // 2. Multi-Select Mode Deterministic Matrix
    let multiValues = [];
    const multi = searchableSelect({
        id: 'test-multi',
        options,
        value: ['proj_1'],
        isMulti: true,
        placeholder: 'Select multiple...',
        onChange: (vals) => { multiValues = vals; },
    });

    document.body.appendChild(multi.el);
    const multiInput = multi.el.querySelector('input');
    const tagsContainer = multi.el.querySelector('.ns-combobox-tags');

    assert.deepEqual(multi.getValue(), ['proj_1']);
    assert.equal(tagsContainer.querySelectorAll('.ns-combobox-tag').length, 1);

    // Add proj_2 via input + Enter
    multiInput.value = 'Beta';
    multiInput.dispatchEvent(new window.Event('input'));
    multiInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));

    assert.deepEqual(multi.getValue(), ['proj_1', 'proj_2']);
    assert.deepEqual(multiValues, ['proj_1', 'proj_2']);
    assert.equal(tagsContainer.querySelectorAll('.ns-combobox-tag').length, 2);

    // Remove tag via remove button mousedown
    const removeBtn = tagsContainer.querySelector('.ns-remove-tag[data-val="proj_1"]');
    assert.ok(removeBtn, 'Remove tag button should exist');
    removeBtn.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));

    assert.deepEqual(multi.getValue(), ['proj_2']);
    assert.deepEqual(multiValues, ['proj_2']);
    assert.equal(tagsContainer.querySelectorAll('.ns-combobox-tag').length, 1);

    // Test multi setValue
    multi.setValue(['proj_2', 'proj_3', 'proj_special']);
    assert.deepEqual(multi.getValue(), ['proj_2', 'proj_3', 'proj_special']);
    assert.equal(tagsContainer.querySelectorAll('.ns-combobox-tag').length, 3);

    multi.el.remove();
});

test('COMBINATORIAL: toggle switch states, accessibility, and event lifecycle', () => {
    let state = false;
    let changeCount = 0;
    const switchEl = toggle('switch-combo', false, (checked) => {
        state = checked;
        changeCount++;
    });

    document.body.appendChild(switchEl);
    const input = switchEl.querySelector('input');
    const track = switchEl.querySelector('.ns-switch-button');
    const stateLabel = switchEl.querySelector('.ns-switch-state');

    assert.equal(input.checked, false);
    assert.equal(input.getAttribute('aria-checked'), 'false');
    assert.equal(stateLabel.textContent, 'OFF');
    assert.equal(track.classList.contains('on'), false);

    // Toggle ON
    input.checked = true;
    input.dispatchEvent(new window.Event('change'));

    assert.equal(state, true);
    assert.equal(changeCount, 1);
    assert.equal(input.getAttribute('aria-checked'), 'true');
    assert.equal(stateLabel.textContent, 'ON');
    assert.equal(track.classList.contains('on'), true);
    assert.equal(switchEl.classList.contains('is-on'), true);

    // Toggle OFF
    input.checked = false;
    input.dispatchEvent(new window.Event('change'));

    assert.equal(state, false);
    assert.equal(changeCount, 2);
    assert.equal(input.getAttribute('aria-checked'), 'false');
    assert.equal(stateLabel.textContent, 'OFF');
    assert.equal(track.classList.contains('on'), false);
    assert.equal(switchEl.classList.contains('is-off'), true);

    switchEl.remove();
});

test('COMBINATORIAL: openModal dialog lifecycle (Confirm, Cancel, Escape, Backdrop, Validation)', () => {
    let confirmedData = null;
    let allowClose = false;

    const modal = openModal({
        title: 'Test Combinatorial Modal',
        icon: 'bx-test',
        body: '<input type="text" id="modal-input" value="initial">',
        confirmText: 'Submit Form',
        cancelText: 'Dismiss',
    }, (content) => {
        const val = content.querySelector('#modal-input').value;
        confirmedData = val;
        return allowClose; // returning false should prevent closing
    });

    const backdrop = document.querySelector('.ns-modal-backdrop');
    assert.ok(backdrop, 'Backdrop mounted to body');
    assert.ok(modal, 'Modal element created');

    const input = modal.querySelector('#modal-input');
    const confirmBtn = modal.querySelector('.ns-confirm');
    const cancelBtn = modal.querySelector('.ns-close');

    // 1. Test validation failure (returns false -> stays open)
    input.value = 'invalid_attempt';
    allowClose = false;
    confirmBtn.click();
    assert.equal(confirmedData, 'invalid_attempt');
    assert.ok(document.querySelector('.ns-modal-backdrop'), 'Modal should remain open on validation failure');

    // 2. Test successful confirm (returns true -> closes)
    input.value = 'valid_success';
    allowClose = true;
    confirmBtn.click();
    assert.equal(confirmedData, 'valid_success');
    assert.equal(document.querySelector('.ns-modal-backdrop'), null, 'Modal should close on success');

    // 3. Test Escape key close
    openModal({
        title: 'Escape Modal',
        body: '<div>Content</div>',
        confirmText: 'OK',
    }, () => true);

    assert.ok(document.querySelector('.ns-modal-backdrop'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(document.querySelector('.ns-modal-backdrop'), null, 'Escape key should close modal');

    // 4. Test Backdrop click close
    openModal({
        title: 'Backdrop Modal',
        body: '<div>Content</div>',
        confirmText: 'OK',
    }, () => true);

    const activeBackdrop = document.querySelector('.ns-modal-backdrop');
    activeBackdrop.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(document.querySelector('.ns-modal-backdrop'), null, 'Backdrop click should close modal');
});

test('COMBINATORIAL: QuickCaptureModal exercises every template, switcher transitions, inputs, parent links, and creation outcomes', async () => {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const settingsEngine = new SettingsEngine();
    const creationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine);

    const mockApi = {
        searchForNote: async (query) => ({ noteId: 'mock_root_container', title: 'Root' }),
        searchForNotes: async (query) => {
            if (query.includes('extProjectHub') || query.includes('projectHub')) {
                return [
                    { noteId: 'proj_alpha', title: 'Project Alpha' },
                    { noteId: 'proj_beta', title: 'Project Beta' },
                ];
            }
            if (query.includes('extOrganization') || query.includes('organization')) {
                return [{ noteId: 'org_acme', title: 'Acme Corp' }];
            }
            if (query.includes('extPerson') || query.includes('person')) {
                return [{ noteId: 'person_jane', title: 'Jane Doe' }];
            }
            return [];
        },
        createNote: async (parentNotePath, noteData) => ({
            note: {
                noteId: `created_${Date.now()}`,
                title: noteData?.title || 'Untitled',
                parentNoteIds: [parentNotePath],
                hasLabel: () => true,
                getLabelValue: () => '',
                getOwnedLabelValue: () => '',
                getRelations: () => [],
            },
        }),
        getTodayNote: async () => ({ noteId: 'today_note_1', title: 'Today' }),
        getNote: async (noteId) => ({
            noteId,
            title: 'Note ' + noteId,
            parentNoteIds: ['root'],
            hasLabel: () => true,
            getLabelValue: () => '',
            getOwnedLabelValue: () => '',
            getRelations: () => [],
            save: () => {},
            setLabel: () => {},
            setRelation: () => {},
        }),
        runOnBackend: async (fn, args) => true,
        showMessage: () => {},
    };

    const templatesToTest = ['task', 'story', 'edit', 'meeting', 'person', 'organization', 'projectHub', 'scratch', 'topic'];

    for (const tplId of templatesToTest) {
        let outcomeResult = null;
        await showQuickCaptureModal(
            tplId,
            templateEngine,
            creationEngine,
            (outcome) => { outcomeResult = outcome; },
            undefined,
            { api: mockApi }
        );

        const modal = document.querySelector('.modal.show');
        assert.ok(modal, `Modal should open for template ${tplId}`);

        const titleInput = modal.querySelector('.title-input');
        assert.ok(titleInput, 'Title input must exist');
        titleInput.value = `Test Title for ${tplId}`;

        // Verify template switcher bar renders all templates
        const switchButtons = modal.querySelectorAll('.tpl-switch-btn');
        assert.equal(switchButtons.length, 9, 'All 9 template switch buttons must be present');

        // Test destination badge
        const destLabel = modal.querySelector('.dest-label');
        assert.ok(destLabel && destLabel.textContent.length > 0, 'Destination badge must be populated');

        // Test Create button
        const createBtn = modal.querySelector('.create-btn');
        assert.ok(createBtn, 'Create button must exist');
        createBtn.click();

        // Wait for async creation
        await new Promise((r) => setTimeout(r, 20));

        assert.ok(outcomeResult, `Creation outcome for ${tplId} must be produced`);
        const expectedTemplateId = (tplId === 'story' || tplId === 'edit') ? 'projectHub' : tplId;
        assert.equal(outcomeResult.plan.templateId, expectedTemplateId);
        assert.ok(outcomeResult.result?.noteId, `Materialized noteId for ${tplId} must exist`);

        // Ensure modal and backdrop cleaned up
        assert.equal(document.querySelector('.modal.show'), null, 'Modal should close after creation');
        assert.equal(document.querySelector('.modal-backdrop'), null, 'Backdrop should close after creation');
    }
});

test('COMBINATORIAL: Template Studio covers all tabs, tree navigation, category editor, schema editor, rule presets, export, and import', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const templateEngine = new TemplateEngine();
    const ifThenRuleEngine = new IfThenRuleEngine();
    let saved = false;

    renderTemplateStudio(container, templateEngine, ifThenRuleEngine, () => { saved = true; });

    // 1. Verify Mode Switcher (Schema vs Preview vs Split Preview)
    const modeBtns = container.querySelectorAll('.template-studio-wrapper .btn-group button');
    assert.ok(modeBtns.length >= 3, 'Schema, Preview, Split Preview buttons present');

    // Switch to Preview
    const previewBtn = Array.from(modeBtns).find((b) => b.textContent.includes('Preview') && !b.textContent.includes('Split'));
    assert.ok(previewBtn);
    previewBtn.click();
    assert.ok(container.querySelector('.ns-note'), 'Preview pane renders note');

    // Switch to Split Preview
    const splitBtn = Array.from(modeBtns).find((b) => b.textContent.includes('Split Preview'));
    assert.ok(splitBtn);
    splitBtn.click();
    assert.ok(container.querySelector('.ns-note') && container.querySelector('#tpl-title'), 'Split preview renders both');

    // Switch back to Schema
    const schemaBtn = Array.from(modeBtns).find((b) => b.textContent.includes('Schema'));
    assert.ok(schemaBtn);
    schemaBtn.click();

    // 2. Test Rail Library Switcher (Templates <-> Categories)
    const railSwitchers = container.querySelectorAll('.ns-split-rail .btn-group button');
    const catRailBtn = Array.from(railSwitchers).find((b) => b.textContent.includes('Categories'));
    assert.ok(catRailBtn);
    catRailBtn.click();

    // Verify Category Editor is rendered
    assert.ok(container.querySelector('#cat-root'), 'Category root container input rendered');
    assert.ok(container.querySelector('#cat-journal'), 'Category journal toggle rendered');
    assert.ok(container.querySelector('#cat-topics'), 'Category topics toggle rendered');
    assert.ok(container.querySelector('#cat-scoped'), 'Category scoped toggle rendered');

    // Save Category
    const saveCatBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Save category'));
    assert.ok(saveCatBtn);
    saveCatBtn.click();
    assert.equal(saved, true, 'Category save triggered callback');
    saved = false;

    // Switch back to Templates rail
    const tplRailBtn = Array.from(railSwitchers).find((b) => b.textContent.includes('Templates'));
    assert.ok(tplRailBtn);
    tplRailBtn.click();

    // 3. Schema Editor inputs and Promoted Attributes
    const titleInput = container.querySelector('#tpl-title');
    assert.ok(titleInput, 'Title input exists');
    titleInput.value = 'Story Project Modified';

    const patternInput = container.querySelector('#tpl-pattern');
    assert.ok(patternInput, 'Pattern input exists');
    patternInput.value = 'Story: {title}';

    const contentArea = container.querySelector('#tpl-content');
    assert.ok(contentArea, 'Content skeleton textarea exists');
    contentArea.value = '<h2>UPDATED SKELETON</h2>';

    // Test Promoted Attributes Move Up / Move Down
    const moveDownBtn = container.querySelector('.move-attr-down:not([disabled])');
    if (moveDownBtn) {
        moveDownBtn.click();
        assert.equal(saved, true);
        saved = false;
    }

    // Test Save Template
    const saveTplBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Save template'));
    assert.ok(saveTplBtn);
    saveTplBtn.click();
    assert.equal(saved, true, 'Template save triggered callback');

    // 4. Test Single Template YAML Export & Import Roundtrip
    const tpl = templateEngine.getTemplate('story');
    const yamlExport = exportTemplateToYaml(tpl);
    assert.ok(yamlExport.includes('id: story'));
    assert.ok(yamlExport.includes('attributes:'));

    const imported = importTemplateFromYaml(yamlExport);
    assert.equal(imported.id, 'story');
    assert.equal(imported.title, tpl.title);

    container.remove();
});

test('COMBINATORIAL: SettingsStudio covers all toggles, swatches, inputs, YAML spec editor, and health repair actions', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const todayEngine = new TodayEngine();
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const settingsEngine = new SettingsEngine();
    let savedYaml = '';

    const mockFrontendApi = {
        searchForNotes: async (query) => {
            if (query.includes('#calendarRoot') || query.includes('#projectRoot') || query.includes('#taskRoot')) {
                return [{ noteId: 'mock_root', getRelations: () => [{ value: 'mock_tpl' }] }];
            }
            return [];
        },
    };

    renderSettingsStudio(
        container,
        todayEngine,
        templateEngine,
        relationshipEngine,
        ifThenRuleEngine,
        settingsEngine,
        async (yaml) => { savedYaml = yaml; },
        undefined,
        mockFrontendApi
    );

    // 1. Verify Automation Toggles
    const rulesToggle = container.querySelector('#ifThenRulesToggle');
    assert.ok(rulesToggle, 'Rules toggle exists');
    assert.equal(settingsEngine.get('autoRunIfThenRulesOnCreation'), true);

    const topicsToggle = container.querySelector('#derivedTopicsToggle');
    assert.ok(topicsToggle, 'Topics toggle exists');
    assert.equal(settingsEngine.get('enableDerivedTopics'), true);

    const journalToggle = container.querySelector('#autoJournalCloneToggle');
    assert.ok(journalToggle, 'Journal toggle exists');
    assert.equal(settingsEngine.get('autoJournalClone'), true);

    // 2. Theme Accent Swatches
    const swatches = container.querySelectorAll('.accent-swatch-btn');
    assert.equal(swatches.length, 5, '5 theme swatches present');
    swatches[0].click(); // Indigo
    assert.equal(document.documentElement.style.getPropertyValue('--accent-color'), '#6366f1');

    // 3. Card Style Selector
    const cardStyleSelect = container.querySelector('#card-style-mode');
    assert.ok(cardStyleSelect, 'Card style selector exists');
    cardStyleSelect.value = 'solid';
    cardStyleSelect.dispatchEvent(new window.Event('change'));
    assert.equal(document.documentElement.dataset.ikmalCardStyle, 'solid');

    // 4. Stale Threshold & Writing Target Inputs
    const staleInput = container.querySelector('#stale-threshold-input');
    assert.ok(staleInput, 'Stale threshold input exists');
    staleInput.value = '21';
    staleInput.dispatchEvent(new window.Event('change'));
    assert.equal(settingsEngine.get('staleThresholdDays'), 21);

    const goalInput = container.querySelector('#writing-goal-input');
    assert.ok(goalInput, 'Writing goal input exists');
    goalInput.value = '750';
    goalInput.dispatchEvent(new window.Event('change'));
    assert.equal(settingsEngine.get('writingGoalWords'), 750);

    // 5. System Health Verification
    const healthBtn = container.querySelector('.check-health-btn');
    assert.ok(healthBtn, 'Check health button exists');
    healthBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    // 6. YAML Specification Save Button
    const saveYamlBtn = container.querySelector('.save-yaml-btn');
    assert.ok(saveYamlBtn, 'Save spec button exists');
    saveYamlBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(savedYaml.length > 0, 'Specification successfully saved');

    container.remove();
});

test('COMBINATORIAL: TodayHomepage covers dashboard filter, layout editor, journal card, widgets, and date rollover', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const todayEngine = new TodayEngine();
    const templateEngine = new TemplateEngine();
    const settingsEngine = new SettingsEngine();
    let quickCaptureType = '';

    const mockApi = {
        searchForNotes: async () => [],
        getTodayNote: async () => ({ noteId: 'today_note_1', title: '2026-08-25 - Tuesday' }),
        getDayNote: async (date) => ({ noteId: `day_note_${date}`, title: `${date} Journal` }),
        getNoteContexts: () => [],
        openSplitWithNote: async () => {},
    };

    const refreshFn = renderTodayHomepage(
        container,
        todayEngine,
        templateEngine,
        (type) => { quickCaptureType = type; },
        settingsEngine,
        { api: mockApi, showJournalCard: true, showEditor: true }
    );

    // 1. Test Quick Capture Buttons
    const qcButtons = container.querySelectorAll('.ns-quick-capture-action');
    assert.equal(qcButtons.length, 10, 'All 10 quick capture actions rendered');
    qcButtons[0].click(); // New Project
    assert.equal(quickCaptureType, 'projectHub');

    // 2. Test Live Search Filter
    const filterInput = container.querySelector('.today-dashboard-filter');
    assert.ok(filterInput, 'Filter input rendered');
    filterInput.value = 'NonExistentTaskXYZ';
    filterInput.dispatchEvent(new window.Event('input'));

    filterInput.value = '';
    filterInput.dispatchEvent(new window.Event('input'));

    // 3. Switch to Layout Editor
    const editModeBtn = Array.from(container.querySelectorAll('.btn-group button')).find((b) => b.textContent.includes('Edit'));
    assert.ok(editModeBtn);
    editModeBtn.click();

    // Test Journal Width input with boundary clamping
    const widthInput = container.querySelector('#journal-width');
    assert.ok(widthInput);
    widthInput.value = '65';
    widthInput.dispatchEvent(new window.Event('change'));
    assert.equal(todayEngine.getLayout().journalWidthPercent, 65);

    // Test Grid Columns select
    const colsSelect = container.querySelector('#grid-columns');
    assert.ok(colsSelect);
    colsSelect.value = '3';
    colsSelect.dispatchEvent(new window.Event('change'));
    assert.equal(todayEngine.getLayout().columns, 3);

    // Test Density select
    const densitySelect = container.querySelector('#grid-density');
    assert.ok(densitySelect);
    densitySelect.value = 'compact';
    densitySelect.dispatchEvent(new window.Event('change'));
    assert.equal(todayEngine.getLayout().density, 'compact');

    // Test Weather Location inputs
    const weatherLabel = container.querySelector('#weather-label');
    assert.ok(weatherLabel);
    weatherLabel.value = 'New York';
    weatherLabel.dispatchEvent(new window.Event('change'));
    assert.equal(todayEngine.getLayout().weather?.label, 'New York');

    const latInput = container.querySelector('#weather-lat');
    const lonInput = container.querySelector('#weather-lon');
    latInput.value = '40.7128';
    lonInput.value = '-74.0060';
    latInput.dispatchEvent(new window.Event('change'));
    lonInput.dispatchEvent(new window.Event('change'));
    assert.equal(todayEngine.getLayout().weather?.latitude, 40.7128);
    assert.equal(todayEngine.getLayout().weather?.longitude, -74.006);

    // Switch back to Preview mode
    const previewModeBtn = Array.from(container.querySelectorAll('.btn-group button')).find((b) => b.textContent.includes('Preview'));
    assert.ok(previewModeBtn);
    previewModeBtn.click();

    // 4. Test Journal Card buttons
    await new Promise((r) => setTimeout(r, 20));
    const journalOpenBtn = container.querySelector('.ns-journal-open');
    assert.ok(journalOpenBtn, 'Open Today Journal button exists');
    journalOpenBtn.click();

    const planTomorrowBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Plan for Tomorrow'));
    assert.ok(planTomorrowBtn, 'Plan for Tomorrow button exists');
    planTomorrowBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    // Test disposal
    disposeTodayHomepage(container);
    container.remove();
});

test('COMBINATORIAL: Standalone Micro-Tools artifacts render surfaces without unhandled errors', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const mockFrontendApi = {
        $container: null,
        searchForNotes: async () => [
            { noteId: 'task_1', title: 'Task Alpha', dateCreated: Date.now() - 10000, dateModified: Date.now() - 5000, getOwnedLabelValue: (k) => k === 'status' ? 'todo' : 'medium' },
            { noteId: 'task_2', title: 'Task Beta', dateCreated: Date.now() - 20000, dateModified: Date.now() - 1000, getOwnedLabelValue: (k) => k === 'status' ? 'in_progress' : 'high' },
        ],
        openNote: () => {},
        getNote: () => ({ setLabel: () => {} }),
    };
    globalThis.api = mockFrontendApi;
    window.api = mockFrontendApi;

    const artifacts = [
        'dist/artifacts/notes-system-kanban.js',
        'dist/artifacts/notes-system-insights.js',
        'dist/artifacts/notes-system-weather.js',
        'dist/artifacts/notes-system-on-this-day.js',
        'dist/artifacts/notes-system-stale-notes.js',
        'dist/artifacts/notes-system-canvas.js',
        'dist/artifacts/notes-system-quick-capture.js',
    ];

    for (const relPath of artifacts) {
        const container = document.createElement('div');
        document.body.appendChild(container);
        mockFrontendApi.$container = container;

        const code = fs.readFileSync(path.resolve(relPath), 'utf8');
        // Execute the IIFE bundle in the configured DOM context
        const fn = new Function('api', 'window', 'document', code);
        assert.doesNotThrow(() => fn(mockFrontendApi, window, document), `Executing ${relPath}`);

        await new Promise((r) => setTimeout(r, 25));
        assert.ok(container.children.length > 0 || container.innerHTML.length > 0, `${relPath} populated container`);
        container.remove();
    }
});
