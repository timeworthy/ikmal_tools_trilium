import test from 'node:test';
import assert from 'node:assert/strict';
import { TemplateEngine } from '../dist/engine/templateEngine.js';
import { RelationshipEngine } from '../dist/engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../dist/engine/ifThenRuleEngine.js';
import { TodayEngine } from '../dist/engine/todayEngine.js';
import { NoteCreationEngine } from '../dist/engine/noteCreationEngine.js';
import { buildAttributeRows, applyDerivedTopics, materializeNoteCreation } from '../dist/engine/noteMaterializer.js';
import { SettingsEngine, DEFAULT_AUTOMATION_SETTINGS } from '../dist/engine/settingsEngine.js';
import { loadAutomationSettings, saveAutomationSetting, loadYamlSpecification, saveYamlSpecification } from '../dist/engine/packagePersistence.js';
import { TriliumApiBridge } from '../dist/engine/triliumApiBridge.js';
import { DEFAULT_STARTER_YAML_SPEC, dumpYamlSpec, parseAndApplyYamlSpec, exportTemplateToYaml, importTemplateFromYaml } from '../dist/engine/yamlSpec.js';
import { YamlParser } from '../dist/engine/yamlParser.js';
import { describeWeatherCode, hasLocation, parseWeatherResponse } from '../dist/engine/weatherEngine.js';
import {
    buildActivityHeatmap,
    computeMoonPhase,
    computeWritingGoalProgress,
    countWords,
    findOnThisDay,
    findStaleNotes,
    pickDailyQuote,
} from '../dist/engine/noteInsightsEngine.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('TemplateEngine registers templates and formats titles', () => {
    const tplEngine = new TemplateEngine();
    const templates = tplEngine.getAllTemplates();

    assert.ok(templates.length >= 8);

    const formattedTitle = tplEngine.formatTitle('meeting', 'Weekly Sync', new Date(2026, 7, 15));
    assert.equal(formattedTitle, 'Meeting: Weekly Sync');

    const dayTitle = tplEngine.formatTitle('task', 'Buy groceries', new Date(2026, 7, 1));
    assert.equal(dayTitle, 'Buy groceries');
});

test('RelationshipEngine calculates auto-cloning and derived topics', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);

    const relRes = relEngine.resolveCreationRelations('task', {
        project: 'proj_alpha_123',
    });

    assert.deepEqual(relRes.autoCloneContainers, ['proj_alpha_123']);
    assert.equal(relRes.relationLabels.length, 1);
    assert.equal(relRes.relationLabels[0].name, 'project');
    assert.equal(relRes.relationLabels[0].value, 'proj_alpha_123');

    const derivedRes = relEngine.computeDerivedTopics(['topic_ai'], {
        proj_alpha_123: ['topic_ai', 'topic_tech'],
    });

    assert.deepEqual(derivedRes.explicitTopics, ['topic_ai']);
    assert.deepEqual(derivedRes.derivedTopics, ['topic_tech']);
    assert.deepEqual(derivedRes.allTopics.sort(), ['topic_ai', 'topic_tech']);
});

test('IfThenRuleEngine evaluates triggers, conditions, and action pipelines', () => {
    const ifThenRuleEngine = new IfThenRuleEngine();

    const taskDoneContext = {
        noteId: 'note_99',
        title: 'Complete audit',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { status: 'done' },
        relations: {},
    };

    const results = ifThenRuleEngine.evaluateEvent('onAttributeChanged', taskDoneContext, 'status');
    const matchedRule = results.find(r => r.ruleId === 'rule_work_category_done_date');

    assert.ok(matchedRule, 'Expected the work-category completion rule to match');
    assert.equal(matchedRule.executedActions[0].type, 'setLabel');
    assert.equal(matchedRule.executedActions[0].params.labelName, 'doneDate');
    // {TODAY} is substituted, so the value is a real date rather than the placeholder.
    assert.match(matchedRule.executedActions[0].params.labelValue, /^\d{4}-\d{2}-\d{2}$/);

    // A rule scoped to another attribute must not fire on this change.
    assert.equal(results.some(r => r.ruleId === 'rule_task_done_date'), false);
});

test('IfThenRuleEngine dispatch contract covers every declared trigger type', () => {
    const engine = new IfThenRuleEngine([
        {
            id: 'created', name: 'created', description: '', enabled: true,
            trigger: { type: 'onNoteCreated' }, conditions: [], actions: [{ type: 'setLabel', params: { labelName: 'created', labelValue: 'true' } }],
        },
        {
            id: 'changed', name: 'changed', description: '', enabled: true,
            trigger: { type: 'onAttributeChanged', attributeName: 'status' }, conditions: [], actions: [{ type: 'setLabel', params: { labelName: 'changed', labelValue: 'true' } }],
        },
        {
            id: 'manual', name: 'manual', description: '', enabled: true,
            trigger: { type: 'onManualAction' }, conditions: [], actions: [{ type: 'setLabel', params: { labelName: 'manual', labelValue: 'true' } }],
        },
        {
            id: 'scheduled', name: 'scheduled', description: '', enabled: true,
            trigger: { type: 'onScheduledCheck' }, conditions: [], actions: [{ type: 'setLabel', params: { labelName: 'scheduled', labelValue: 'true' } }],
        },
    ]);
    const context = {
        noteId: 'note_trigger_matrix', title: 'Trigger matrix', templateId: 'task', category: 'work',
        attributes: { status: 'done' }, relations: {},
    };

    assert.equal(engine.evaluateEvent('onNoteCreated', context).map((result) => result.ruleId).join(','), 'created');
    assert.equal(engine.evaluateEvent('onAttributeChanged', context, 'status').map((result) => result.ruleId).join(','), 'changed');
    assert.equal(engine.evaluateEvent('onManualAction', context).map((result) => result.ruleId).join(','), 'manual');
    assert.equal(engine.evaluateEvent('onScheduledCheck', context).map((result) => result.ruleId).join(','), 'scheduled');
    assert.equal(engine.evaluateEvent('onAttributeChanged', context, 'priority').length, 0);
});

