/**
 * YAML Specification Engine for Trilium Notes System.
 *
 * The specification is the whole configurable system in one document: homepage
 * layout, template categories, templates (schema, promoted attributes, parent
 * links, content skeleton) and automation rules. Dumping and re-applying it is the
 * package's import/export path, so the two directions must agree — everything
 * emitted here is read back by {@link parseAndApplyYamlSpec}.
 *
 * Derived behaviour is deliberately absent. Auto-filing and topic inheritance are
 * computed by RelationshipEngine from each template's parent links, so they are
 * described there rather than duplicated as their own section.
 */

import { TodayLayoutConfig, TemplateDefinition, TemplateCategoryDef, IfThenRuleDef, TodayWidgetConfig } from './types.js';
import { TemplateEngine } from './templateEngine.js';
import { RelationshipEngine } from './relationshipEngine.js';
import { IfThenRuleEngine } from './ifThenRuleEngine.js';
import { TodayEngine } from './todayEngine.js';
import { YamlParser } from './yamlParser.js';

export const SPEC_VERSION = '1.1.0';
export const PACKAGE_ID = 'iansherr/ikmal_tools_trilium';

export interface NotesSystemYamlSpec {
    version: string;
    packageId: string;
    homepage: TodayLayoutConfig;
    categories: TemplateCategoryDef[];
    templates: TemplateDefinition[];
    ifThenRules: IfThenRuleDef[];
}

const HEADER = `# ==============================================================================
# Trilium Notes System — package specification
#
# Everything the package can be configured with: the Today Homepage layout, the
# template categories, every template (schema, promoted attributes, parent links
# and content skeleton) and the automation rules.
#
# Editing and saving this replaces the live configuration. Auto-filing and topic
# inheritance are not listed separately — they are derived from each template's
# parentLinks below.
# ==============================================================================
`;

/**
 * Safe reset value for the editable specification.
 *
 * An empty saved value means "no custom YAML overrides". The dashboard still
 * constructs its built-in templates and rules, while the Settings editor gets
 * a valid, intentionally small document to edit instead of a blank textarea or
 * a parse error.
 */
export const DEFAULT_STARTER_YAML_SPEC = `${HEADER}
version: ${SPEC_VERSION}
packageId: ${PACKAGE_ID}
homepage:
  columns: auto
  density: comfortable
categories: []
templates: []
ifThenRules: []
`;

export function dumpYamlSpec(
    todayLayout: TodayLayoutConfig,
    templateEngine: TemplateEngine,
    _relationshipEngine: RelationshipEngine,
    ifThenRuleEngine: IfThenRuleEngine
): string {
    const spec = {
        version: SPEC_VERSION,
        packageId: PACKAGE_ID,
        homepage: dumpHomepage(todayLayout),
        categories: templateEngine.getAllCategories().map(dumpCategory),
        templates: templateEngine.getAllTemplates().map(dumpTemplate),
        ifThenRules: ifThenRuleEngine.getAllRules().map(dumpRule),
    };

    return `${HEADER}\n${YamlParser.stringify(spec)}\n`;
}

function dumpHomepage(layout: TodayLayoutConfig) {
    return {
        journalWidthPercent: layout.journalWidthPercent,
        showQuickCaptureBar: layout.showQuickCaptureBar,
        columns: layout.columns ?? 'auto',
        density: layout.density ?? 'comfortable',
        weather: {
            label: layout.weather?.label ?? '',
            latitude: layout.weather?.latitude ?? 0,
            longitude: layout.weather?.longitude ?? 0,
            units: layout.weather?.units ?? 'metric',
        },
        writingGoalWords: layout.writingGoalWords ?? 500,
        staleThresholdDays: layout.staleThresholdDays ?? 14,
        widgets: [...layout.widgets]
            .sort((a, b) => a.order - b.order)
            .map((w) => ({
                id: w.id,
                title: w.title,
                marker: w.marker,
                visible: w.visible,
                order: w.order,
                colSpan: w.colSpan,
            })),
    };
}

