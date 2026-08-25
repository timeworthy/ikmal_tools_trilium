/**
 * If/Then Rules Engine: event-triggered automation rule engine for Trilium Notes.
 */

import { IfThenRuleDef, IfThenCondition, ConditionGroup, IfThenAction, TriggerType } from './types.js';

export const BUILTIN_IF_THEN_RULES: IfThenRuleDef[] = [
    // 1. Global System Rules
    {
        id: 'rule_project_autoclone',
        name: 'Global -> Auto-Clone to Parent Container',
        description: 'When a note is created with a ~project relation, automatically clone it under the target Project Hub container note.',
        enabled: true,
        isBuiltin: true,
        trigger: {
            type: 'onNoteCreated',
        },
        conditions: [
            { field: 'project', operator: 'isSet', value: true },
        ],
        actions: [
            { type: 'cloneToContainer', params: { relationName: 'project' } },
        ],
    },
    {
        id: 'rule_derived_topic_sync',
        name: 'Global -> Sync Derived Topics',
        description: 'When a note is created or linked to a project/client, automatically recalculate and set derived topics.',
        enabled: true,
        isBuiltin: true,
        trigger: {
            type: 'onNoteCreated',
        },
        conditions: [],
        actions: [
            { type: 'syncDerivedTopics', params: {} },
        ],
    },

    // 2. Category-Wide Rules (Work, Drafts, People)
    {
        id: 'rule_work_category_done_date',
        name: 'Work Category -> Record Completion Date',
        description: 'Applies to ALL notes in the Work category. When status is marked done, automatically sets #doneDate.',
        enabled: true,
        isBuiltin: true,
        trigger: {
            type: 'onAttributeChanged',
            targetCategory: 'work',
            attributeName: 'status',
        },
        conditions: [
            { field: 'status', operator: 'equals', value: 'done' },
        ],
        actions: [
            { type: 'setLabel', params: { labelName: 'doneDate', labelValue: '{TODAY}' } },
        ],
    },
    {
        id: 'rule_drafts_category_editorial_round',
        name: 'Drafts Category -> Auto-Sync Review Round',
        description: 'Applies to ALL notes in the Drafts category (story, edit, emailDraft, scratch). Syncs editorial review round.',
        enabled: true,
        isBuiltin: true,
        trigger: {
            type: 'onNoteCreated',
            targetCategory: 'drafts',
        },
        conditions: [],
        actions: [
            // `round` is a numeric workflow key used for ordering and for
            // calculating the next round. A display phrase here silently made
            // Number(#round) become NaN, so keep review state in its own label.
            { type: 'setLabel', params: { labelName: 'reviewState', labelValue: 'review' } },
        ],
    },
    {
        id: 'rule_people_category_followup',
        name: 'People Category -> Auto-Tag Contact Follow-up',
        description: 'Applies to ALL notes in People category (person, organization). Auto-tags contact entries when followUpDate is set.',
        enabled: true,
        isBuiltin: true,
        trigger: {
            type: 'onAttributeChanged',
            targetCategory: 'people',
            attributeName: 'followUpDate',
        },
        conditions: [],
        actions: [
            { type: 'setLabel', params: { labelName: 'followUpNeeded', labelValue: 'true' } },
        ],
    },

    // 3. Template-Specific Rules
    {
        id: 'rule_task_done_date',
        name: 'Task Template -> High Priority Highlight',
        description: 'When a Task priority is set to high, highlight it with color.',
        enabled: true,
        isBuiltin: true,
        trigger: {
            type: 'onAttributeChanged',
            targetTemplateId: 'task',
            attributeName: 'priority',
        },
        conditions: [
            { field: 'priority', operator: 'equals', value: 'high' },
        ],
        actions: [
            { type: 'setLabel', params: { labelName: 'color', labelValue: '#e74c3c' } },
        ],
    },
];

export interface NoteContext {
    noteId: string;
    title: string;
    templateId: string;
    category?: string;
    /** The primary container marker used when the note is created. */
    containerMarker?: string;
    attributes: Record<string, any>;
    /** A relation may hold one target or several. */
    relations: Record<string, string | string[]>;
}

/** One rule that fired, with its actions after placeholder substitution. */
export interface IfThenRuleResult {
    ruleId: string;
    ruleName: string;
    matched: boolean;
    executedActions: IfThenAction[];
}

export class IfThenRuleEngine {
    private rules: Map<string, IfThenRuleDef> = new Map();

    constructor(initialRules: IfThenRuleDef[] = BUILTIN_IF_THEN_RULES) {
        for (const rule of initialRules) {
            this.rules.set(rule.id, rule);
        }
    }

    public registerRule(rule: IfThenRuleDef): void {
        this.rules.set(rule.id, rule);
    }

    public getRule(ruleId: string): IfThenRuleDef | undefined {
        return this.rules.get(ruleId);
    }

    public getAllRules(): IfThenRuleDef[] {
        return Array.from(this.rules.values());
    }

    public toggleRule(ruleId: string, enabled: boolean): void {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    }

    public deleteRule(ruleId: string): boolean {
        return this.rules.delete(ruleId);
    }