test('IfThenRuleEngine honors category/container scopes and every declared condition operator', () => {
    const rules = new IfThenRuleEngine([]);
    rules.registerRule({
        id: 'scoped',
        name: 'Scoped rule',
        description: '',
        enabled: true,
        isBuiltin: false,
        trigger: { type: 'onNoteCreated', targetCategory: 'work', targetContainerMarker: 'taskRoot' },
        conditions: [{ field: 'score', operator: 'greaterThan', value: 5 }],
        actions: [{ type: 'setLabel', params: { labelName: 'matched', labelValue: 'true' } }],
    });
    rules.registerRule({
        id: 'empty',
        name: 'Empty rule',
        description: '',
        enabled: true,
        isBuiltin: false,
        trigger: { type: 'onNoteCreated' },
        conditions: [{ field: 'missing', operator: 'isEmpty', value: true }],
        actions: [{ type: 'setLabel', params: { labelName: 'empty', labelValue: 'true' } }],
    });

    const base = {
        noteId: 'n1', title: 'A note', templateId: 'task',
        category: 'work', containerMarker: 'taskRoot',
        attributes: { score: 8 }, relations: {},
    };
    assert.deepEqual(rules.evaluateEvent('onNoteCreated', base).map((r) => r.ruleId), ['scoped', 'empty']);
    assert.deepEqual(rules.evaluateEvent('onNoteCreated', { ...base, category: 'people' }).map((r) => r.ruleId), ['empty']);
    assert.deepEqual(rules.evaluateEvent('onNoteCreated', { ...base, containerMarker: 'meetingRoot' }).map((r) => r.ruleId), ['empty']);
    assert.deepEqual(rules.evaluateEvent('onNoteCreated', { ...base, attributes: { score: 2, missing: 'present' } }).map((r) => r.ruleId), []);
});

test('TodayEngine handles layout toggling and reordering', () => {
    const todayEngine = new TodayEngine();
    const initialWidgets = todayEngine.getVisibleWidgets();

    assert.ok(initialWidgets.length > 0);

    todayEngine.toggleWidgetVisibility('overdue', false);
    const updatedWidgets = todayEngine.getVisibleWidgets();

    assert.ok(!updatedWidgets.some(w => w.id === 'overdue'));
});

test('NoteCreationEngine plans note creation with if/then automation', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const creationEngine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);

    const plan = creationEngine.planNoteCreation({
        type: 'task',
        title: 'Submit quarterly report',
        attributes: { priority: 'high' },
        relations: { project: 'proj_beta' },
    });

    assert.equal(plan.templateId, 'task');
    assert.equal(plan.formattedTitle, 'Submit quarterly report');
    assert.deepEqual(plan.autoCloneContainers, ['proj_beta']);
    assert.equal(plan.journalClone, true, 'project work should also appear in today\'s journal');
    assert.ok(plan.labelsToCreate.some(l => l.name === 'extTask'));

    const categoryScoped = new IfThenRuleEngine([]);
    categoryScoped.registerRule({
        id: 'only-work', name: 'Only work', description: '', enabled: true, isBuiltin: false,
        trigger: { type: 'onNoteCreated', targetCategory: 'work' }, conditions: [],
        actions: [{ type: 'setLabel', params: { labelName: 'workOnly', labelValue: 'true' } }],
    });
    const scopedPlan = new NoteCreationEngine(tplEngine, relEngine, categoryScoped)
        .planNoteCreation({ type: 'person', title: 'A person' });
    assert.equal(scopedPlan.labelsToCreate.some((l) => l.name === 'workOnly'), false);
});

test('buildAttributeRows converts a plan into the label/relation rows api.createNote expects', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const creationEngine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);

    const plan = creationEngine.planNoteCreation({
        type: 'task',
        title: 'Submit quarterly report',
        attributes: { priority: 'high' },
        relations: { project: 'proj_beta' },
    });

    const rows = buildAttributeRows(plan);

    assert.ok(rows.some(r => r.type === 'label' && r.name === 'priority' && r.value === 'high'));
    assert.ok(rows.some(r => r.type === 'label' && r.name === 'extTask'));
    assert.ok(rows.some(r => r.type === 'relation' && r.name === 'project' && r.value === 'proj_beta'));
    // Every row is one or the other, never anything api.createNote's attributes array can't take.
    assert.ok(rows.every(r => r.type === 'label' || r.type === 'relation'));
});