function dumpCategory(cat: TemplateCategoryDef) {
    return {
        id: cat.id,
        title: cat.title,
        description: cat.description,
        icon: cat.icon,
        defaultRootMarker: cat.defaultRootMarker ?? '',
        autoJournalClone: cat.autoJournalClone !== false,
        inheritParentTopics: cat.inheritParentTopics !== false,
        projectScopedDefault: Boolean(cat.projectScopedDefault),
        isBuiltin: Boolean(cat.isBuiltin),
    };
}

function dumpTemplate(tpl: TemplateDefinition) {
    return {
        id: tpl.id,
        marker: tpl.marker,
        title: tpl.title,
        icon: tpl.icon,
        category: tpl.category,
        rootContainerMarker: tpl.rootContainerMarker,
        titlePattern: tpl.titlePattern,
        projectScoped: Boolean(tpl.projectScoped),
        noJournalClone: Boolean(tpl.noJournalClone),
        isBuiltin: Boolean(tpl.isBuiltin),
        attributes: (tpl.attributes ?? []).map((a) => ({
            name: a.name,
            type: a.type,
            dataType: a.dataType,
            label: a.label ?? '',
            defaultValue: a.defaultValue ?? '',
            options: a.options ?? [],
            isPromoted: a.isPromoted !== false,
        })),
        parentLinks: (tpl.relationships ?? []).map((r) => ({
            relationName: r.relationName,
            targetTemplateId: r.targetTemplateId,
            targetTemplateName: r.targetTemplateName,
            isMulti: Boolean(r.isMulti),
            autoCloneToParent: r.autoCloneToParent !== false,
            inheritTopics: r.inheritTopics !== false,
            direction: r.direction,
        })),
        defaultContent: tpl.defaultContent ?? '',
    };
}

function dumpRule(rule: IfThenRuleDef) {
    return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        isBuiltin: Boolean(rule.isBuiltin),
        trigger: {
            type: rule.trigger.type,
            targetCategory: rule.trigger.targetCategory ?? '',
            targetTemplateId: rule.trigger.targetTemplateId ?? '',
            targetContainerMarker: rule.trigger.targetContainerMarker ?? '',
            attributeName: rule.trigger.attributeName ?? '',
        },
        conditions: (rule.conditions ?? []).map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
        })),
        actions: (rule.actions ?? []).map((a) => ({
            type: a.type,
            params: a.params ?? {},
        })),
    };
}

export interface ApplyResult {
    success: boolean;
    message: string;
}

/**
 * Reads a specification back into the engines. Everything {@link dumpYamlSpec}
 * writes is applied; sections left out of the document are left alone rather than
 * cleared, so a partial specification is a patch rather than a truncation.
 */
export function parseAndApplyYamlSpec(
    yamlString: string,
    todayEngine: TodayEngine,
    templateEngine: TemplateEngine,
    ifThenRuleEngine: IfThenRuleEngine
): ApplyResult {
    if (!yamlString || !yamlString.trim()) {
        return { success: false, message: 'Specification is empty.' };
    }

    let spec: any;
    try {
        spec = YamlParser.parse(yamlString);
    } catch (err: any) {
        return { success: false, message: `Could not parse the specification: ${err.message}` };
    }

    if (!spec || typeof spec !== 'object') {
        return { success: false, message: 'Specification did not parse to a mapping.' };
    }

    const applied: string[] = [];

    try {
        const widgets = applyHomepage(spec.homepage, todayEngine);
        if (widgets !== null) applied.push(`homepage layout (${widgets} widgets)`);

        const categories = applyCategories(spec.categories, templateEngine);
        if (categories !== null) applied.push(`${categories} categories`);

        const templates = applyTemplates(spec.templates, templateEngine);
        if (templates !== null) applied.push(`${templates} templates`);

        const rules = applyRules(spec.ifThenRules, ifThenRuleEngine);
        if (rules !== null) applied.push(`${rules} automation rules`);
    } catch (err: any) {
        return { success: false, message: `Could not apply the specification: ${err.message}` };
    }

    if (!applied.length) {
        return { success: false, message: 'Nothing recognisable to apply — expected homepage, categories, templates or ifThenRules.' };
    }

    return { success: true, message: `Applied ${applied.join(', ')}.` };
}

