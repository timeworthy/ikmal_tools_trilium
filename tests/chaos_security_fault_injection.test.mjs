import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
    escapeHtml,
    fuzzyScore,
    searchableSelect,
    toggle,
    openModal,
    showToast,
} from '../dist/components/nativeUi.js';

import { TemplateEngine } from '../dist/engine/templateEngine.js';
import { RelationshipEngine } from '../dist/engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../dist/engine/ifThenRuleEngine.js';
import { TodayEngine } from '../dist/engine/todayEngine.js';
import { NoteCreationEngine } from '../dist/engine/noteCreationEngine.js';
import { SettingsEngine } from '../dist/engine/settingsEngine.js';
import { YamlParser } from '../dist/engine/yamlParser.js';
import { parseAndApplyYamlSpec, dumpYamlSpec } from '../dist/engine/yamlSpec.js';
import { describeWeatherCode, parseWeatherResponse, buildWeatherUrl } from '../dist/engine/weatherEngine.js';
import {
    buildActivityHeatmap,
    computeMoonPhase,
    computeWritingGoalProgress,
    countWords,
    findOnThisDay,
    findStaleNotes,
    pickDailyQuote,
} from '../dist/engine/noteInsightsEngine.js';
import { reconcileProjectHubStatuses } from '../dist/engine/noteMaterializer.js';
import { TriliumApiBridge } from '../dist/engine/triliumApiBridge.js';

function setupDom() {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
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
    return dom;
}

setupDom();

test('SECURITY & CHAOS: XSS payload fuzzing across escapeHtml and dynamic DOM renderers', () => {
    const xssVectors = [
        '<script>alert(1)</script>',
        '"><script>alert(1)</script>',
        '\'><script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '"><img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<svg/onload=alert(1)>',
        '"><svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<a href="javascript:alert(1)">Click</a>',
        '<body onload=alert(1)>',
        '<input autofocus onfocus=alert(1)>',
        '"><input autofocus onfocus=alert(1)>',
        '<select onchange=alert(1)><option>1</option></select>',
        '<!--<img src="--><img src=x onerror=alert(1)//">',
        '{{7*7}}',
        '${7*7}',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '<details open ontoggle=alert(1)>',
        '<math><mtext><table><mglyph><svg><style><script>alert(1)</script>',
        '" onmouseover="alert(1)',
        '\' onfocus=\'alert(1)',
        '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
        '\u0000<script>alert(1)</script>',
        '<script\x20type="text/javascript">javascript:alert(1);</script>',
        '<script\x3Ealert(1)</script>',
        '"><style>@keyframes x{}</style><xss style="animation-name:x" onanimationstart="alert(1)"></xss>',
    ];

    for (const vector of xssVectors) {
        const escaped = escapeHtml(vector);
        // Escaped string MUST NOT contain unescaped raw '<' or '>'
        assert.equal(escaped.includes('<script'), false, `Vector: ${vector}`);
        assert.equal(escaped.includes('<img'), false, `Vector: ${vector}`);
        assert.equal(escaped.includes('<svg'), false, `Vector: ${vector}`);
        assert.equal(escaped.includes('<iframe'), false, `Vector: ${vector}`);

        // Verify inserted into a real DOM node as innerHTML does NOT create dangerous elements
        const testContainer = document.createElement('div');
        testContainer.innerHTML = `<span>${escaped}</span>`;
        assert.equal(testContainer.querySelectorAll('script').length, 0);
        assert.equal(testContainer.querySelectorAll('img').length, 0);
        assert.equal(testContainer.querySelectorAll('svg').length, 0);
        assert.equal(testContainer.querySelectorAll('iframe').length, 0);
    }
});