test('materializeNoteCreation honors an explicitly scoped Trilium api when window.api is absent', async () => {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const creationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, new IfThenRuleEngine(), new SettingsEngine());
    const created = [];
    let cloneCalls = 0;
    const activeRoot = { noteId: 'active-root', title: 'Active' };
    const today = { noteId: 'today-note', title: 'Today' };
    const scopedApi = {
        searchForNote: async (query) => query === '#activeProjectRoot' ? activeRoot : null,
        searchForNotes: async () => [],
        createNote: async (parentId, opts) => {
            const note = { noteId: `created-${created.length + 1}`, title: opts.title };
            created.push({ parentId, opts, note });
            return { note };
        },
        getTodayNote: async () => today,
        runOnBackend: async () => { cloneCalls += 1; return true; },
    };
    const plan = creationEngine.planNoteCreation({ type: 'story', title: 'Scoped API Story' });

    const result = await materializeNoteCreation(plan, { api: scopedApi });

    assert.equal(result.title, 'Scoped API Story');
    assert.equal(created[0].parentId, 'active-root');
    assert.equal(created.length, 3, 'hub plus draft and reporting child notes should be created');
    assert.equal(cloneCalls, 2, 'child notes should be cloned through the explicitly passed api');
});

test('TodayEngine defaults and persists responsive layout settings', () => {
    const todayEngine = new TodayEngine();

    // Defaults are filled in even though the stored layout may predate them.
    assert.equal(todayEngine.getLayout().columns, 'auto');
    assert.equal(todayEngine.getLayout().density, 'comfortable');
    assert.equal(todayEngine.getLayout().weather.units, 'metric');

    todayEngine.setColumns(3);
    todayEngine.setDensity('compact');
    todayEngine.setQuickCaptureBar(false);
    todayEngine.setWeather({ latitude: 37.8715, longitude: -122.273, label: 'Berkeley' });

    const layout = todayEngine.getLayout();
    assert.equal(layout.columns, 3);
    assert.equal(layout.density, 'compact');
    assert.equal(layout.showQuickCaptureBar, false);
    assert.equal(layout.weather.label, 'Berkeley');
    // Unspecified weather fields keep their previous value.
    assert.equal(layout.weather.units, 'metric');

    // The journal width is clamped rather than accepted as given.
    todayEngine.setJournalWidth(200);
    assert.equal(todayEngine.getLayout().journalWidthPercent, 85);
});

test('YamlParser round-trips nested maps, lists and block scalars', () => {
    const source = {
        name: 'spec',
        count: 3,
        enabled: false,
        empty: [],
        nested: { a: 1, list: [{ id: 'x', on: true }, { id: 'y', on: false }] },
        body: '<h2>Title</h2>\nsecond line',
    };

    const parsed = YamlParser.parse(YamlParser.stringify(source));
    assert.deepEqual(parsed, source);
});

test('YAML specification round-trips the whole configuration', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const todayEngine = new TodayEngine();

    tplEngine.updateTemplate('task', { title: 'Renamed Task', titlePattern: 'T: {title}' });
    todayEngine.setColumns(2);
    todayEngine.setWeather({ latitude: 51.5, longitude: -0.12, label: 'London', units: 'imperial' });

    const yaml = dumpYamlSpec(todayEngine.getLayout(), tplEngine, relEngine, ifThenRuleEngine);

    // Everything the studio configures is represented, including what used to be missing.
    assert.match(yaml, /^categories:/m);
    assert.match(yaml, /parentLinks:/);
    assert.match(yaml, /density: comfortable/);
    assert.match(yaml, /label: London/);
    // The old dump emitted these as "[object Object]" and "undefined".
    assert.equal(yaml.includes('[object Object]'), false);
    assert.equal(yaml.includes('undefined'), false);

    // Applying it to fresh engines reproduces the same configuration.
    const target = {
        tpl: new TemplateEngine(),
        ifThen: new IfThenRuleEngine(),
        today: new TodayEngine(),
    };
    const result = parseAndApplyYamlSpec(yaml, target.today, target.tpl, target.ifThen);
    assert.ok(result.success, result.message);

    assert.equal(target.tpl.getTemplate('task').title, 'Renamed Task');
    assert.equal(target.tpl.getTemplate('task').titlePattern, 'T: {title}');
    assert.equal(target.tpl.getCategory('work').defaultRootMarker, 'projectRoot');
    assert.equal(target.today.getLayout().columns, 2);
    assert.equal(target.today.getLayout().weather.label, 'London');
    assert.equal(target.today.getLayout().weather.units, 'imperial');

    // Rule triggers survive as structured objects, not stringified ones.
    const categoryRule = target.ifThen.getRule('rule_work_category_done_date');
    assert.equal(categoryRule.trigger.type, 'onAttributeChanged');
    assert.equal(categoryRule.trigger.targetCategory, 'work');
    assert.equal(categoryRule.actions[0].params.labelValue, '{TODAY}');

    // A template's content skeleton survives the block-scalar round trip.
    assert.equal(target.tpl.getTemplate('meeting').defaultContent, tplEngine.getTemplate('meeting').defaultContent);
});