/** Returns the number of widgets applied, or null when the section is absent. */
function applyHomepage(homepage: any, todayEngine: TodayEngine): number | null {
    if (!homepage || typeof homepage !== 'object') return null;

    if (typeof homepage.journalWidthPercent === 'number') {
        todayEngine.setJournalWidth(homepage.journalWidthPercent);
    }
    if (typeof homepage.showQuickCaptureBar === 'boolean') {
        todayEngine.setQuickCaptureBar(homepage.showQuickCaptureBar);
    }
    if (homepage.columns === 'auto' || [1, 2, 3].includes(homepage.columns)) {
        todayEngine.setColumns(homepage.columns);
    }
    if (homepage.density === 'comfortable' || homepage.density === 'compact') {
        todayEngine.setDensity(homepage.density);
    }
    if (homepage.weather && typeof homepage.weather === 'object') {
        const { label, latitude, longitude, units } = homepage.weather;
        todayEngine.setWeather({
            label: typeof label === 'string' ? label : '',
            latitude: Number(latitude) || 0,
            longitude: Number(longitude) || 0,
            units: units === 'imperial' ? 'imperial' : 'metric',
        });
    }
    if (typeof homepage.writingGoalWords === 'number') {
        todayEngine.setWritingGoalWords(homepage.writingGoalWords);
    }
    if (typeof homepage.staleThresholdDays === 'number') {
        todayEngine.setStaleThresholdDays(homepage.staleThresholdDays);
    }

    const widgets: any[] = Array.isArray(homepage.widgets) ? homepage.widgets : [];
    for (const widget of widgets) {
        if (!widget?.id) continue;
        const updates: Partial<TodayWidgetConfig> = {};
        if (typeof widget.title === 'string') updates.title = widget.title;
        if (typeof widget.marker === 'string') updates.marker = widget.marker;
        if (typeof widget.visible === 'boolean') updates.visible = widget.visible;
        if ([1, 2, 3].includes(widget.colSpan)) updates.colSpan = widget.colSpan;
        todayEngine.updateWidget(widget.id, updates);
    }

    // Order comes from the document's own sequence, so reordering the list reorders
    // the dashboard without having to renumber `order` by hand.
    const ordered = widgets.filter((w) => w?.id).map((w) => String(w.id));
    if (ordered.length) todayEngine.reorderWidgets(ordered);

    return widgets.length;
}

function applyCategories(categories: any, templateEngine: TemplateEngine): number | null {
    if (!Array.isArray(categories)) return null;

    let count = 0;
    for (const cat of categories) {
        if (!cat?.id) continue;
        const existing = templateEngine.getCategory(cat.id);
        templateEngine.registerCategory({
            id: String(cat.id),
            title: cat.title ?? existing?.title ?? cat.id,
            description: cat.description ?? existing?.description ?? '',
            icon: cat.icon ?? existing?.icon ?? 'layer',
            defaultRootMarker: cat.defaultRootMarker || existing?.defaultRootMarker || 'projectRoot',
            autoJournalClone: cat.autoJournalClone !== false,
            inheritParentTopics: cat.inheritParentTopics !== false,
            projectScopedDefault: Boolean(cat.projectScopedDefault),
            isBuiltin: Boolean(cat.isBuiltin ?? existing?.isBuiltin),
        });
        count++;
    }
    return count;
}

