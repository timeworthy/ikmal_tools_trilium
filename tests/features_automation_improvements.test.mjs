import test from 'node:test';
import assert from 'node:assert/strict';
import { IfThenRuleEngine } from '../dist/engine/ifThenRuleEngine.js';
import { TemplateEngine } from '../dist/engine/templateEngine.js';

test('IfThenRuleEngine: ConditionGroup boolean AND evaluation', () => {
    const engine = new IfThenRuleEngine([]);
    engine.registerRule({
        id: 'rule_and_test',
        name: 'Urgent Work Task Rule',
        description: 'Matches tasks that are high priority AND in progress',
        enabled: true,
        trigger: { type: 'onNoteCreated' },
        conditionGroup: {
            operator: 'all',
            conditions: [
                { field: 'priority', operator: 'equals', value: 'high' },
                { field: 'status', operator: 'equals', value: 'in_progress' },
            ],
        },
        actions: [
            { type: 'setLabel', params: { labelName: 'flagged', labelValue: 'true' } },
        ],
    });

    const matchingContext = {
        noteId: 'n1',
        title: 'Launch Project',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { priority: 'high', status: 'in_progress' },
        relations: {},
    };

    const mismatchContext = {
        noteId: 'n2',
        title: 'Draft Docs',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { priority: 'high', status: 'todo' },
        relations: {},
    };

    const res1 = engine.evaluateEvent('onNoteCreated', matchingContext);
    assert.equal(res1.length, 1);
    assert.equal(res1[0].ruleId, 'rule_and_test');

    const res2 = engine.evaluateEvent('onNoteCreated', mismatchContext);
    assert.equal(res2.length, 0);
});

test('IfThenRuleEngine: ConditionGroup boolean OR evaluation', () => {
    const engine = new IfThenRuleEngine([]);
    engine.registerRule({
        id: 'rule_or_test',
        name: 'Urgent or Overdue Rule',
        description: 'Matches tasks that are either high priority OR marked overdue',
        enabled: true,
        trigger: { type: 'onAttributeChanged', attributeName: 'status' },
        conditionGroup: {
            operator: 'any',
            conditions: [
                { field: 'priority', operator: 'equals', value: 'urgent' },
                { field: 'isOverdue', operator: 'equals', value: 'true' },
            ],
        },
        actions: [
            { type: 'setLabel', params: { labelName: 'escalated', labelValue: 'true' } },
        ],
    });

    const ctxUrgent = {
        noteId: 'n1',
        title: 'Server Alert',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { priority: 'urgent', isOverdue: 'false' },
        relations: {},
    };

    const ctxOverdue = {
        noteId: 'n2',
        title: 'Review PR',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { priority: 'low', isOverdue: 'true' },
        relations: {},
    };

    const ctxNeither = {
        noteId: 'n3',
        title: 'Clean Desk',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { priority: 'low', isOverdue: 'false' },
        relations: {},
    };

    assert.equal(engine.evaluateEvent('onAttributeChanged', ctxUrgent, 'status').length, 1);
    assert.equal(engine.evaluateEvent('onAttributeChanged', ctxOverdue, 'status').length, 1);
    assert.equal(engine.evaluateEvent('onAttributeChanged', ctxNeither, 'status').length, 0);
});