test('parseAndApplyYamlSpec rejects unusable input rather than failing silently', () => {
    const args = [new TodayEngine(), new TemplateEngine(), new IfThenRuleEngine()];

    assert.equal(parseAndApplyYamlSpec('', ...args).success, false);
    assert.equal(parseAndApplyYamlSpec('unrelated: true', ...args).success, false);
});

test('empty YAML reset has a valid mostly-blank starter specification', () => {
    assert.match(DEFAULT_STARTER_YAML_SPEC, /^version: 1\.1\.0/m);
    assert.match(DEFAULT_STARTER_YAML_SPEC, /^categories: \[\]/m);
    assert.match(DEFAULT_STARTER_YAML_SPEC, /^templates: \[\]/m);
    assert.match(DEFAULT_STARTER_YAML_SPEC, /^ifThenRules: \[\]/m);

    const result = parseAndApplyYamlSpec(
        DEFAULT_STARTER_YAML_SPEC,
        new TodayEngine(),
        new TemplateEngine(),
        new IfThenRuleEngine()
    );
    assert.equal(result.success, true, result.message);
});

test('weatherEngine maps WMO codes and validates coordinates', () => {
    assert.equal(describeWeatherCode(0).icon, 'sun');
    // A clear night reads as a moon rather than a sun.
    assert.equal(describeWeatherCode(0, false).icon, 'moon');
    assert.equal(describeWeatherCode(95).label, 'Thunderstorm');
    assert.equal(describeWeatherCode(4242).label, 'Unknown');

    assert.equal(hasLocation(undefined), false);
    // (0, 0) means unset, not the Gulf of Guinea.
    assert.equal(hasLocation({ latitude: 0, longitude: 0, units: 'metric', label: '' }), false);
    assert.equal(hasLocation({ latitude: 91, longitude: 0, units: 'metric', label: '' }), false);
    assert.equal(hasLocation({ latitude: 37.87, longitude: -122.27, units: 'metric', label: '' }), true);

    const report = parseWeatherResponse({
        current: { temperature_2m: 18.4, is_day: 1, weather_code: 3, wind_speed_10m: 11.2 },
        current_units: { temperature_2m: '\u00b0C', wind_speed_10m: 'km/h' },
        daily: {
            time: ['2026-08-01', '2026-08-02'],
            weather_code: [3, 61],
            temperature_2m_max: [21.6, 19.1],
            temperature_2m_min: [12.2, 11.8],
        },
    });

    assert.equal(report.temperature, 18);
    assert.equal(report.condition.label, 'Overcast');
    assert.equal(report.days.length, 2);
    assert.equal(report.days[1].condition.icon, 'cloud-light-rain');
    assert.equal(report.days[0].high, 22);
});

test('SettingsEngine defaults match the manifest declared in trilium-package.json', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(fs.readFileSync(path.join(here, '..', 'trilium-package.json'), 'utf8'));

    for (const setting of manifest.settings) {
        if (setting.type !== 'boolean') continue;
        assert.ok(
            Object.prototype.hasOwnProperty.call(DEFAULT_AUTOMATION_SETTINGS, setting.key),
            `manifest declares '${setting.key}' but SettingsEngine has no default for it`
        );
        assert.equal(
            DEFAULT_AUTOMATION_SETTINGS[setting.key],
            setting.default,
            `SettingsEngine default for '${setting.key}' has drifted from the manifest`
        );
    }
});

test('NoteCreationEngine gates if/then rule execution on autoRunIfThenRulesOnCreation', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();

    // The Story capture creates a Project Hub plus a Draft child. The category
    // rule belongs to the Draft child, not the enclosing Project Hub.
    const enabledEngine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine());
    const enabledPlan = enabledEngine.planNoteCreation({ type: 'story', title: 'A story', mode: 'project' });
    assert.ok(enabledPlan.childNotesToCreate?.[0].labels.some((l) => l.name === 'round'));
    assert.equal(enabledPlan.childNotesToCreate?.[0].labels.find((l) => l.name === 'round')?.value, '1');
    assert.equal(enabledPlan.childNotesToCreate?.[0].labels.find((l) => l.name === 'reviewState')?.value, 'review');
    assert.ok(enabledPlan.executedIfThenRules.some((r) => r.ruleId === 'rule_drafts_category_editorial_round'));

    const disabledSettings = new SettingsEngine({ autoRunIfThenRulesOnCreation: false });
    const disabledEngine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, disabledSettings);
    const disabledPlan = disabledEngine.planNoteCreation({ type: 'story', title: 'A story', mode: 'project' });
    assert.equal(disabledPlan.childNotesToCreate?.[0].labels.find((l) => l.name === 'round')?.value, '1');
    assert.deepEqual(disabledPlan.executedIfThenRules, []);
});