function applyTemplates(templates: any, templateEngine: TemplateEngine): number | null {
    if (!Array.isArray(templates)) return null;

    let count = 0;
    for (const tpl of templates) {
        if (!tpl?.id) continue;
        const existing = templateEngine.getTemplate(tpl.id);

        const definition: TemplateDefinition = {
            id: String(tpl.id),
            marker: tpl.marker ?? existing?.marker ?? `ext${tpl.id}`,
            title: tpl.title ?? existing?.title ?? String(tpl.id),
            icon: tpl.icon ?? existing?.icon ?? 'file-blank',
            category: tpl.category ?? existing?.category ?? 'work',
            rootContainerMarker: tpl.rootContainerMarker ?? existing?.rootContainerMarker ?? 'projectRoot',
            titlePattern: tpl.titlePattern ?? existing?.titlePattern ?? '{title}',
            defaultContent: tpl.defaultContent ?? existing?.defaultContent ?? '',
            projectScoped: Boolean(tpl.projectScoped),
            noJournalClone: Boolean(tpl.noJournalClone),
            isBuiltin: Boolean(tpl.isBuiltin ?? existing?.isBuiltin),
            attributes: Array.isArray(tpl.attributes)
                ? tpl.attributes.filter((a: any) => a?.name).map((a: any) => ({
                    name: String(a.name),
                    type: a.type === 'relation' ? 'relation' : 'label',
                    dataType: a.dataType ?? 'string',
                    ...(a.label ? { label: String(a.label) } : {}),
                    ...(a.defaultValue !== '' && a.defaultValue != null ? { defaultValue: a.defaultValue } : {}),
                    ...(Array.isArray(a.options) && a.options.length ? { options: a.options.map(String) } : {}),
                    isPromoted: a.isPromoted !== false,
                }))
                : existing?.attributes ?? [],
            relationships: Array.isArray(tpl.parentLinks)
                ? tpl.parentLinks.filter((r: any) => r?.relationName).map((r: any) => ({
                    id: `rel_${tpl.id}_${r.relationName}`,
                    name: `${r.relationName} link`,
                    relationName: String(r.relationName),
                    targetTemplateId: String(r.targetTemplateId ?? ''),
                    targetTemplateName: String(r.targetTemplateName ?? r.targetTemplateId ?? ''),
                    isMulti: Boolean(r.isMulti),
                    autoCloneToParent: r.autoCloneToParent !== false,
                    inheritTopics: r.inheritTopics !== false,
                    direction: r.direction === 'child' || r.direction === 'peer' ? r.direction : 'parent',
                }))
                : existing?.relationships ?? [],
        };

        templateEngine.registerTemplate(definition);
        count++;
    }
    return count;
}

function applyRules(rules: any, ifThenRuleEngine: IfThenRuleEngine): number | null {
    if (!Array.isArray(rules)) return null;

    let count = 0;
    for (const rule of rules) {
        if (!rule?.id) continue;
        const trigger = rule.trigger ?? {};

        ifThenRuleEngine.registerRule({
            id: String(rule.id),
            name: rule.name ?? String(rule.id),
            description: rule.description ?? '',
            enabled: rule.enabled !== false,
            isBuiltin: Boolean(rule.isBuiltin),
            trigger: {
                type: trigger.type ?? 'onNoteCreated',
                ...(trigger.targetCategory ? { targetCategory: String(trigger.targetCategory) } : {}),
                ...(trigger.targetTemplateId ? { targetTemplateId: String(trigger.targetTemplateId) } : {}),
                ...(trigger.targetContainerMarker ? { targetContainerMarker: String(trigger.targetContainerMarker) } : {}),
                ...(trigger.attributeName ? { attributeName: String(trigger.attributeName) } : {}),
            },
            conditions: Array.isArray(rule.conditions)
                ? rule.conditions.filter((c: any) => c?.field).map((c: any) => ({
                    field: String(c.field),
                    operator: c.operator ?? 'isSet',
                    value: c.value,
                }))
                : [],
            actions: Array.isArray(rule.actions)
                ? rule.actions.filter((a: any) => a?.type).map((a: any) => ({
                    type: a.type,
                    params: a.params && typeof a.params === 'object' ? a.params : {},
                }))
                : [],
        });
        count++;
    }
    return count;
}

