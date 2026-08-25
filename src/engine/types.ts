/**
 * Types for Trilium Notes System & Template Studio Plugin Scaffold
 */

export type AttributeType = 'label' | 'relation';
export type AttributeDataType = 'string' | 'number' | 'date' | 'boolean' | 'select' | 'relation';

export interface PromotedAttributeDef {
    name: string;
    type: AttributeType;
    dataType: AttributeDataType;
    label?: string;
    description?: string;
    defaultValue?: string | number | boolean;
    options?: string[]; // For select type
    targetTemplateId?: string; // For relation type
    isPromoted: boolean;
    inverseRelationName?: string;
}

export interface TemplateRelationshipDef {
    id: string;
    name: string;
    relationName: string;
    targetTemplateId: string;
    targetTemplateName: string;
    isMulti: boolean;
    autoCloneToParent: boolean;
    inheritTopics: boolean;
    direction: 'parent' | 'child' | 'peer';
    inverseRelationName?: string;
}

export interface TemplateCategoryDef {
    id: string;
    title: string;
    description: string;
    icon: string;
    defaultRootMarker?: string; // e.g. projectRoot, storyDraftRoot, peopleRoot, topicRoot, taskRoot
    autoJournalClone?: boolean;
    inheritParentTopics?: boolean;
    projectScopedDefault?: boolean;
    isBuiltin?: boolean;
}

export interface TemplateDefinition {
    id: string;
    marker: string; // e.g. extTask, extMeeting, extProjectHub
    title: string; // Template display name
    icon: string; // Icon name e.g. 'check-square', 'calendar-event'
    category: string; // Category ID e.g. 'work', 'drafts', 'people', 'system', 'custom'
    rootContainerMarker: string; // e.g. taskRoot, meetingRoot, projectRoot
    titlePattern: string; // e.g. 'YYYY-MM-DD - dddd', 'Project: {title}'
    defaultContent: string; // Default HTML/Markdown skeleton
    attributes: PromotedAttributeDef[];
    relationships: TemplateRelationshipDef[];
    projectScoped?: boolean;
    noJournalClone?: boolean;
    isBuiltin?: boolean;
    noteType?: string;
}

// If/Then Rules Engine Types (event-triggered automation)
export type TriggerType = 'onNoteCreated' | 'onAttributeChanged' | 'onManualAction' | 'onScheduledCheck';

export interface IfThenTrigger {
    type: TriggerType;
    targetCategory?: string; // Target all templates in a category (e.g. work, drafts, people)
    targetTemplateId?: string; // Limit to specific template
    targetContainerMarker?: string; // Limit to specific root
    attributeName?: string; // For onAttributeChanged
}


export type OperatorType =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'isSet'
    | 'isNotSet'
    | 'isEmpty'
    | 'greaterThan'
    | 'lessThan';

export interface IfThenCondition {
    field: string; // Attribute name or system property (e.g. title, type)
    operator: OperatorType;
    value: string | number | boolean;
}

export type ActionType =
    | 'setLabel'
    | 'removeLabel'
    | 'setRelation'
    | 'cloneToContainer'
    | 'syncDerivedTopics'
    | 'createLinkedNote'
    | 'setTaskStatus'
    | 'archiveNote'
    | 'prependContent'
    | 'runScript';

export interface IfThenAction {
    type: ActionType;
    params: {
        labelName?: string;
        labelValue?: string;
        relationName?: string;
        targetNoteId?: string;
        containerMarker?: string;
        templateId?: string;
        scriptMarker?: string;
        [key: string]: any;
    };
}

export interface IfThenRuleDef {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    trigger: IfThenTrigger;
    conditions: IfThenCondition[];
    actions: IfThenAction[];
    isBuiltin?: boolean;
}

// Today Homepage Layout Types
export interface TodayWidgetConfig {
    id: string;
    title: string;
    marker: string; // e.g. openTasks, activeProjects, dueSoon, highPriority
    visible: boolean;
    order: number;
    colSpan: 1 | 2 | 3;
    columns: [string, string][]; // Label/property headers and keys
    emptyMessage: string;
    actionType?: string;
    actionLabel?: string;
}

/**
 * How many columns the dashboard grid uses at full width. `auto` fits as many as
 * the pane can hold at a readable width, which is what most panes want; a fixed
 * count is for people who want the same shape regardless of width. Every setting
 * still collapses on a narrow pane.
 */
export type DashboardColumns = 'auto' | 1 | 2 | 3;

export type DashboardDensity = 'comfortable' | 'compact';

/**
 * Location the weather widget reports for. Coordinates are stored rather than a
 * place name so the widget never has to call a geocoding service.
 */
export interface WeatherConfig {
    /** Shown as the widget's location; purely cosmetic. */
    label: string;
    latitude: number;
    longitude: number;
    units: 'metric' | 'imperial';
}

export interface TodayLayoutConfig {
    journalWidthPercent: number;
    showQuickCaptureBar: boolean;
    /** Optional so a layout saved before these existed still loads; see TodayEngine. */
    columns?: DashboardColumns;
    density?: DashboardDensity;
    weather?: WeatherConfig;
    /** Daily word target for the Writing Goal widget. */
    writingGoalWords?: number;
    /** Days a still-open note can go untouched before the Needs Attention widget flags it. */
    staleThresholdDays?: number;
    widgets: TodayWidgetConfig[];
}

export interface NotesSystemConfig {
    version: string;
    templates: TemplateDefinition[];
    categories?: TemplateCategoryDef[];
    ifThenRules: IfThenRuleDef[];
    todayLayout: TodayLayoutConfig;
}