test('NoteCreationEngine gates derived topic inheritance on enableDerivedTopics', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();

    const request = {
        type: 'task',
        title: 'Ship the thing',
        relations: { project: 'proj_alpha' },
    };

    const enabledPlan = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine())
        .planNoteCreation(request);
    assert.deepEqual(enabledPlan.inheritedTopicSources, ['proj_alpha']);
    // Auto-cloning is a separate concern from topic inheritance and must not be gated by it.
    assert.deepEqual(enabledPlan.autoCloneContainers, ['proj_alpha']);

    const disabledPlan = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine({ enableDerivedTopics: false }))
        .planNoteCreation(request);
    assert.deepEqual(disabledPlan.inheritedTopicSources, []);
    assert.deepEqual(disabledPlan.autoCloneContainers, ['proj_alpha']);
});

test('NoteCreationEngine files project work in both project and journal branches', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();

    // A bare task (work category, no relation target) falls back to the journal.
    const bareTaskPlan = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine())
        .planNoteCreation({ type: 'task', title: 'Bare task' });
    assert.equal(bareTaskPlan.journalClone, true);

    // A task auto-cloned into a project also belongs in the day's work index.
    const projectTaskPlan = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine())
        .planNoteCreation({ type: 'task', title: 'Project task', relations: { project: 'proj_alpha' } });
    assert.equal(projectTaskPlan.journalClone, true);

    // The global setting overrides everything else.
    const disabledPlan = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine({ autoJournalClone: false }))
        .planNoteCreation({ type: 'task', title: 'Bare task' });
    assert.equal(disabledPlan.journalClone, false);

    // A template explicitly opted out of journal cloning stays out regardless.
    const topicPlan = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, new SettingsEngine())
        .planNoteCreation({ type: 'topic', title: 'A topic tag' });
    assert.equal(topicPlan.journalClone, false);
});

test('NoteCreationEngine keeps automation destinations as resolvable IDs or markers', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const rules = new IfThenRuleEngine([]);
    rules.registerRule({
        id: 'archive-on-create', name: 'Archive', description: '', enabled: true, isBuiltin: false,
        trigger: { type: 'onNoteCreated', targetTemplateId: 'task' }, conditions: [],
        actions: [{ type: 'archiveNote', params: { containerMarker: 'archiveProjectRoot' } }],
    });
    const plan = new NoteCreationEngine(tplEngine, relEngine, rules)
        .planNoteCreation({ type: 'task', title: 'Archive me' });

    assert.deepEqual(plan.autoCloneContainerMarkers, ['archiveProjectRoot']);
    assert.equal(plan.autoCloneContainers.includes('archiveProjectRoot'), false);
    assert.ok(plan.labelsToCreate.some((label) => label.name === 'archived'));
});

test('packagePersistence falls back to an in-memory store outside Trilium and round-trips settings', async () => {
    await saveAutomationSetting('autoRunIfThenRulesOnCreation', false);
    const loaded = await loadAutomationSettings();
    assert.equal(loaded.autoRunIfThenRulesOnCreation, false);
    // Unset keys still fall back to the manifest defaults.
    assert.equal(loaded.enableDerivedTopics, DEFAULT_AUTOMATION_SETTINGS.enableDerivedTopics);

    // Restore, since the in-memory store is process-wide and other tests assume defaults.
    await saveAutomationSetting('autoRunIfThenRulesOnCreation', true);
});

test('packagePersistence round-trips the YAML specification and returns null when nothing is saved yet', async () => {
    assert.equal(await loadYamlSpecification(), null);

    // Content with quotes, newlines, and unicode all have to survive the JSON
    // encoding used to store them in a single-line attribute value.
    const yaml = 'homepage:\n  weather:\n    label: "Ian\'s café ☕"\n';
    await saveYamlSpecification(yaml);
    assert.equal(await loadYamlSpecification(), yaml);

    await saveYamlSpecification('');
    assert.equal(await loadYamlSpecification(), '');
});

test('package persistence and the API bridge honor an explicitly scoped frontend api', async () => {
    const calls = [];
    const manifest = {
        noteId: 'manifest-scoped',
        getOwnedLabelValue: () => null,
    };
    const scopedApi = {
        searchForNotes: async () => [manifest],
        runOnBackend: async () => {
            calls.push('scoped-backend');
            return true;
        },
    };

    const previousGlobalApi = globalThis.api;
    delete globalThis.api;
    try {
        await saveYamlSpecification('homepage: {}\n', scopedApi);
        await TriliumApiBridge.setNoteAttribute('manifest-scoped', 'label', 'packageData:test', 'true', undefined, scopedApi);
    } finally {
        if (previousGlobalApi === undefined) delete globalThis.api;
        else globalThis.api = previousGlobalApi;
    }

    assert.deepEqual(calls, ['scoped-backend', 'scoped-backend']);
});

// -------------------------------------------------------- noteInsightsEngine

