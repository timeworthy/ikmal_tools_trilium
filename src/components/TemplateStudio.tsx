/**
 * Template Studio: edit template schemas, category behaviour, and the automation
 * rules attached to each.
 *
 * The layout follows Trilium's settings pages — a sticky page header, a rail on
 * the leading edge, and a stack of titled sections in the main pane. Everything is
 * built from the primitives in `nativeUi.ts`, which reproduce Trilium's own
 * options markup; nothing here invents its own card, badge, or colour language.
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { TemplateDefinition, TemplateCategoryDef, IfThenRuleDef, PromotedAttributeDef } from '../engine/types.js';
import { exportTemplateToYaml, importTemplateFromYaml } from '../engine/yamlSpec.js';
import { runManualIfThenRules } from '../engine/ifThenManualDispatcher.js';
import { button, emptyState, escapeHtml, iconAction, listItem, openModal, pageHeader, row, searchableSelect, section, switchRow, toggle } from './nativeUi.js';

/** The rail's template hierarchy. Ids reference templates registered in the engine. */
const TEMPLATE_TREE: TreeNode[] = [
    {
        id: 'projectHub', label: 'Project Hub',
        children: [
            { id: 'story', label: 'Story Project', children: [
                { id: 'edit', label: 'Edit Package', children: [] },
                { id: 'reportingNotes', label: 'Reporting Notes', children: [] },
            ]},
            { id: 'projectTask', label: 'Project Task', children: [] },
            { id: 'meeting', label: 'Project Meeting', children: [] },
            { id: 'scratch', label: 'Project Scratch Note', children: [] },
            { id: 'person', label: 'Project Person', children: [] },
            { id: 'organization', label: 'Client Organization', children: [] },
            { id: 'emailDraft', label: 'Email Draft', children: [] },
            { id: 'topic', label: 'Assigned Topic', children: [] },
        ],
    },
    {
        id: 'organization', label: 'Organization Directory',
        children: [
            { id: 'person', label: 'Key Contact Person', children: [] },
            { id: 'meeting', label: 'Client Meeting', children: [
                { id: 'meetingPrep', label: 'Meeting Prep', children: [] },
            ]},
        ],
    },
    {
        id: 'person', label: 'Person Directory',
        children: [{ id: 'meeting', label: 'Person Meeting', children: [] }],
    },
    { id: 'task', label: 'Standalone Task', children: [] },
    { id: 'scratch', label: 'Unassigned Scratch Note', children: [] },
    { id: 'topic', label: 'Global Topic Index', children: [] },
];

interface TreeNode {
    id: string;
    label?: string;
    children: TreeNode[];
}