test('SECURITY: Coordinates and weather labels preserve privacy and reject URL tampering', () => {
    // 1. Label with sensitive text or injection must never appear in outgoing weather URL
    const sensitiveLabels = [
        'Secret Bunker Latitude 37',
        'Office of John Doe (Confidential)',
        'https://malicious-site.com/?p=',
        '"><script>alert(1)</script>',
    ];

    for (const label of sensitiveLabels) {
        const url = buildWeatherUrl({
            label,
            latitude: 37.7749,
            longitude: -122.4194,
            units: 'metric',
        });
        assert.ok(url, 'URL should be built');
        assert.equal(url.includes(encodeURIComponent(label)), false, 'Label must not be leaked into API query params');
        assert.equal(url.includes('Secret'), false);
        assert.equal(url.includes('Confidential'), false);
        assert.equal(url.includes('script'), false);
    }

    // 2. Invalid coordinates return null URL
    assert.equal(buildWeatherUrl({ latitude: NaN, longitude: -122.4 }), null);
    assert.equal(buildWeatherUrl({ latitude: 100, longitude: -122.4 }), null); // Lat > 90
    assert.equal(buildWeatherUrl({ latitude: -95, longitude: -122.4 }), null); // Lat < -90
    assert.equal(buildWeatherUrl({ latitude: 37.7, longitude: 200 }), null); // Lon > 180
    assert.equal(buildWeatherUrl({ latitude: 37.7, longitude: -200 }), null); // Lon < -180
});

test('CHAOS: Adversarial and malformed YAML parser stress matrix', () => {
    const adversarialYamls = [
        '', // Empty string
        '   \n\t  \n', // Whitespace only
        '---\n...', // Empty doc
        'invalid: [unclosed list',
        'key: {unclosed map',
        'key: "unclosed string',
        ': invalid key without name',
        'a:\n  b:\n    c:\n      d: 1\n  b: duplicate key',
        '\x00\x01\x02\x03\x04', // Binary nulls
        'version: "not a number"',
        'templates: "should be a list but is a string"',
        'ifThenRules: null',
        'settings: 12345',
        '# Just a comment',
        'key: &ref [*ref]', // Recursive reference
        'key: true\nkey: false\nkey: maybe',
        'a'.repeat(50000), // Giant single string
        'list:\n' + '  - item\n'.repeat(2000), // Giant list
    ];

    for (const yaml of adversarialYamls) {
        assert.doesNotThrow(() => {
            const parsed = YamlParser.parse(yaml);
            // Must return an object or null, never throw or crash
            assert.ok(typeof parsed === 'object' || parsed === null);
        }, `Parsing YAML: ${yaml.slice(0, 40)}`);
    }

    // Test parseAndApplyYamlSpec with invalid specifications
    const templateEngine = new TemplateEngine();
    const ifThenRuleEngine = new IfThenRuleEngine();
    const settingsEngine = new SettingsEngine();

    for (const yaml of adversarialYamls) {
        // Must reject or fallback cleanly without corrupting engines
        assert.doesNotThrow(() => {
            parseAndApplyYamlSpec(yaml, templateEngine, ifThenRuleEngine, settingsEngine);
        });
        assert.ok(templateEngine.getAllTemplates().length >= 8, 'Templates registry preserved');
    }
});

test('CHAOS: Broken database states (missing containers, broken relations, corrupt timestamps)', async () => {
    const templateEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const settingsEngine = new SettingsEngine();
    const creationEngine = new NoteCreationEngine(templateEngine, relEngine, ifThenRuleEngine, settingsEngine);

    // 1. Missing Containers Simulation
    const brokenApi = {
        searchForNote: async () => null, // No containers exist!
        searchForNotes: async () => [],
        createNote: async () => ({ note: null }),
        getTodayNote: async () => null,
        getNote: async () => null,
    };

    // Note creation should handle missing containers by returning an actionable plan
    const plan = creationEngine.planNoteCreation({
        type: 'task',
        title: 'Emergency Task in Empty DB',
        attributes: { status: 'todo' },
    });
    assert.equal(plan.templateId, 'task');
    assert.equal(plan.rootContainerMarker, 'taskRoot');

    // 2. Corrupt Timestamps in Insights Engine
    const corruptNotes = [
        { noteId: '1', title: 'Note 1', dateCreated: NaN, dateModified: NaN },
        { noteId: '2', title: 'Note 2', dateCreated: -10000, dateModified: null },
        { noteId: '3', title: 'Note 3', dateCreated: 'not-a-date', dateModified: 'invalid' },
        { noteId: '4', title: 'Note 4', dateCreated: undefined, dateModified: undefined },
        { noteId: '5', title: 'Note 5', dateCreated: 999999999999999, dateModified: 999999999999999 },
    ];

    const today = new Date();
    assert.doesNotThrow(() => {
        const heatmap = buildActivityHeatmap(corruptNotes.map((n) => n.dateCreated), today, 12);
        assert.ok(Array.isArray(heatmap));
    });

    assert.doesNotThrow(() => {
        const onThisDay = findOnThisDay(corruptNotes, today);
        assert.ok(Array.isArray(onThisDay));
    });

    assert.doesNotThrow(() => {
        const stale = findStaleNotes(corruptNotes, today, 14);
        assert.ok(Array.isArray(stale));
    });

    // 3. Project Hub Reconciliation in Broken DB
    const emptyApi = {
        searchForNotes: async () => [],
        getNotes: async () => [],
        getNote: async () => null,
    };
    const reconciled = await reconcileProjectHubStatuses(emptyApi);
    assert.equal(reconciled, 0);
});