test('buildActivityHeatmap buckets creation timestamps into the correct local day', () => {
    const today = new Date(2026, 7, 1); // 2026-08-01, a Saturday
    const dayMs = 24 * 60 * 60 * 1000;

    const weeks = buildActivityHeatmap([
        today.getTime(),
        today.getTime(),
        today.getTime() - dayMs,
        today.getTime() - 11 * 7 * dayMs, // start of the 12-week window
    ], today, 12);

    assert.equal(weeks.length, 12);
    assert.equal(weeks.reduce((n, w) => n + w.days.length, 0), 84);

    const lastWeek = weeks[weeks.length - 1];
    const todayCell = lastWeek.days.find((d) => d.date === '2026-08-01');
    const yesterdayCell = lastWeek.days.find((d) => d.date === '2026-07-31');
    assert.equal(todayCell.count, 2);
    assert.equal(yesterdayCell.count, 1);

    const totalCounted = weeks.flatMap((w) => w.days).reduce((n, d) => n + d.count, 0);
    assert.equal(totalCounted, 4);

    // Non-finite timestamps (corrupt data) are dropped rather than crashing.
    assert.doesNotThrow(() => buildActivityHeatmap([NaN, Infinity, -Infinity, today.getTime()], today, 2));
});

test('findOnThisDay matches previous-year anniversaries and sorts most recent first', () => {
    const today = new Date(2026, 7, 1);
    const notes = [
        { noteId: 'a', title: 'Two years ago', dateCreated: new Date(2024, 7, 1).getTime(), dateModified: 0 },
        { noteId: 'b', title: 'One year ago', dateCreated: new Date(2025, 7, 1).getTime(), dateModified: 0 },
        { noteId: 'c', title: 'Same day, this year', dateCreated: new Date(2026, 7, 1).getTime(), dateModified: 0 },
        { noteId: 'd', title: 'Wrong day', dateCreated: new Date(2025, 7, 2).getTime(), dateModified: 0 },
    ];

    const results = findOnThisDay(notes, today);
    assert.deepEqual(results.map((r) => r.noteId), ['b', 'a']);
    assert.equal(results[0].yearsAgo, 1);
    assert.equal(results[1].yearsAgo, 2);
});

test('findStaleNotes excludes closed statuses and respects the threshold', () => {
    const today = new Date(2026, 7, 1);
    const dayMs = 24 * 60 * 60 * 1000;

    const notes = [
        { noteId: 'stale', title: 'Old open task', dateCreated: 0, dateModified: today.getTime() - 30 * dayMs, status: 'todo' },
        { noteId: 'fresh', title: 'Recently touched', dateCreated: 0, dateModified: today.getTime() - 2 * dayMs, status: 'todo' },
        { noteId: 'closed', title: 'Old but done', dateCreated: 0, dateModified: today.getTime() - 30 * dayMs, status: 'Done' },
        { noteId: 'corrupt', title: 'Bad timestamp', dateCreated: 0, dateModified: NaN, status: 'todo' },
    ];

    // A non-finite dateModified (corrupt data) fails the threshold comparison
    // and is silently dropped rather than showing up with garbage "days stale".
    const stale = findStaleNotes(notes, today, 14);
    assert.deepEqual(stale.map((s) => s.noteId), ['stale']);
    assert.equal(stale[0].daysSinceModified, 30);
});

test('computeWritingGoalProgress clamps and reports remaining words', () => {
    assert.deepEqual(computeWritingGoalProgress(250, 500), {
        current: 250, goal: 500, percent: 50, remaining: 250, metGoal: false,
    });
    // Overshooting the goal clamps the percentage rather than exceeding 100.
    assert.equal(computeWritingGoalProgress(900, 500).percent, 100);
    assert.equal(computeWritingGoalProgress(900, 500).metGoal, true);
    // A zero goal must not divide by zero.
    assert.equal(computeWritingGoalProgress(10, 0).percent, 0);
    // Negative input (e.g. a bad reading) is treated as zero, not propagated.
    assert.equal(computeWritingGoalProgress(-5, 500).current, 0);
});

test('countWords strips markup and ignores the whitespace it leaves behind', () => {
    assert.equal(countWords('<p>Hello <b>world</b></p>'), 2);
    assert.equal(countWords(''), 0);
    assert.equal(countWords('   '), 0);
    assert.equal(countWords('<div><p></p><p></p></div>'), 0);
    assert.equal(countWords('one  two\nthree\tfour'), 4);
});

test('computeMoonPhase is deterministic and stays within valid ranges', () => {
    const date = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    const a = computeMoonPhase(date);
    const b = computeMoonPhase(new Date(date.getTime()));
    assert.deepEqual(a, b);

    assert.ok(a.fraction >= 0 && a.fraction < 1);
    assert.ok(a.illumination >= 0 && a.illumination <= 1);
    assert.ok([
        'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
        'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
    ].includes(a.name));

    // The known reference new moon should read as very close to New Moon.
    const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
    assert.equal(computeMoonPhase(knownNewMoon).name, 'New Moon');
});

test('pickDailyQuote is deterministic per calendar day and always returns a valid quote', () => {
    const morning = new Date(2026, 7, 1, 6, 0, 0);
    const night = new Date(2026, 7, 1, 23, 59, 0);
    assert.deepEqual(pickDailyQuote(morning), pickDailyQuote(night));

    const quote = pickDailyQuote(morning);
    assert.equal(typeof quote.text, 'string');
    assert.ok(quote.text.length > 0);
    assert.equal(typeof quote.author, 'string');
    assert.ok(quote.author.length > 0);
});