export function renderTemplateStudio(
    container: HTMLElement,
    templateEngine: TemplateEngine,
    ifThenRuleEngine: IfThenRuleEngine,
    onSave: () => void,
    frontendApi?: any,
): void {
    let selectedTemplateId: string = templateEngine.getAllTemplates()[0]?.id || 'story';
    let activeEditorTab: 'editor' | 'preview' = 'editor';
    let railMode: 'templates' | 'categories' = 'templates';
    let selectedCategoryId: string = templateEngine.getAllCategories()[0]?.id || 'work';
    let railSearchQuery: string = '';
    let showSplitPreview: boolean = false;

    function refresh() {
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'template-studio-wrapper';

        const activeTpl = templateEngine.getTemplate(selectedTemplateId);
        const activeCat = templateEngine.getCategory(selectedCategoryId);
        const inCategories = railMode === 'categories';

        wrapper.appendChild(pageHeader({
            icon: 'bx-layer',
            title: 'Template Studio',
            subtitle: 'Template schemas, parent links, automation rules, and promoted attributes.',
            actions: [
                ...(inCategories || !activeTpl ? [] : [modeSwitcher()]),
                ...(inCategories
                    ? [
                          button({
                              text: 'New category',
                              icon: 'bx-plus',
                              kind: 'primary',
                              onClick: () => openNewCategoryModal(),
                          }),
                      ]
                    : [
                          button({
                              text: 'Import template',
                              icon: 'bx-import',
                              kind: 'secondary',
                              onClick: () => openImportTemplateModal(),
                          }),
                          button({
                              text: 'New template',
                              icon: 'bx-plus',
                              kind: 'primary',
                              onClick: () => openNewTemplateModal(),
                          }),
                      ]),
            ],
        }));

        const split = document.createElement('div');
        split.className = 'ns-split';

        const rail = document.createElement('div');
        rail.className = 'ns-split-rail';
        renderRail(rail);
        split.appendChild(rail);

        const main = document.createElement('div');
        main.className = 'ns-split-main';

        if (inCategories && activeCat) {
            renderCategoryEditor(main, activeCat);
        } else if (activeTpl && activeEditorTab === 'editor') {
            if (showSplitPreview) {
                const splitContainer = document.createElement('div');
                splitContainer.className = 'd-flex gap-3 w-100 flex-column flex-lg-row';
                const schemaPane = document.createElement('div');
                schemaPane.className = 'flex-grow-1 w-100 w-lg-50';
                renderSchemaEditor(schemaPane, activeTpl);
                const previewPane = document.createElement('div');
                previewPane.className = 'w-100 w-lg-50 border-start ps-0 ps-lg-3 pt-3 pt-lg-0';
                renderPreview(previewPane, activeTpl);
                splitContainer.append(schemaPane, previewPane);
                main.appendChild(splitContainer);
            } else {
                renderSchemaEditor(main, activeTpl);
            }
        } else if (activeTpl) {
            renderPreview(main, activeTpl);
        }

        split.appendChild(main);
        wrapper.appendChild(split);
        container.appendChild(wrapper);
    }

    /** Segmented Schema/Preview control for the currently selected template. */
    function modeSwitcher(): HTMLElement {
        const group = document.createElement('div');
        group.className = 'btn-group btn-group-sm d-flex align-items-center gap-1';
        group.setAttribute('role', 'group');

        for (const mode of [
            { id: 'editor' as const, label: 'Schema', icon: 'bx-slider' },
            { id: 'preview' as const, label: 'Preview', icon: 'bx-show' },
        ]) {
            const btn = button({
                text: mode.label,
                icon: mode.icon,
                size: 'small',
                className: activeEditorTab === mode.id ? 'active' : undefined,
                onClick: () => {
                    activeEditorTab = mode.id;
                    refresh();
                },
            });
            btn.setAttribute('aria-pressed', String(activeEditorTab === mode.id));
            group.appendChild(btn);
        }

        const splitBtn = button({
            text: showSplitPreview ? 'Split Preview: ON' : 'Split Preview: OFF',
            icon: 'bx-columns',
            size: 'small',
            kind: showSplitPreview ? 'primary' : 'secondary',
            onClick: () => {
                showSplitPreview = !showSplitPreview;
                if (showSplitPreview) activeEditorTab = 'editor';
                refresh();
            },
        });
        group.appendChild(splitBtn);

        return group;
    }

    // ------------------------------------------------------------------- rail

    function renderRail(parent: HTMLElement) {
        const { card } = section(parent, { title: 'Library' });

        const switcher = document.createElement('div');
        switcher.className = 'btn-group btn-group-sm';
        switcher.setAttribute('role', 'group');
        switcher.style.width = '100%';
        switcher.style.marginBottom = '12px';

        for (const mode of [
            { id: 'templates' as const, label: 'Templates', count: templateEngine.getAllTemplates().length },
            { id: 'categories' as const, label: 'Categories', count: templateEngine.getAllCategories().length },
        ]) {
            const btn = button({
                text: `${mode.label} (${mode.count})`,
                size: 'small',
                className: railMode === mode.id ? 'active' : undefined,
                onClick: () => {
                    railMode = mode.id;
                    if (mode.id === 'templates') activeEditorTab = 'editor';
                    refresh();
                },
            });
            btn.setAttribute('aria-pressed', String(railMode === mode.id));
            switcher.appendChild(btn);
        }
        card.appendChild(switcher);

        card.appendChild(railMode === 'categories' ? categoryList() : templateTree(TEMPLATE_TREE));
    }

    function categoryList(): HTMLElement {
        const list = document.createElement('ul');
        list.className = 'ns-tree';

        for (const cat of templateEngine.getAllCategories()) {
            const count = templateEngine.getAllTemplates().filter((t) => t.category === cat.id).length;
            const li = document.createElement('li');
            li.appendChild(treeItem({
                icon: cat.icon,
                label: cat.title,
                count,
                selected: cat.id === selectedCategoryId,
                onClick: () => {
                    selectedCategoryId = cat.id;
                    refresh();
                },
            }));
            list.appendChild(li);
        }

        return list;
    }

    function templateTree(nodes: TreeNode[]): HTMLElement {
        const list = document.createElement('ul');
        list.className = 'ns-tree';

        for (const node of nodes) {
            const tpl = templateEngine.getTemplate(node.id);
            if (!tpl) continue;

            const li = document.createElement('li');
            li.appendChild(treeItem({
                icon: tpl.icon,
                label: node.label || tpl.title,
                selected: tpl.id === selectedTemplateId,
                onClick: () => {
                    selectedTemplateId = tpl.id;
                    activeEditorTab = 'editor';
                    refresh();
                },
            }));

            if (node.children.length) {
                li.appendChild(templateTree(node.children));
            }
            list.appendChild(li);
        }

        return list;
    }

    function treeItem({ icon, label, count, selected, onClick }: {
        icon: string;
        label: string;
        count?: number;
        selected: boolean;
        onClick: () => void;
    }): HTMLElement {
        const item = document.createElement('div');
        item.className = `ns-tree-item${selected ? ' selected' : ''}`;
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.title = label;
        item.innerHTML = `
            <span class="bx bx-${escapeHtml(icon)}" aria-hidden="true"></span>
            <span class="ns-tree-item-label">${escapeHtml(label)}</span>
            ${count !== undefined ? `<span class="ns-count">${count}</span>` : ''}
        `;
        item.addEventListener('click', onClick);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        });
        return item;
    }

    // -------------------------------------------------------- category editor

    function renderCategoryEditor(parent: HTMLElement, cat: TemplateCategoryDef) {
        const rules = ifThenRuleEngine.getAllRules().filter((r) => r.trigger.targetCategory === cat.id);
        const templates = templateEngine.getAllTemplates().filter((t) => t.category === cat.id);

        // --- behaviour
        const { card } = section(parent, {
            title: cat.title,
            description: cat.description,
        });

        const rootInput = document.createElement('input');
        rootInput.type = 'text';
        rootInput.className = 'form-control form-control-sm';
        rootInput.id = 'cat-root';
        rootInput.value = cat.defaultRootMarker || 'projectRoot';
        card.appendChild(row(rootInput, {
            label: 'Default root container',
            description: 'Container tag new notes in this category are filed under, e.g. projectRoot.',
            htmlFor: 'cat-root',
        }));

        const journalToggle = switchRow({
            id: 'cat-journal',
            label: "File under today's journal note",
            description: 'Add a reference link to the current day note when a note in this category is created.',
            checked: cat.autoJournalClone !== false,
        });
        card.appendChild(journalToggle);

        const topicsToggle = switchRow({
            id: 'cat-topics',
            label: 'Inherit parent topics and metadata',
            description: 'Absorb topic tags and client details from parent projects and organizations.',
            checked: cat.inheritParentTopics !== false,
        });
        card.appendChild(topicsToggle);

        const scopeToggle = switchRow({
            id: 'cat-scoped',
            label: 'Require a project hub',
            description: 'Notes in this category must be linked to a parent project hub.',
            checked: !!cat.projectScopedDefault,
        });
        card.appendChild(scopeToggle);

        // --- templates in the category
        const { card: tplCard } = section(parent, { title: `Templates (${templates.length})` });
        if (templates.length) {
            for (const t of templates) {
                tplCard.appendChild(listItem({
                    icon: `bx-${t.icon}`,
                    title: t.title,
                    description: `#${t.marker} · ${t.attributes.length} attributes · ${t.relationships.length} parent links`,
                    actions: [iconAction({
                        icon: 'bx-link-external',
                        title: `Open ${t.title}`,
                        onClick: () => {
                            railMode = 'templates';
                            selectedTemplateId = t.id;
                            activeEditorTab = 'editor';
                            refresh();
                        },
                    })],
                }));
            }
        } else {
            tplCard.appendChild(emptyState('No templates are assigned to this category.'));
        }

        // --- category rules
        renderRuleSection(parent, {
            title: `Automation rules (${rules.length})`,
            description: 'Rules that run for every template in this category.',
            rules,
            emptyText: 'No category-wide rules.',
            addLabel: 'Add category rule',
            onAdd: () => openRuleEditorModal({ targetCategory: cat.id }),
        });

        // --- save
        const actions = document.createElement('div');
        actions.className = 'ns-actions ns-actions-end';
        actions.appendChild(button({
            text: 'Save category',
            icon: 'bx-save',
            kind: 'primary',
            size: 'normal',
            onClick: () => {
                cat.defaultRootMarker = rootInput.value;
                cat.autoJournalClone = journalToggle.querySelector<HTMLInputElement>('input')!.checked;
                cat.inheritParentTopics = topicsToggle.querySelector<HTMLInputElement>('input')!.checked;
                cat.projectScopedDefault = scopeToggle.querySelector<HTMLInputElement>('input')!.checked;
                templateEngine.registerCategory(cat);
                onSave();
                refresh();
            },
        }));
        parent.appendChild(actions);
    }

    // ---------------------------------------------------------- schema editor

    function renderSchemaEditor(parent: HTMLElement, tpl: TemplateDefinition) {
        const categories = templateEngine.getAllCategories();
        const allRules = ifThenRuleEngine.getAllRules();
        const globalRules = allRules.filter((r) => !r.trigger.targetCategory && !r.trigger.targetTemplateId);
        const catRules = allRules.filter((r) => r.trigger.targetCategory === tpl.category);
        const tplRules = allRules.filter((r) => r.trigger.targetTemplateId === tpl.id);

        // --- general
        const { card } = section(parent, {
            title: tpl.title,
            description: `Marker #${tpl.marker} · id ${tpl.id}`,
        });

        const titleInput = inputControl('tpl-title', tpl.title);
        card.appendChild(row(titleInput, { label: 'Title', htmlFor: 'tpl-title' }));

        const categorySelect = searchableSelect({
            id: 'tpl-category',
            value: tpl.category,
            placeholder: 'Search categories…',
            options: categories.map((c) => ({ value: c.id, label: c.title, description: c.description })),
        });
        card.appendChild(row(categorySelect.el, {
            label: 'Category',
            description: 'Category behaviour and category-wide rules apply to this template.',
            htmlFor: 'tpl-category',
        }));

        const patternInput = inputControl('tpl-pattern', tpl.titlePattern);
        card.appendChild(row(patternInput, {
            label: 'Title pattern',
            description: 'Pattern applied to new note titles, e.g. Project: {title}.',
            htmlFor: 'tpl-pattern',
        }));

        const iconGroup = document.createElement('div');
        iconGroup.className = 'input-group input-group-sm';
        iconGroup.innerHTML = `<span class="input-group-text"><span class="bx bx-${escapeHtml(tpl.icon)}"></span></span>`;
        const iconInput = inputControl('tpl-icon', tpl.icon);
        iconInput.className = 'form-control form-control-sm';
        iconGroup.appendChild(iconInput);
        card.appendChild(row(iconGroup, {
            label: 'Icon',
            description: 'Boxicons name without the bx- prefix.',
            htmlFor: 'tpl-icon',
        }));

        // --- rules, one section per scope so nothing nests
        renderRuleSection(parent, {
            title: `Global rules (${globalRules.length})`,
            description: 'Run for every note the system creates.',
            rules: globalRules,
            emptyText: 'No global rules.',
            addLabel: 'Add rule',
            onAdd: () => openRuleEditorModal({}),
        });

        renderRuleSection(parent, {
            title: `Category rules (${catRules.length})`,
            description: `Inherited from the ${tpl.category} category.`,
            rules: catRules,
            emptyText: `No rules on the ${tpl.category} category.`,
            addIcon: 'bx-category',
            addLabel: `Edit the ${tpl.category} category`,
            onAdd: () => {
                railMode = 'categories';
                selectedCategoryId = tpl.category;
                refresh();
            },
        });

        renderTemplateRuleSection(parent, tpl, tplRules);

        // --- promoted attributes
        const { card: attrCard } = section(parent, {
            title: `Promoted attributes (${tpl.attributes.length})`,
            description: 'Fields shown on the note itself when it is created from this template.',
            actions: [iconAction({ icon: 'bx-plus', title: 'Add attribute', onClick: () => openAddAttrModal(tpl) })],
        });

        if (tpl.attributes.length) {
            const table = document.createElement('table');
            table.className = 'ns-table';
            table.innerHTML = `
                <thead>
                    <tr><th>Name</th><th>Kind</th><th>Type</th><th>Default / options</th><th style="width: 80px;">Actions</th></tr>
                </thead>
                <tbody>
                    ${tpl.attributes.map((a, idx) => `
                        <tr>
                            <td><span class="ns-code">${a.type === 'relation' ? '~' : '#'}${escapeHtml(a.name)}</span></td>
                            <td>${escapeHtml(a.type)}</td>
                            <td>${escapeHtml(a.dataType)}</td>
                            <td class="ns-meta">${escapeHtml(a.options ? a.options.join(', ') : a.defaultValue ?? '—')}</td>
                            <td>
                                <div class="d-flex align-items-center gap-1">
                                    <button type="button" class="icon-action move-attr-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Up"><i class="bx bx-chevron-up"></i></button>
                                    <button type="button" class="icon-action move-attr-down" data-idx="${idx}" ${idx === tpl.attributes.length - 1 ? 'disabled' : ''} title="Move Down"><i class="bx bx-chevron-down"></i></button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            table.querySelectorAll('.move-attr-up').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const idx = Number((e.currentTarget as HTMLElement).dataset.idx);
                    if (idx > 0) {
                        const temp = tpl.attributes[idx];
                        tpl.attributes[idx] = tpl.attributes[idx - 1];
                        tpl.attributes[idx - 1] = temp;
                        templateEngine.updateTemplate(tpl.id, { attributes: [...tpl.attributes] });
                        onSave();
                        refresh();
                    }
                });
            });
            table.querySelectorAll('.move-attr-down').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const idx = Number((e.currentTarget as HTMLElement).dataset.idx);
                    if (idx < tpl.attributes.length - 1) {
                        const temp = tpl.attributes[idx];
                        tpl.attributes[idx] = tpl.attributes[idx + 1];
                        tpl.attributes[idx + 1] = temp;
                        templateEngine.updateTemplate(tpl.id, { attributes: [...tpl.attributes] });
                        onSave();
                        refresh();
                    }
                });
            });
            attrCard.appendChild(table);
        } else {
            attrCard.appendChild(emptyState('No promoted attributes.'));
        }

        // --- content skeleton
        const { card: contentCard } = section(parent, {
            title: 'Content skeleton',
            description: 'HTML inserted into the body of a new note created from this template.',
        });
        const contentArea = document.createElement('textarea');
        contentArea.className = 'form-control ns-code';
        contentArea.id = 'tpl-content';
        contentArea.rows = 8;
        contentArea.spellcheck = false;
        contentArea.value = tpl.defaultContent;
        contentCard.appendChild(contentArea);

        // --- save & export
        const actions = document.createElement('div');
        actions.className = 'ns-actions ns-actions-end';
        actions.appendChild(button({
            text: 'Export YAML',
            icon: 'bx-export',
            kind: 'secondary',
            size: 'normal',
            onClick: () => openExportTemplateModal(tpl),
        }));
        actions.appendChild(button({
            text: 'Save template',
            icon: 'bx-save',
            kind: 'primary',
            size: 'normal',
            onClick: () => {
                templateEngine.updateTemplate(tpl.id, {
                    title: titleInput.value,
                    category: categorySelect.getValue(),
                    titlePattern: patternInput.value,
                    icon: iconInput.value,
                    defaultContent: contentArea.value,
                });
                onSave();
                refresh();
            },
        }));
        parent.appendChild(actions);
    }

    function inputControl(id: string, value: string): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.id = id;
        input.value = value;
        return input;
    }

    /** A section listing rules of one scope, each with edit and enable controls. */
    function renderRuleSection(parent: HTMLElement, opts: {
        title: string;
        description: string;
        rules: IfThenRuleDef[];
        emptyText: string;
        addIcon?: string;
        addLabel: string;
        onAdd: () => void;
    }) {
        const { card } = section(parent, {
            title: opts.title,
            description: opts.description,
            actions: [iconAction({ icon: opts.addIcon ?? 'bx-plus', title: opts.addLabel, onClick: opts.onAdd })],
        });

        if (!opts.rules.length) {
            card.appendChild(emptyState(opts.emptyText));
            return;
        }

        for (const rule of opts.rules) {
            card.appendChild(ruleItem(rule));
        }
    }

    function openPresetRuleModal(tpl: TemplateDefinition) {
        openModal({
            title: 'Add Automation Rule Preset',
            icon: 'bx-magic-wand',
            confirmText: 'Apply Preset',
            body: `
                <div class="ns-field mb-3">
                    <label for="preset-select" class="form-label small font-weight-bold">Select Rule Preset for ${escapeHtml(tpl.title)}</label>
                    <select id="preset-select" class="form-select form-select-sm">
                        <option value="archive_done">📦 Auto-archive note when status becomes 'complete' or 'done'</option>
                        <option value="tag_client">🏷️ Auto-assign client relation tag on creation</option>
                        <option value="prepend_checklist">📝 Prepend editorial & quality checklist to body</option>
                    </select>
                </div>
            `,
        }, (content) => {
            const presetVal = content.querySelector<HTMLSelectElement>('#preset-select')?.value;
            if (!presetVal) return false;

            if (presetVal === 'archive_done') {
                ifThenRuleEngine.registerRule({
                    id: `preset_archive_${tpl.id}_${Date.now()}`,
                    name: `Auto-archive ${tpl.title} on complete`,
                    description: `Automatically archives ${tpl.title} when status is complete or done.`,
                    enabled: true,
                    isBuiltin: false,
                    trigger: { type: 'onAttributeChanged', targetTemplateId: tpl.id, attributeName: 'status' },
                    conditions: [{ field: 'status', operator: 'equals', value: 'complete' }],
                    actions: [{ type: 'archiveNote', params: {} }],
                });
            } else if (presetVal === 'tag_client') {
                ifThenRuleEngine.registerRule({
                    id: `preset_client_${tpl.id}_${Date.now()}`,
                    name: `Auto-assign client to ${tpl.title}`,
                    description: `Assigns client relation attribute to new ${tpl.title}.`,
                    enabled: true,
                    isBuiltin: false,
                    trigger: { type: 'onNoteCreated', targetTemplateId: tpl.id },
                    conditions: [],
                    actions: [{ type: 'setRelation', params: { relationName: 'client', targetNoteId: 'orgRoot' } }],
                });
            } else if (presetVal === 'prepend_checklist') {
                ifThenRuleEngine.registerRule({
                    id: `preset_checklist_${tpl.id}_${Date.now()}`,
                    name: `Prepend checklist to ${tpl.title}`,
                    description: `Prepends editorial checklist to new ${tpl.title}.`,
                    enabled: true,
                    isBuiltin: false,
                    trigger: { type: 'onNoteCreated', targetTemplateId: tpl.id },
                    conditions: [],
                    actions: [{ type: 'prependContent', params: { content: '<h2>EDITORIAL CHECKLIST</h2><ul><li>[ ] Review angle</li><li>[ ] Fact check quotes</li></ul>' } }],
                });
            }

            onSave();
            refresh();
            return true;
        });
    }

    /** Template-scope rules, which also include the parent links declared on the template. */
    function renderTemplateRuleSection(
        parent: HTMLElement,
        tpl: TemplateDefinition,
        tplRules: IfThenRuleDef[]
    ) {
        const total = tpl.relationships.length + tplRules.length;
        const { card } = section(parent, {
            title: `Template rules (${total})`,
            description: 'Parent links and rules that apply only to this template.',
            actions: [
                iconAction({ icon: 'bx-magic-wand', title: 'Add rule preset', onClick: () => openPresetRuleModal(tpl) }),
                iconAction({ icon: 'bx-link', title: 'Add parent link', onClick: () => openRelationshipModal(tpl) }),
                iconAction({ icon: 'bx-plus', title: 'Add rule', onClick: () => openRuleEditorModal({ targetTemplateId: tpl.id }) }),
            ],
        });

        tpl.relationships.forEach((rel, idx) => {
            card.appendChild(listItem({
                icon: 'bx-link',
                title: `~${rel.relationName} → ${rel.targetTemplateName}`,
                description: [
                    rel.autoCloneToParent ? 'files a reference link under the parent' : null,
                    rel.inheritTopics ? 'inherits parent topics' : null,
                ].filter(Boolean).join(', ') || 'link only',
                actions: [
                    iconAction({ icon: 'bx-edit-alt', title: 'Edit parent link', onClick: () => openRelationshipModal(tpl, idx) }),
                    iconAction({
                        icon: 'bx-trash',
                        title: 'Delete parent link',
                        onClick: () => {
                            tpl.relationships.splice(idx, 1);
                            templateEngine.updateTemplate(tpl.id, tpl);
                            onSave();
                            refresh();
                        },
                    }),
                ],
            }));
        });

        for (const rule of tplRules) {
            card.appendChild(ruleItem(rule, () => {
                ifThenRuleEngine.deleteRule(rule.id);
                onSave();
                refresh();
            }));
        }

        if (!total) {
            card.appendChild(emptyState('No template-specific rules.'));
        }
    }

    function formatActionSummary(rule: IfThenRuleDef): string {
        if (rule.description && rule.description.trim()) return rule.description;
        const act = rule.actions[0];
        if (!act) return 'No action defined';
        switch (act.type) {
            case 'setLabel':
                return `Set #${act.params.labelName ?? 'label'} = "${act.params.labelValue ?? ''}"`;
            case 'removeLabel':
                return `Remove #${act.params.labelName ?? 'label'}`;
            case 'setRelation':
                return `Set ~${act.params.relationName ?? 'relation'} → ${act.params.targetNoteId ?? 'target'}`;
            case 'cloneToContainer':
                return 'File reference link under parent container';
            case 'archiveNote':
                return 'Archive note (#archived)';
            case 'prependContent':
                return 'Prepend template checklist or header content';
            case 'syncDerivedTopics':
                return 'Recalculate inherited parent topics';
            default:
                return act.type;
        }
    }

    function ruleItem(rule: IfThenRuleDef, onDelete?: () => void): HTMLElement {
        // Enablement is a state, so it gets the same switch the settings page uses
        // rather than a button whose label restates the state it is about to leave.
        const enableToggle = toggle(`rule-enabled-${rule.id}`, rule.enabled, (enabled) => {
            ifThenRuleEngine.toggleRule(rule.id, enabled);
            onSave();
        });
        enableToggle.title = rule.enabled ? 'Disable this rule' : 'Enable this rule';

        const actions: HTMLElement[] = [
            enableToggle,
            iconAction({ icon: 'bx-edit-alt', title: 'Edit rule', onClick: () => openRuleEditorModal({ rule }) }),
        ];

        if (frontendApi) {
            actions.push(iconAction({
                icon: 'bx-play',
                title: 'Run manual rules for the current note',
                onClick: async () => {
                    try {
                        const count = await runManualIfThenRules(ruleEngineForManual(), frontendApi, frontendApi.currentNote?.noteId, templateEngine);
                        frontendApi.showMessage?.(count ? `Applied ${count} manual rule${count === 1 ? '' : 's'}.` : 'No manual rules matched the current note.');
                    } catch (error: any) {
                        frontendApi.showError?.(`Manual rule execution failed: ${error?.message || error}`);
                    }
                },
            }));
        }

        if (onDelete) {
            actions.push(iconAction({ icon: 'bx-trash', title: 'Delete rule', onClick: onDelete }));
        }

        const triggerName = rule.trigger?.type || 'onNoteCreated';
        const condSummary = rule.conditions?.length ? rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(' & ') : 'Always';
        const actSummary = formatActionSummary(rule);

        const flowDesc = `
            <div class="d-flex align-items-center gap-1.5 flex-wrap mt-1 tiny text-muted">
                <span class="badge bg-secondary font-weight-normal"><i class="bx bx-zap text-warning"></i> ${escapeHtml(triggerName)}</span>
                <span>&rarr;</span>
                <span class="badge bg-dark font-weight-normal"><i class="bx bx-filter-alt text-info"></i> IF: ${escapeHtml(condSummary)}</span>
                <span>&rarr;</span>
                <span class="badge bg-primary font-weight-normal"><i class="bx bx-play-circle text-white"></i> THEN: ${escapeHtml(actSummary)}</span>
            </div>
        `;

        const el = listItem({
            icon: 'bx-bolt-circle',
            title: rule.name,
            description: '',
            disabled: !rule.enabled,
            actions,
        });

        const descContainer = el.querySelector('.ns-list-item-desc');
        if (descContainer) descContainer.innerHTML = flowDesc;
        return el;
    }

    // Keep the callback bound to the current engine instance while making the
    // intent at the call site explicit: the button runs only onManualAction
    // rules, never creation or attribute-change rules.
    function ruleEngineForManual(): IfThenRuleEngine {
        return ifThenRuleEngine;
    }

    // ----------------------------------------------------------------- preview

    /**
     * Renders the note this template produces, as it appears once created — Trilium's
     * title chrome, the promoted-attributes grid, and the body — and nothing else.
     * Anything a real note would not show (which rules fired, what it inherits, where
     * it is filed) belongs in the schema editor, not here.
     */
    function renderPreview(parent: HTMLElement, tpl: TemplateDefinition) {
        const note = document.createElement('div');
        note.className = 'ns-note';

        const titleRow = document.createElement('div');
        titleRow.className = 'ns-note-title-row';
        titleRow.innerHTML = `
            <span class="ns-note-icon bx bx-${escapeHtml(tpl.icon)}" aria-hidden="true"></span>
            <input type="text" class="ns-note-title" aria-label="Note title"
                   value="${escapeHtml(templateEngine.formatTitle(tpl.id, 'Sample Note Title'))}">
        `;
        note.appendChild(titleRow);

        if (tpl.attributes.length) {
            const attrs = document.createElement('div');
            attrs.className = 'promoted-attributes-container';
            attrs.innerHTML = tpl.attributes.map((attr) => `
                <div class="promoted-attribute-cell promoted-attribute-${attr.type === 'relation' ? 'relation' : `label-${escapeHtml(attr.dataType)}`}">
                    <label>${escapeHtml(attr.label ?? attr.name)}</label>
                    <div class="input-group">${attributeInput(attr)}</div>
                </div>
            `).join('');
            note.appendChild(attrs);
        }

        const body = document.createElement('div');
        // `ck-content` is the class Trilium's note text carries, so the skeleton gets
        // the typography it will really be rendered with.
        body.className = 'ns-note-body ck-content';
        body.innerHTML = tpl.defaultContent || '';
        note.appendChild(body);

        parent.appendChild(note);
    }

    /** The field a promoted attribute is edited through on the note itself. */
    function attributeInput(attr: PromotedAttributeDef): string {
        const value = escapeHtml(attr.defaultValue ?? '');

        if (attr.dataType === 'select' && attr.options) {
            return `<select class="form-control promoted-attribute-input">
                ${attr.options.map((o) => `<option${o === attr.defaultValue ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
            </select>`;
        }

        if (attr.dataType === 'boolean') {
            return `<input type="checkbox" class="form-control promoted-attribute-input"${attr.defaultValue ? ' checked' : ''}>`;
        }

        const type = attr.dataType === 'date' ? 'date' : attr.dataType === 'number' ? 'number' : 'text';
        return `<input type="${type}" class="form-control promoted-attribute-input" value="${value}" placeholder="unset">`;
    }

    // ------------------------------------------------------------------ modals

    function openRuleEditorModal(
        opts: { rule?: IfThenRuleDef; targetCategory?: string; targetTemplateId?: string }
    ) {
        const isEdit = !!opts.rule;
        const rule: IfThenRuleDef = opts.rule || {
            id: `rule_${Date.now()}`,
            name: '',
            description: '',
            enabled: true,
            isBuiltin: false,
            trigger: {
                type: 'onNoteCreated',
                targetCategory: opts.targetCategory,
                targetTemplateId: opts.targetTemplateId,
            },
            conditions: [],
            actions: [{ type: 'setLabel', params: { labelName: 'processed', labelValue: 'true' } }],
        };

        const scope = rule.trigger.targetCategory
            ? `Category: ${rule.trigger.targetCategory}`
            : rule.trigger.targetTemplateId
                ? `Template: ${rule.trigger.targetTemplateId}`
                : 'Global';

        const currentAct = rule.actions[0] || { type: 'setLabel', params: {} };

        openModal({
            title: isEdit ? 'Edit automation rule' : 'New automation rule',
            icon: 'bx-bolt-circle',
            confirmText: 'Save rule',
            body: `
                <div class="ns-field">
                    <label for="rule-name">Name</label>
                    <input type="text" id="rule-name" class="form-control form-control-sm" value="${escapeHtml(rule.name)}" placeholder="High priority task → due soon tag">
                </div>
                <div class="ns-field">
                    <label for="rule-desc">Description</label>
                    <input type="text" id="rule-desc" class="form-control form-control-sm" value="${escapeHtml(rule.description)}" placeholder="What this rule does (optional)">
                </div>
                <div class="ns-field-grid">
                    <div class="ns-field">
                        <label for="rule-trigger">Trigger</label>
                        <select id="rule-trigger" class="form-select form-select-sm">
                            <option value="onNoteCreated"${rule.trigger.type === 'onNoteCreated' ? ' selected' : ''}>When a note is created</option>
                            <option value="onAttributeChanged"${rule.trigger.type === 'onAttributeChanged' ? ' selected' : ''}>When an attribute changes</option>
                            <option value="onManualAction"${rule.trigger.type === 'onManualAction' ? ' selected' : ''}>When manually run</option>
                            <option value="onScheduledCheck"${rule.trigger.type === 'onScheduledCheck' ? ' selected' : ''}>During scheduled checks</option>
                        </select>
                    </div>
                    <div class="ns-field">
                        <label for="rule-scope">Scope</label>
                        <input type="text" id="rule-scope" class="form-control form-control-sm" value="${escapeHtml(scope)}" disabled>
                    </div>
                </div>
                <div class="ns-field">
                    <label for="rule-attribute-name">Changed attribute (optional)</label>
                    <input type="text" id="rule-attribute-name" class="form-control form-control-sm" value="${escapeHtml(rule.trigger.attributeName || '')}" placeholder="Only used for attribute-change rules">
                </div>
                <div class="ns-field">
                    <label for="rule-action">Action</label>
                    <select id="rule-action" class="form-select form-select-sm">
                        <option value="setLabel"${currentAct.type === 'setLabel' ? ' selected' : ''}>Assign a label value (#doneDate, #color)</option>
                        <option value="removeLabel"${currentAct.type === 'removeLabel' ? ' selected' : ''}>Remove a label</option>
                        <option value="setRelation"${currentAct.type === 'setRelation' ? ' selected' : ''}>Set relation link (~parent, ~client)</option>
                        <option value="cloneToContainer"${currentAct.type === 'cloneToContainer' ? ' selected' : ''}>File a reference link under parent container</option>
                        <option value="archiveNote"${currentAct.type === 'archiveNote' ? ' selected' : ''}>Archive note (#archived)</option>
                        <option value="prependContent"${currentAct.type === 'prependContent' ? ' selected' : ''}>Prepend checklist or header content</option>
                        <option value="syncDerivedTopics"${currentAct.type === 'syncDerivedTopics' ? ' selected' : ''}>Recalculate inherited parent topics</option>
                    </select>
                </div>
                <div class="action-params-box border-top pt-2 mt-2">
                    <div class="ns-field param-label-name">
                        <label for="param-lname">Label / Relation Name</label>
                        <input type="text" id="param-lname" class="form-control form-control-sm" value="${escapeHtml(currentAct.params.labelName ?? currentAct.params.relationName ?? 'processed')}">
                    </div>
                    <div class="ns-field param-label-val">
                        <label for="param-lval">Value / Target ID / Content</label>
                        <input type="text" id="param-lval" class="form-control form-control-sm" value="${escapeHtml(currentAct.params.labelValue ?? currentAct.params.targetNoteId ?? currentAct.params.content ?? 'true')}" placeholder="Supports {TODAY}, {NOTE_TITLE}">
                    </div>
                </div>
            `,
        }, (content) => {
            const name = content.querySelector<HTMLInputElement>('#rule-name')!.value.trim();
            if (!name) return false;

            rule.name = name;
            rule.description = content.querySelector<HTMLInputElement>('#rule-desc')!.value;
            rule.trigger.type = content.querySelector<HTMLSelectElement>('#rule-trigger')!.value as IfThenRuleDef['trigger']['type'];
            const changedAttribute = content.querySelector<HTMLInputElement>('#rule-attribute-name')?.value.trim();
            if (changedAttribute) rule.trigger.attributeName = changedAttribute;
            else delete rule.trigger.attributeName;

            const actionType = content.querySelector<HTMLSelectElement>('#rule-action')!.value as any;
            const lName = content.querySelector<HTMLInputElement>('#param-lname')?.value.trim();
            const lVal = content.querySelector<HTMLInputElement>('#param-lval')?.value;

            const params: Record<string, any> = {};
            if (actionType === 'setLabel') {
                params.labelName = lName || 'processed';
                params.labelValue = lVal !== undefined ? lVal : 'true';
            } else if (actionType === 'removeLabel') {
                params.labelName = lName || '';
            } else if (actionType === 'setRelation') {
                params.relationName = lName || 'project';
                params.targetNoteId = lVal || '';
            } else if (actionType === 'archiveNote') {
                params.containerMarker = lName || 'archiveProjectRoot';
            } else if (actionType === 'prependContent') {
                params.content = lVal || '';
            } else if (actionType === 'cloneToContainer') {
                params.relationName = 'project';
            }

            rule.actions = [{ type: actionType, params }];

            ifThenRuleEngine.registerRule(rule);
            onSave();
            refresh();
        });
    }

    function openExportTemplateModal(tpl: TemplateDefinition) {
        const yamlContent = exportTemplateToYaml(tpl);
        openModal({
            title: `Export ${tpl.title} (YAML)`,
            icon: 'bx-export',
            confirmText: 'Copy to Clipboard',
            cancelText: 'Close',
            body: `
                <div class="ns-field">
                    <label>Single Template Specification</label>
                    <textarea class="form-control form-control-sm font-monospace yaml-export-text" rows="14" readonly>${escapeHtml(yamlContent)}</textarea>
                    <small class="ns-row-desc">Share or paste into another Trilium Notes System package.</small>
                </div>
                <div class="copy-status alert alert-success d-none py-1 px-2 tiny mt-2">Copied to clipboard!</div>
            `,
        }, (content) => {
            const textarea = content.querySelector<HTMLTextAreaElement>('.yaml-export-text');
            if (textarea) {
                textarea.select();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(textarea.value);
                }
                const status = content.querySelector<HTMLElement>('.copy-status');
                if (status) status.classList.remove('d-none');
            }
            return false;
        });
    }

    function openImportTemplateModal() {
        openModal({
            title: 'Import Template from YAML',
            icon: 'bx-import',
            confirmText: 'Import Template',
            body: `
                <div class="ns-field">
                    <label for="import-yaml-input">Paste Template YAML</label>
                    <textarea id="import-yaml-input" class="form-control form-control-sm font-monospace" rows="12" placeholder="Paste single template YAML specification here..."></textarea>
                    <small class="ns-row-desc">Expects a YAML document with template properties, attributes, and parentLinks.</small>
                </div>
                <div class="import-error alert alert-danger d-none py-1 px-2 tiny m-0"></div>
            `,
        }, (content) => {
            const yamlStr = content.querySelector<HTMLTextAreaElement>('#import-yaml-input')?.value || '';
            const errorBox = content.querySelector<HTMLElement>('.import-error');

            try {
                const imported = importTemplateFromYaml(yamlStr);
                templateEngine.registerTemplate(imported);
                selectedTemplateId = imported.id;
                activeEditorTab = 'editor';
                onSave();
                refresh();
                return true;
            } catch (err: any) {
                if (errorBox) {
                    errorBox.textContent = `Import failed: ${err.message}`;
                    errorBox.classList.remove('d-none');
                }
                return false;
            }
        });
    }

    function openRelationshipModal(tpl: TemplateDefinition, editIdx?: number) {
        const isEdit = editIdx !== undefined;
        const rel = isEdit ? tpl.relationships[editIdx] : {
            id: `rel_${tpl.id}_${Date.now()}`,
            name: 'project link',
            relationName: 'project',
            targetTemplateId: 'projectHub',
            targetTemplateName: 'Project Hub',
            isMulti: false,
            autoCloneToParent: true,
            inheritTopics: true,
            direction: 'parent' as const,
        };

        const allTemplates = templateEngine.getAllTemplates();

        const modal = openModal({
            title: isEdit ? 'Edit parent link' : 'Add parent link',
            icon: 'bx-link',
            confirmText: 'Save link',
            body: `
                <div class="ns-field">
                    <label for="rel-name">Relation name</label>
                    <input type="text" id="rel-name" class="form-control form-control-sm" value="${escapeHtml(rel.relationName)}">
                    <small class="ns-row-desc">Used as ~name on the note, e.g. project, client, attendee.</small>
                </div>
                <div class="ns-field">
                    <label for="rel-target">Parent template</label>
                    <div class="rel-target-slot"></div>
                </div>
                <div class="ns-toggles"></div>
            `,
        }, (content) => {
            const relName = content.querySelector<HTMLInputElement>('#rel-name')!.value.trim();
            if (!relName) return false;

            const targetId = targetPicker.getValue();
            const targetTpl = templateEngine.getTemplate(targetId);
            const targetName = targetTpl ? targetTpl.title : targetId;

            rel.relationName = relName;
            rel.targetTemplateId = targetId;
            rel.targetTemplateName = targetName;
            rel.autoCloneToParent = cloneRow.querySelector<HTMLInputElement>('input')!.checked;
            rel.inheritTopics = topicsRow.querySelector<HTMLInputElement>('input')!.checked;

            if (!isEdit) tpl.relationships.push(rel);
            templateEngine.updateTemplate(tpl.id, tpl);

            ifThenRuleEngine.registerRule({
                id: `rule_rel_${tpl.id}_${relName}`,
                name: `Parent link ~${relName} → ${targetName}`,
                description: `When the note has ~${relName}, link it to ${targetName}, file a reference link under the parent container, and inherit parent topics.`,
                enabled: true,
                isBuiltin: false,
                trigger: { type: 'onNoteCreated', targetTemplateId: tpl.id },
                conditions: [{ field: relName, operator: 'isSet', value: true }],
                actions: [
                    { type: 'cloneToContainer', params: { relationName: relName } },
                    { type: 'syncDerivedTopics', params: {} },
                ],
            });

            onSave();
            refresh();
        });

        // A searchable picker rather than a plain <select> — the template list
        // only grows as categories fill in, and scanning a couple dozen options by
        // scrolling a native dropdown gets old fast.
        const targetPicker = searchableSelect({
            id: 'rel-target',
            value: rel.targetTemplateId,
            placeholder: 'Search templates…',
            options: allTemplates.map((t) => ({ value: t.id, label: t.title, description: `#${t.marker}` })),
        });
        modal.querySelector('.rel-target-slot')!.appendChild(targetPicker.el);

        // Toggles are real controls rather than markup, so they carry their state.
        const toggles = modal.querySelector('.ns-toggles') as HTMLElement;
        const cloneRow = switchRow({
            id: 'rel-clone',
            label: 'File a reference link under the parent',
            checked: rel.autoCloneToParent,
        });
        const topicsRow = switchRow({
            id: 'rel-topics',
            label: 'Inherit parent topics and metadata',
            checked: rel.inheritTopics,
        });
        toggles.appendChild(cloneRow);
        toggles.appendChild(topicsRow);
    }

    function openNewTemplateModal() {
        const categories = templateEngine.getAllCategories();

        const modal = openModal({
            title: 'New template',
            icon: 'bx-plus',
            confirmText: 'Create template',
            body: `
                <div class="ns-field">
                    <label for="new-tpl-title">Title</label>
                    <input type="text" id="new-tpl-title" class="form-control form-control-sm" placeholder="Research Brief">
                </div>
                <div class="ns-field">
                    <label for="new-tpl-cat">Category</label>
                    <div class="new-tpl-cat-slot"></div>
                </div>
            `,
        }, (content) => {
            const title = content.querySelector<HTMLInputElement>('#new-tpl-title')!.value.trim();
            if (!title) return false;

            const category = categoryPicker.getValue();
            const id = title.toLowerCase().replace(/\s+/g, '-');

            templateEngine.registerTemplate({
                id,
                marker: `ext${title.replace(/\s+/g, '')}`,
                title,
                category: category || 'work',
                rootContainerMarker: 'projectRoot',
                titlePattern: '{title}',
                icon: 'file-blank',
                attributes: [],
                relationships: [],
                defaultContent: `<h2>${escapeHtml(title)}</h2><p>Notes content…</p>`,
            });

            selectedTemplateId = id;
            activeEditorTab = 'editor';
            onSave();
            refresh();
        });

        const categoryPicker = searchableSelect({
            id: 'new-tpl-cat',
            value: categories[0]?.id ?? 'work',
            placeholder: 'Search categories…',
            options: categories.map((c) => ({ value: c.id, label: c.title, description: c.description })),
        });
        modal.querySelector('.new-tpl-cat-slot')!.appendChild(categoryPicker.el);
    }

    function openNewCategoryModal() {
        openModal({
            title: 'New category',
            icon: 'bx-plus',
            confirmText: 'Create category',
            body: `
                <div class="ns-field">
                    <label for="cat-title">Title</label>
                    <input type="text" id="cat-title" class="form-control form-control-sm" placeholder="Legal Documents">
                </div>
                <div class="ns-field">
                    <label for="cat-desc">Description</label>
                    <input type="text" id="cat-desc" class="form-control form-control-sm" placeholder="Contracts and legal agreements">
                </div>
            `,
        }, (content) => {
            const title = content.querySelector<HTMLInputElement>('#cat-title')!.value.trim();
            if (!title) return false;

            const id = title.toLowerCase().replace(/\s+/g, '-');
            templateEngine.registerCategory({
                id,
                title,
                description: content.querySelector<HTMLInputElement>('#cat-desc')!.value || 'Custom category',
                icon: 'layer',
                defaultRootMarker: 'unassignedRoot',
                autoJournalClone: true,
                inheritParentTopics: true,
                projectScopedDefault: false,
                isBuiltin: false,
            });

            selectedCategoryId = id;
            onSave();
            refresh();
        });
    }

    function openAddAttrModal(tpl: TemplateDefinition) {
        openModal({
            title: 'Add promoted attribute',
            icon: 'bx-list-check',
            confirmText: 'Add attribute',
            body: `
                <div class="ns-field">
                    <label for="attr-name">Name</label>
                    <input type="text" id="attr-name" class="form-control form-control-sm" placeholder="priority">
                    <small class="ns-row-desc">Without the leading # or ~.</small>
                </div>
                <div class="ns-field-grid">
                    <div class="ns-field">
                        <label for="attr-kind">Kind</label>
                        <select id="attr-kind" class="form-select form-select-sm">
                            <option value="label">Label (#)</option>
                            <option value="relation">Relation (~)</option>
                        </select>
                    </div>
                    <div class="ns-field">
                        <label for="attr-type">Type</label>
                        <select id="attr-type" class="form-select form-select-sm">
                            <option value="string">Text</option>
                            <option value="select">Select</option>
                            <option value="date">Date</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                        </select>
                    </div>
                </div>
            `,
        }, (content) => {
            const name = content.querySelector<HTMLInputElement>('#attr-name')!.value.trim();
            if (!name) return false;

            tpl.attributes.push({
                name,
                type: content.querySelector<HTMLSelectElement>('#attr-kind')!.value === 'relation' ? 'relation' : 'label',
                dataType: content.querySelector<HTMLSelectElement>('#attr-type')!.value as never,
                isPromoted: true,
            });
            templateEngine.updateTemplate(tpl.id, tpl);
            onSave();
            refresh();
        });
    }

    refresh();
}