    /**
     * Every enabled rule whose trigger and conditions match, each with its actions
     * resolved. Callers need to know which rule fired — to report it and to avoid
     * re-running it — so this returns rule results rather than a flat action list.
     */
    public evaluateEvent(
        eventType: TriggerType,
        context: NoteContext,
        changedAttribute?: string
    ): IfThenRuleResult[] {
        const results: IfThenRuleResult[] = [];

        for (const rule of this.rules.values()) {
            if (!rule.enabled) continue;

            if (rule.trigger.type !== eventType) continue;

            if (rule.trigger.targetTemplateId && rule.trigger.targetTemplateId !== context.templateId) {
                continue;
            }

            // A scoped rule must not run when the caller omitted the scope. The
            // old truthy guard made a missing category behave like a wildcard.
            if (rule.trigger.targetCategory && rule.trigger.targetCategory !== context.category) {
                continue;
            }

            if (rule.trigger.targetContainerMarker
                && rule.trigger.targetContainerMarker !== context.containerMarker) {
                continue;
            }

            // The attribute filter only narrows the event it belongs to; a creation
            // rule that names an attribute is scoping, not waiting for a change.
            if (eventType === 'onAttributeChanged' && rule.trigger.attributeName && rule.trigger.attributeName !== changedAttribute) {
                continue;
            }

            if (this.checkRuleConditions(rule, context)) {
                results.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    matched: true,
                    executedActions: rule.actions.map((action) => this.processActionTemplates(action, context)),
                });
            }
        }

        return results;
    }

    /** Substitutes the placeholders an action's params may carry and processes date offsets. */
    public processActionTemplates(action: IfThenAction, context: NoteContext): IfThenAction {
        const copy: IfThenAction = JSON.parse(JSON.stringify(action));
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (copy.type === 'setDueDateOffset') {
            let offsetDays = copy.params.offsetDays;
            if (offsetDays === undefined && copy.params.offsetString) {
                const s = copy.params.offsetString.trim();
                if (s === '+1w' || s === '1w') offsetDays = 7;
                else if (s === '+2w' || s === '2w') offsetDays = 14;
                else if (s === '+1m' || s === '1m') offsetDays = 30;
                else if (s.endsWith('d')) offsetDays = parseInt(s, 10);
                else offsetDays = parseInt(s, 10);
            }
            const targetDate = new Date(now.getTime() + (offsetDays || 0) * 86400000);
            const targetIso = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            copy.params.labelName = 'dueDate';
            copy.params.labelValue = targetIso;
        }

        for (const key of Object.keys(copy.params)) {
            const value = copy.params[key];
            if (typeof value === 'string') {
                copy.params[key] = value
                    .replace('{TODAY}', today)
                    .replace('{NOTE_TITLE}', context.title)
                    .replace('{NOTE_ID}', context.noteId);
            }
        }

        return copy;
    }

    public evaluateCondition(cond: IfThenCondition, context: NoteContext): boolean {
        const val = context.attributes[cond.field]
            ?? context.relations[cond.field]
            ?? ({
                title: context.title,
                templateId: context.templateId,
                category: context.category,
                containerMarker: context.containerMarker,
            } as Record<string, any>)[cond.field];

        switch (cond.operator) {
            case 'equals':
                return val === cond.value;
            case 'notEquals':
                return val !== cond.value;
            case 'contains':
                if (typeof val === 'string') {
                    return val.includes(String(cond.value));
                } else if (Array.isArray(val)) {
                    return val.includes(cond.value);
                }
                return false;
            case 'notContains':
                if (typeof val === 'string') {
                    return !val.includes(String(cond.value));
                } else if (Array.isArray(val)) {
                    return !val.includes(cond.value);
                }
                return true;
            case 'startsWith':
                return typeof val === 'string' && val.startsWith(String(cond.value));
            case 'endsWith':
                return typeof val === 'string' && val.endsWith(String(cond.value));
            case 'isEmpty':
                return val === undefined || val === null || val === '';
            case 'greaterThan':
                return !Number.isNaN(Number(val)) && Number(val) > Number(cond.value);
            case 'lessThan':
                return !Number.isNaN(Number(val)) && Number(val) < Number(cond.value);
            case 'isSet': {
                const expectSet = cond.value !== false;
                const isPresent = val !== undefined && val !== null && val !== '';
                return expectSet === isPresent;
            }
            case 'isNotSet':
                return val === undefined || val === null || val === '';
            default:
                return false;
        }
    }

    public evaluateConditionGroup(group: ConditionGroup, context: NoteContext): boolean {
        if (!group || !Array.isArray(group.conditions)) return true;
        if (group.operator === 'any') {
            if (group.conditions.length === 0) return true;
            return group.conditions.some((item: IfThenCondition | ConditionGroup) => {
                if ('operator' in item && 'conditions' in item) {
                    return this.evaluateConditionGroup(item as ConditionGroup, context);
                }
                return this.evaluateCondition(item as IfThenCondition, context);
            });
        }
        // default 'all' (AND)
        return group.conditions.every((item: IfThenCondition | ConditionGroup) => {
            if ('operator' in item && 'conditions' in item) {
                return this.evaluateConditionGroup(item as ConditionGroup, context);
            }
            return this.evaluateCondition(item as IfThenCondition, context);
        });
    }

    public checkRuleConditions(rule: IfThenRuleDef, context: NoteContext): boolean {
        if (rule.conditionGroup) {
            if (!this.evaluateConditionGroup(rule.conditionGroup, context)) return false;
        }
        if (rule.conditions && rule.conditions.length > 0) {
            for (const cond of rule.conditions) {
                if (!this.evaluateCondition(cond, context)) return false;
            }
        }
        return true;
    }
}