test('weatherEngine parses sunrise, sunset, and daylight duration', () => {
    const report = parseWeatherResponse({
        current: { temperature_2m: 18, is_day: 1, weather_code: 0, wind_speed_10m: 5 },
        current_units: {},
        daily: {
            time: ['2026-08-01'],
            weather_code: [0],
            temperature_2m_max: [22],
            temperature_2m_min: [12],
            sunrise: ['2026-08-01T06:11'],
            sunset: ['2026-08-01T20:18'],
            daylight_duration: [50820.4],
        },
    });

    assert.equal(report.sunrise, '2026-08-01T06:11');
    assert.equal(report.sunset, '2026-08-01T20:18');
    assert.equal(report.daylightSeconds, 50820);

    // Missing daily fields (an older cached response, or a malformed one) degrade to null rather than throwing.
    const minimal = parseWeatherResponse({ current: {}, current_units: {}, daily: {} });
    assert.equal(minimal.sunrise, null);
    assert.equal(minimal.sunset, null);
    assert.equal(minimal.daylightSeconds, null);
});

// ------------------------------------------------------ correctness / chaos / security

test('security: escapeHtml neutralizes markup, quotes, and ampersands', async () => {
    const { escapeHtml } = await import('../dist/components/nativeUi.js');

    assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(escapeHtml(`"><img src=x onerror=alert(1)>`), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(escapeHtml("O'Brien & Sons"), 'O&#39;Brien &amp; Sons');
    // Values that are not strings (a corrupt label, an undefined field) must not throw.
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(42), '42');
});

test('fuzzyScore ranks substring matches over subsequence matches and rejects non-matches', async () => {
    const { fuzzyScore } = await import('../dist/components/nativeUi.js');

    // Empty query matches everything, ranked equally, so the panel shows the
    // full list on focus before the user has typed anything.
    assert.equal(fuzzyScore('', 'Project Hub'), 0);

    // A literal substring match ranks by how early it starts.
    assert.equal(fuzzyScore('meeting', 'Meeting Prep'), 0);
    assert.ok(fuzzyScore('prep', 'Meeting Prep') > 0);

    // A scattered but in-order subsequence still matches ("otx" -> "prOjecT X"),
    // but always ranks below every substring match.
    const substringScore = fuzzyScore('meet', 'Meeting Prep');
    const subsequenceScore = fuzzyScore('mtg', 'Meeting');
    assert.ok(subsequenceScore !== null && substringScore !== null && subsequenceScore > substringScore);

    // Out-of-order or missing characters are not a match.
    assert.equal(fuzzyScore('xyz', 'Meeting Prep'), null);
    assert.equal(fuzzyScore('gnitem', 'Meeting'), null);
});

test('security: buildWeatherUrl never leaks the free-text location label', async () => {
    const { buildWeatherUrl } = await import('../dist/engine/weatherEngine.js');
    const url = buildWeatherUrl({
        label: '"><script>alert(document.cookie)</script>',
        latitude: 37.8715,
        longitude: -122.273,
        units: 'metric',
    });

    assert.equal(url.includes('script'), false);
    assert.equal(url.includes('alert'), false);
    assert.match(url, /latitude=37\.8715/);
});

test('chaos: YamlParser does not throw on adversarial input', () => {
    const inputs = [
        '',
        '   \n\n\t  ',
        ':::: not: valid: at: all ::::',
        '"'.repeat(500),
        'a: ' + '['.repeat(200),
        'colon: value: with: many: colons',
        'unicode: 🎉 emoji and   control chars',
        Array.from({ length: 500 }, (_, i) => `- item_${i}`).join('\n'),
    ];

    for (const input of inputs) {
        assert.doesNotThrow(() => YamlParser.parse(input), `should not throw on: ${JSON.stringify(input.slice(0, 40))}`);
    }
});

test('chaos: NoteCreationEngine rejects an unknown template rather than crashing silently', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);

    assert.throws(() => engine.planNoteCreation({ type: '__does_not_exist__', title: 'x' }), /Unknown note template/);
});

test('applyDerivedTopics populates inherited topics into plan relations and buildAttributeRows', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const settingsEngine = new SettingsEngine({ enableDerivedTopics: true });

    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, settingsEngine);
    const plan = engine.planNoteCreation({
        type: 'task',
        title: 'Perform security patch',
        relations: { project: 'proj_beta_456' },
    });

    assert.deepEqual(plan.inheritedTopicSources, ['proj_beta_456']);

    const parentTopicMap = {
        proj_beta_456: ['topic_sec', 'topic_infra'],
    };

    applyDerivedTopics(plan, parentTopicMap, relEngine);

    const topicRelations = plan.relationsToCreate.filter((r) => r.name === 'topic');
    assert.equal(topicRelations.length, 2);
    assert.deepEqual(topicRelations.map((r) => r.value).sort(), ['topic_infra', 'topic_sec']);

    const rows = buildAttributeRows(plan);
    const topicRows = rows.filter((r) => r.type === 'relation' && r.name === 'topic');
    assert.equal(topicRows.length, 2);
});