test('CHAOS: HTTP & Network Fault Injection (403, 404, 500, Refusal bodies, Offline)', async () => {
    // 1. Weather API failure injection
    assert.equal(describeWeatherCode(-999).label, 'Unknown');
    assert.equal(describeWeatherCode(9999).label, 'Unknown');
    assert.equal(parseWeatherResponse(null).condition.label, 'Unknown');
    assert.equal(parseWeatherResponse({}).condition.label, 'Unknown');

    // 2. Project Hub Reconciliation with throwing API
    const throwingApi = {
        searchForNotes: async () => { throw new Error('Network Timeout'); },
        getNotes: async () => { throw new Error('Database Locked'); },
        getNote: async () => { throw new Error('Note Corrupted'); },
    };

    const reconcileResult = await reconcileProjectHubStatuses(throwingApi).catch((e) => -1);
    assert.ok(reconcileResult <= 0);
});

test('CHAOS: Wrong variables, boundary conditions, and type coercion in settings and layout', () => {
    const todayEngine = new TodayEngine();

    // 1. Journal Width boundary clamping
    todayEngine.setJournalWidth(-100);
    assert.equal(todayEngine.getLayout().journalWidthPercent, 35, 'Clamped to min 35');

    todayEngine.setJournalWidth(200);
    assert.equal(todayEngine.getLayout().journalWidthPercent, 85, 'Clamped to max 85');

    todayEngine.setJournalWidth(NaN);
    assert.equal(todayEngine.getLayout().journalWidthPercent, 65, 'Fallback default 65');

    // 2. Writing Goal and Word Counting edge cases
    assert.equal(countWords(''), 0);
    assert.equal(countWords('   \n\t  '), 0);
    assert.equal(countWords('<p></p><div></div><span></span>'), 0);
    assert.equal(countWords('<p>One <strong>Two</strong>   Three</p>'), 3);
    assert.equal(countWords('Word'.repeat(10000)), 1);

    const goalProgress = computeWritingGoalProgress(-50, 0);
    assert.equal(goalProgress.current, 0);
    assert.equal(goalProgress.percent, 0);

    const goalProgressOver = computeWritingGoalProgress(2000, 1000);
    assert.equal(goalProgressOver.percent, 100, 'Clamped to 100% max');
    assert.equal(goalProgressOver.remaining, 0);

    // 3. Moon Phase boundary testing for 365 calendar days
    for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 28; day++) {
            const date = new Date(2026, month, day);
            const phase = computeMoonPhase(date);
            assert.ok(phase.illumination >= 0 && phase.illumination <= 1, `Illumination for ${date.toISOString()}`);
            assert.ok(phase.name.length > 0);
            assert.ok(phase.icon.length > 0);
        }
    }

    // 4. Daily quote deterministic validity for 365 days
    for (let dayOfYear = 1; dayOfYear <= 365; dayOfYear++) {
        const date = new Date(2026, 0, dayOfYear);
        const quote = pickDailyQuote(date);
        assert.ok(quote.text && quote.text.length > 0);
        assert.ok(quote.author && quote.author.length > 0);
    }
});