test('IfThenRuleEngine: Nested ConditionGroups ((A AND B) OR (C AND D))', () => {
    const engine = new IfThenRuleEngine([]);
    engine.registerRule({
        id: 'rule_nested_test',
        name: 'Complex Triage Rule',
        description: 'Matches (work task with high priority) OR (draft with editing status)',
        enabled: true,
        trigger: { type: 'onNoteCreated' },
        conditionGroup: {
            operator: 'any',
            conditions: [
                {
                    operator: 'all',
                    conditions: [
                        { field: 'category', operator: 'equals', value: 'work' },
                        { field: 'priority', operator: 'equals', value: 'high' },
                    ],
                },
                {
                    operator: 'all',
                    conditions: [
                        { field: 'category', operator: 'equals', value: 'drafts' },
                        { field: 'status', operator: 'equals', value: 'editing' },
                    ],
                },
            ],
        },
        actions: [
            { type: 'setLabel', params: { labelName: 'triaged', labelValue: 'true' } },
        ],
    });

    const workHigh = {
        noteId: 'n1',
        title: 'Work Task',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: { priority: 'high' },
        relations: {},
    };

    const draftEditing = {
        noteId: 'n2',
        title: 'Story Draft',
        templateId: 'storyDraft',
        category: 'drafts',
        containerMarker: 'storyDraftRoot',
        attributes: { status: 'editing' },
        relations: {},
    };

    const draftDrafting = {
        noteId: 'n3',
        title: 'Story Draft 2',
        templateId: 'storyDraft',
        category: 'drafts',
        containerMarker: 'storyDraftRoot',
        attributes: { status: 'drafting' },
        relations: {},
    };

    assert.equal(engine.evaluateEvent('onNoteCreated', workHigh).length, 1);
    assert.equal(engine.evaluateEvent('onNoteCreated', draftEditing).length, 1);
    assert.equal(engine.evaluateEvent('onNoteCreated', draftDrafting).length, 0);
});

test('IfThenRuleEngine: setDueDateOffset action transforms +1w / +3d / +1m', () => {
    const engine = new IfThenRuleEngine([]);
    const ctx = {
        noteId: 'n100',
        title: 'Review Architecture',
        templateId: 'task',
        category: 'work',
        containerMarker: 'taskRoot',
        attributes: {},
        relations: {},
    };

    const actionWeek = {
        type: 'setDueDateOffset',
        params: { offsetString: '+1w' },
    };

    const processedWeek = engine.processActionTemplates(actionWeek, ctx);
    assert.equal(processedWeek.params.labelName, 'dueDate');
    assert.match(processedWeek.params.labelValue, /^\d{4}-\d{2}-\d{2}$/);

    const targetDate = new Date(processedWeek.params.labelValue);
    const today = new Date();
    const diffDays = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
    assert.ok(diffDays >= 6 && diffDays <= 8, `Expected ~7 days offset, got ${diffDays}`);
});

test('TemplateEngine: formatTitle with custom prompts, project names, and week patterns', () => {
    const engine = new TemplateEngine();
    
    // Register custom template with prompt placeholder and week formatting
    engine.registerTemplate({
        id: 'clientMeeting',
        marker: 'extClientMeeting',
        title: 'Client Meeting',
        icon: 'users',
        category: 'work',
        rootContainerMarker: 'meetingRoot',
        titlePattern: '{date:YYYY-[W]WW} - {prompt:Client Name} Meeting: {title} ({project:name})',
        defaultContent: '<p></p>',
        attributes: [],
        relationships: [],
    });

    const fixedDate = new Date('2026-08-25T12:00:00Z');
    const formatted = engine.formatTitle(
        'clientMeeting',
        'Q3 Roadmap',
        fixedDate,
        {
            projectName: 'Platform Refactor',
            prompts: { 'Client Name': 'Acme Corp' },
        }
    );

    assert.equal(formatted, '2026-W35 - Acme Corp Meeting: Q3 Roadmap (Platform Refactor)');
});

test('TemplateEngine: weeklyReview built-in template presence and attributes', () => {
    const engine = new TemplateEngine();
    const weeklyTpl = engine.getTemplate('weeklyReview');
    assert.ok(weeklyTpl, 'weeklyReview template must be present');
    assert.equal(weeklyTpl.marker, 'extWeeklyReview');
    assert.equal(weeklyTpl.category, 'work');
    assert.equal(weeklyTpl.rootContainerMarker, 'calendarRoot');

    const attrNames = weeklyTpl.attributes.map((a) => a.name);
    assert.ok(attrNames.includes('reviewDate'));
    assert.ok(attrNames.includes('weekNumber'));
    assert.ok(attrNames.includes('mood'));

    const relNames = weeklyTpl.relationships.map((r) => r.relationName);
    assert.ok(relNames.includes('reviewedProjects'));

    const title = engine.formatTitle('weeklyReview', '', new Date('2026-08-25T12:00:00Z'));
    assert.equal(title, '2026-W35 - Weekly Review');
});