/**
 * Renders a template's content skeleton as a standalone HTML document, for
 * exporting a single template rather than the whole package.
 */
export function exportTemplateAsHtml(tpl: TemplateDefinition): string {
    const attributes = (tpl.attributes ?? [])
        .map((a) => `  <!-- ${a.type === 'relation' ? '~' : '#'}${a.name} (${a.dataType}) -->`)
        .join('\n');

    return `<!-- Template: ${tpl.title} (#${tpl.marker}) -->
${attributes}
${tpl.defaultContent ?? ''}`;
}

/**
 * Dumps a single template definition as a clean, targeted YAML document.
 */
export function exportTemplateToYaml(tpl: TemplateDefinition): string {
    const dumped = dumpTemplate(tpl);
    return `# Trilium Template Definition: ${tpl.title} (#${tpl.marker})\n${YamlParser.stringify({ template: dumped })}\n`;
}

/**
 * Parses a targeted template YAML document into a TemplateDefinition object.
 */
export function importTemplateFromYaml(yamlString: string): TemplateDefinition {
    if (!yamlString || !yamlString.trim()) {
        throw new Error('YAML template string is empty.');
    }

    const parsed = YamlParser.parse(yamlString);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('YAML did not parse into a valid mapping.');
    }

    const tplObj = parsed.template ?? parsed;
    if (!tplObj.id && !tplObj.title) {
        throw new Error('Template definition must specify at least an id or title.');
    }

    const id = String(tplObj.id || tplObj.title.toLowerCase().replace(/\s+/g, '-'));

    return {
        id,
        marker: String(tplObj.marker || `ext${id.charAt(0).toUpperCase()}${id.slice(1)}`),
        title: String(tplObj.title || id),
        icon: String(tplObj.icon || 'file-blank'),
        category: String(tplObj.category || 'work'),
        rootContainerMarker: String(tplObj.rootContainerMarker || 'projectRoot'),
        titlePattern: String(tplObj.titlePattern || '{title}'),
        defaultContent: String(tplObj.defaultContent || ''),
        projectScoped: Boolean(tplObj.projectScoped),
        noJournalClone: Boolean(tplObj.noJournalClone),
        isBuiltin: Boolean(tplObj.isBuiltin),
        attributes: Array.isArray(tplObj.attributes)
            ? tplObj.attributes.filter((a: any) => a?.name).map((a: any) => ({
                name: String(a.name),
                type: a.type === 'relation' ? 'relation' : 'label',
                dataType: a.dataType ?? 'string',
                ...(a.label ? { label: String(a.label) } : {}),
                ...(a.defaultValue !== '' && a.defaultValue != null ? { defaultValue: a.defaultValue } : {}),
                ...(Array.isArray(a.options) && a.options.length ? { options: a.options.map(String) } : {}),
                isPromoted: a.isPromoted !== false,
            }))
            : [],
        relationships: Array.isArray(tplObj.parentLinks ?? tplObj.relationships)
            ? (tplObj.parentLinks ?? tplObj.relationships).filter((r: any) => r?.relationName).map((r: any) => ({
                id: `rel_${id}_${r.relationName}`,
                name: `${r.relationName} link`,
                relationName: String(r.relationName),
                targetTemplateId: String(r.targetTemplateId ?? ''),
                targetTemplateName: String(r.targetTemplateName ?? r.targetTemplateId ?? ''),
                isMulti: Boolean(r.isMulti),
                autoCloneToParent: r.autoCloneToParent !== false,
                inheritTopics: r.inheritTopics !== false,
                direction: r.direction === 'child' || r.direction === 'peer' ? r.direction : 'parent',
            }))
            : [],
    };
}