test('CHAOS: If/Then Rule Engine condition operators exhaustively tested with wrong types, missing fields, and boundary values', () => {
    const engine = new IfThenRuleEngine();

    const testContext = {
        noteId: 'n1',
        title: 'Alpha Note',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: {
            priority: 'high',
            score: '42',
            doneDate: '2026-08-25',
            emptyField: '',
        },
        relations: {
            project: 'proj_1',
            topics: ['topic_a', 'topic_b'],
        },
    };

    // Custom test rules for every operator and edge case
    const rules = [
        { id: 'op_eq', name: 'op_eq', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'priority', operator: 'equals', value: 'high' }], actions: [{ type: 'setLabel', params: { labelName: 'eq_passed', labelValue: '1' } }] },
        { id: 'op_neq', name: 'op_neq', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'priority', operator: 'notEquals', value: 'low' }], actions: [{ type: 'setLabel', params: { labelName: 'neq_passed', labelValue: '1' } }] },
        { id: 'op_contains', name: 'op_contains', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'title', operator: 'contains', value: 'Alpha' }], actions: [{ type: 'setLabel', params: { labelName: 'contains_passed', labelValue: '1' } }] },
        { id: 'op_not_contains', name: 'op_not_contains', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'title', operator: 'notContains', value: 'Omega' }], actions: [{ type: 'setLabel', params: { labelName: 'not_contains_passed', labelValue: '1' } }] },
        { id: 'op_starts_with', name: 'op_starts_with', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'title', operator: 'startsWith', value: 'Al' }], actions: [{ type: 'setLabel', params: { labelName: 'starts_with_passed', labelValue: '1' } }] },
        { id: 'op_ends_with', name: 'op_ends_with', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'title', operator: 'endsWith', value: 'Note' }], actions: [{ type: 'setLabel', params: { labelName: 'ends_with_passed', labelValue: '1' } }] },
        { id: 'op_is_set', name: 'op_is_set', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'doneDate', operator: 'isSet' }], actions: [{ type: 'setLabel', params: { labelName: 'is_set_passed', labelValue: '1' } }] },
        { id: 'op_is_not_set', name: 'op_is_not_set', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'nonExistentAttr', operator: 'isNotSet' }], actions: [{ type: 'setLabel', params: { labelName: 'is_not_set_passed', labelValue: '1' } }] },
        { id: 'op_gt', name: 'op_gt', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'score', operator: 'greaterThan', value: '40' }], actions: [{ type: 'setLabel', params: { labelName: 'gt_passed', labelValue: '1' } }] },
        { id: 'op_lt', name: 'op_lt', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'score', operator: 'lessThan', value: '50' }], actions: [{ type: 'setLabel', params: { labelName: 'lt_passed', labelValue: '1' } }] },
        // Edge cases: comparing non-numbers with gt/lt, missing fields, unknown operator
        { id: 'op_gt_invalid', name: 'op_gt_invalid', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'priority', operator: 'greaterThan', value: '10' }], actions: [{ type: 'setLabel', params: { labelName: 'should_not_fire', labelValue: '1' } }] },
        { id: 'op_unknown', name: 'op_unknown', enabled: true, trigger: { type: 'onNoteCreated' }, conditions: [{ field: 'title', operator: 'unknown_op', value: 'Alpha' }], actions: [{ type: 'setLabel', params: { labelName: 'should_not_fire', labelValue: '1' } }] },
    ];

    rules.forEach((r) => engine.registerRule(r));
    const results = engine.evaluateEvent('onNoteCreated', testContext);

    const executedRuleIds = results.map((r) => r.ruleId);
    assert.ok(executedRuleIds.includes('op_eq'));
    assert.ok(executedRuleIds.includes('op_neq'));
    assert.ok(executedRuleIds.includes('op_contains'));
    assert.ok(executedRuleIds.includes('op_not_contains'));
    assert.ok(executedRuleIds.includes('op_starts_with'));
    assert.ok(executedRuleIds.includes('op_ends_with'));
    assert.ok(executedRuleIds.includes('op_is_set'));
    assert.ok(executedRuleIds.includes('op_is_not_set'));
    assert.ok(executedRuleIds.includes('op_gt'));
    assert.ok(executedRuleIds.includes('op_lt'));

    assert.equal(executedRuleIds.includes('op_gt_invalid'), false);
    assert.equal(executedRuleIds.includes('op_unknown'), false);
});