test('Multi-value relationships support multiple target note IDs in plan and auto-clone', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();

    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);
    const plan = engine.planNoteCreation({
        type: 'task',
        title: 'Cross-project sync',
        relations: { project: ['proj_alpha', 'proj_beta'] },
    });

    assert.deepEqual(plan.autoCloneContainers, ['proj_alpha', 'proj_beta']);
    const projectRelations = plan.relationsToCreate.filter((r) => r.name === 'project');
    assert.equal(projectRelations.length, 2);
    assert.deepEqual(projectRelations.map((r) => r.value), ['proj_alpha', 'proj_beta']);
});

test('exportTemplateToYaml and importTemplateFromYaml round-trip single template specifications', () => {
    const tplEngine = new TemplateEngine();
    const origTpl = tplEngine.getTemplate('task');
    assert.ok(origTpl);

    const yamlStr = exportTemplateToYaml(origTpl);
    assert.match(yamlStr, /Trilium Template Definition: Task/);

    const imported = importTemplateFromYaml(yamlStr);
    assert.equal(imported.id, 'task');
    assert.equal(imported.title, 'Task');
    assert.equal(imported.category, 'work');
    assert.ok(imported.attributes.length >= 2);
    assert.equal(imported.relationships[0].relationName, 'project');
});

test('NoteCreationEngine handles archiveNote, removeLabel, and prependContent rule actions', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine([]);
    const settingsEngine = new SettingsEngine({ autoRunIfThenRulesOnCreation: true });

    ifThenRuleEngine.registerRule({
        id: 'rule_custom_actions',
        name: 'Custom Action Test',
        description: 'Test archiveNote and prependContent',
        enabled: true,
        trigger: { type: 'onNoteCreated', targetTemplateId: 'task' },
        conditions: [],
        actions: [
            { type: 'archiveNote', params: { containerMarker: 'archiveRoot' } },
            { type: 'prependContent', params: { content: '<h3>Header Checklist</h3>' } },
        ],
    });

    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine, settingsEngine);
    const plan = engine.planNoteCreation({ type: 'task', title: 'Legacy Cleanup' });

    assert.ok(plan.labelsToCreate.some((l) => l.name === 'archived'));
    assert.deepEqual(plan.autoCloneContainerMarkers, ['archiveRoot']);
    assert.match(plan.content, /<h3>Header Checklist<\/h3>/);
});

test('NoteCreationEngine plans New Story Project with Active Project Hub and child notes', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);

    const plan = engine.planNoteCreation({ type: 'story', title: 'Quantum Computing Breakthrough', mode: 'project' });

    assert.equal(plan.templateId, 'projectHub');
    assert.equal(plan.rootContainerMarker, 'activeProjectRoot');
    assert.equal(plan.formattedTitle, 'Quantum Computing Breakthrough');
    assert.ok(plan.labelsToCreate.some((l) => l.name === 'kind' && l.value === 'project'));
    assert.ok(plan.labelsToCreate.some((l) => l.name === 'status' && l.value === 'active'));
    assert.ok(plan.childNotesToCreate && plan.childNotesToCreate.length === 2);
    assert.equal(plan.childNotesToCreate[0].title, 'Quantum Computing Breakthrough — Draft 1');
    assert.match(plan.childNotesToCreate[0].content, /<h2>DEK<\/h2>/);
    assert.equal(plan.childNotesToCreate[1].title, 'Quantum Computing Breakthrough — Reporting Notes');
    assert.match(plan.childNotesToCreate[1].content, /<h2>REPORTING NOTES<\/h2>/);
});

test('NoteCreationEngine plans New Edit Package with Active Edit Hub and Round 1 draft', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);

    const plan = engine.planNoteCreation({ type: 'edit', title: 'Policy Paper Proofread', mode: 'edit' });

    assert.equal(plan.templateId, 'projectHub');
    assert.equal(plan.rootContainerMarker, 'activeProjectRoot');
    assert.ok(plan.labelsToCreate.some((l) => l.name === 'kind' && l.value === 'edit'));
    assert.ok(plan.childNotesToCreate && plan.childNotesToCreate.length === 1);
    assert.equal(plan.childNotesToCreate[0].title, 'Policy Paper Proofread — Round 1');
    assert.match(plan.childNotesToCreate[0].content, /<h2>REQUESTED CHANGES<\/h2>/);
    assert.match(plan.childNotesToCreate[0].content, /<h2>WRITER RESPONSE<\/h2>/);
});

test('NoteCreationEngine plans Scratch Note capture', () => {
    const tplEngine = new TemplateEngine();
    const relEngine = new RelationshipEngine(tplEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const engine = new NoteCreationEngine(tplEngine, relEngine, ifThenRuleEngine);

    const plan = engine.planNoteCreation({ type: 'scratch', title: 'Quick Idea' });

    assert.equal(plan.templateId, 'scratch');
    assert.equal(plan.rootContainerMarker, 'unassignedRoot');
    assert.equal(plan.formattedTitle, 'Quick Idea');
});

test('reconcileProjectHubStatuses handles uninitialized API gracefully', async () => {
    const { reconcileProjectHubStatuses } = await import('../dist/engine/noteMaterializer.js');
    const result = await reconcileProjectHubStatuses();
    assert.equal(result, 0);
});
