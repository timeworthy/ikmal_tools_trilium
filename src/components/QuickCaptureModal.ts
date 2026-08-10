/**
 * Quick Capture Modal Component: creates a note from a template, with a picker
 * for each of the template's parent-link relationships (e.g. which Project Hub
 * a Task belongs to) so auto-clone and derived-topic inheritance have something
 * real to act on. Styled natively with Trilium Boxicons and design tokens.
 * Accurately implements original system contract for New Story (project) vs New Edit (edit).
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { NoteCreationEngine, NoteCreationPlan } from '../engine/noteCreationEngine.js';
import { materializeNoteCreation, MaterializeResult, TriliumFrontendApi } from '../engine/noteMaterializer.js';
import { escapeHtml, searchableSelect, ComboboxHandle } from './nativeUi.js';

interface TriliumFNote {
    noteId: string;
    title: string;
}

function formatOptionLabel(attrName: string, opt: string): string {
    const map: Record<string, string> = {
        todo: '📝 To Do',
        in_progress: '⏳ In Progress',
        done: '✅ Done',
        cancelled: '🚫 Cancelled',
        drafting: '✏️ Drafting',
        editing: '✂️ Editing',
        review: '👀 In Review',
        published: '🚀 Published',
        approved: '✅ Approved',
        returned: '🔄 Returned',
        active: '🟢 Active',
        archived: '📦 Archived',
        on_hold: '⏸️ On Hold',
        awaiting: '⏳ Awaiting Reply',
        high: '🔴 High Priority',
        medium: '🟡 Medium Priority',
        low: '🟢 Low Priority',
        simple: '⚡ Simple Task',
        multi: '🧩 Multi-step Task',
        project: '📘 Story Project',
        edit: '✏️ Edit Package',
        client: '🏢 Client Hub',
        internal: '⚙️ Internal Hub',
    };
    return map[opt] || opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ');
}

function triliumApi(explicitApi?: TriliumFrontendApi | null): TriliumFrontendApi | null {
    const a = explicitApi || (globalThis as any).api;
    return a && typeof a.searchForNotes === 'function' ? a : null;
}

export interface QuickCaptureOptions {
    api?: TriliumFrontendApi | null;
}

export interface QuickCaptureOutcome {
    plan: NoteCreationPlan;
    /** Present only when the note was actually created (i.e. running inside Trilium). */
    result?: MaterializeResult;
}

export async function showQuickCaptureModal(
    templateId: string,
    templateEngine: TemplateEngine,
    noteCreationEngine: NoteCreationEngine,
    onCreated?: (outcome: QuickCaptureOutcome) => void,
    initialRelations?: Record<string, string | string[]>,
    options?: QuickCaptureOptions,
): Promise<void> {
    const isStoryOrEdit = templateId === 'story' || templateId === 'edit';
    const activeTplId = isStoryOrEdit ? 'story' : templateId;
    const template = templateEngine.getTemplate(activeTplId);
    if (!template) return;

    const isEditMode = templateId === 'edit';

    // Explanations matching original bespoke contract
    const descriptions: Record<string, string> = {
        task: 'Creates an actionable task item with priority, due date, and status labels.',
        meeting: 'Creates a meeting notes document linked to participants, clients, or organizations.',
        story: 'Starts a full Story Project from scratch. Creates a Project Hub (#kind=project), a Story Draft (#status=drafting), and a dedicated Reporting & Notes child note. Auto-cloned to today\'s Journal.',
        edit: 'Starts a Quick Edit Package. Creates an Edit Project Hub (#kind=edit) and a Story Draft (#status=editing, #workflow=edit) for fast copy editing/proofreading, skipping extra reporting notes. Auto-cloned to today\'s Journal.',
        dailyNote: 'Creates today\'s daily journal note.',
        projectHub: 'Creates a new Project Hub root folder to organize tasks, stories, and meetings.',
        scratch: 'Creates a quick scratchpad note. Choose an Active Project Hub to organize it under a project, or keep it in Unassigned for later.',
    };

    const description = descriptions[templateId] || `Creates a new ${template.title} note.`;
    const modalTitle = isEditMode ? 'New Edit Package' : (templateId === 'story' ? 'New Story Project' : `New ${template.title}`);

    // Each parent-link relationship gets a picker over real candidate notes,
    // fetched up front so the modal renders with real options rather than a
    // spinner. Outside Trilium (no api) relationships render with no
    // candidates, same as the rest of this modal's preview-only fallback.
    const api = triliumApi(options?.api);
    const relationCandidates = new Map<string, TriliumFNote[]>();
    const candidateTemplateIds = new Map<string, string>();
    for (const rel of template.relationships) {
        candidateTemplateIds.set(rel.relationName, rel.targetTemplateId);
    }
    for (const attr of template.attributes) {
        if (attr.dataType === 'relation' && attr.targetTemplateId) {
            candidateTemplateIds.set(attr.name, attr.targetTemplateId);
        }
    }

    for (const [fieldName, targetTemplateId] of candidateTemplateIds) {
        if (!api) { relationCandidates.set(fieldName, []); continue; }
        const targetTpl = templateEngine.getTemplate(targetTemplateId);
        let notes: TriliumFNote[] = [];
        if (targetTpl) {
            notes = await api.searchForNotes(`#${targetTpl.marker}`);
            if (targetTpl.id === 'projectHub') {
                const legacyHubs = await api.searchForNotes('#extTemplate=projectHub');
                for (const h of legacyHubs) {
                    if (!notes.some((existing) => existing.noteId === h.noteId)) {
                        notes.push(h);
                    }
                }
            }
        }
        relationCandidates.set(fieldName, notes);
    }

    // Modal overlay container
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade show';
    backdrop.style.zIndex = '1050';

    const modal = document.createElement('div');
    modal.className = 'modal fade show d-block';
    modal.tabIndex = -1;
    modal.style.zIndex = '1055';

    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content border shadow-lg" style="background-color: var(--sub-background-color, transparent); color: var(--main-text-color, inherit); border-color: var(--border-color, rgba(128,128,128,0.3)) !important;">
                <div class="modal-header border-bottom p-3">
                    <h5 class="modal-title h6 font-weight-bold d-flex align-items-center gap-2">
                        <i class="bx bx-${isEditMode ? 'edit' : template.icon} text-primary"></i>
                        <span>${modalTitle}</span>
                    </h5>
                    <button type="button" class="btn-close close-btn" aria-label="Close"></button>
                </div>
                <div class="modal-body p-4 d-flex flex-column gap-3">
                    <div class="d-flex align-items-center gap-1.5 flex-wrap pb-2 border-bottom template-switcher-bar">
                        <span class="tiny text-muted font-weight-bold me-1"><i class="bx bx-category"></i> Switch Template:</span>
                        ${[
                            { id: 'task', label: 'Task', icon: 'check-square' },
                            { id: 'story', label: 'Story Project', icon: 'news' },
                            { id: 'edit', label: 'Edit Package', icon: 'edit' },
                            { id: 'meeting', label: 'Meeting', icon: 'calendar-event' },
                            { id: 'person', label: 'Person', icon: 'user' },
                            { id: 'organization', label: 'Organization', icon: 'buildings' },
                            { id: 'projectHub', label: 'Project Hub', icon: 'book' },
                            { id: 'scratch', label: 'Scratch', icon: 'file-blank' },
                            { id: 'topic', label: 'Topic', icon: 'purchase-tag' },
                        ].map(t => `
                            <button type="button" class="btn btn-micro ${t.id === templateId ? 'btn-primary' : 'btn-outline-secondary'} tpl-switch-btn" data-tpl="${t.id}" style="border-radius: 12px;">
                                <i class="bx bx-${t.icon}"></i> ${t.label}
                            </button>
                        `).join('')}
                    </div>

                    <div class="p-3 rounded border" style="background-color: var(--main-background-color, transparent); border-color: var(--border-color, rgba(128,128,128,0.2)) !important;">
                        <div class="small font-weight-bold text-info d-flex align-items-center gap-1.5 mb-1">
                            <i class="bx bx-info-circle"></i> Quick Capture: ${modalTitle}
                        </div>
                        <p class="small text-muted m-0">${description}</p>
                    </div>

                    <div>
                        <label class="form-label small font-weight-bold">${modalTitle} Title</label>
                        <input type="text" class="form-control title-input" placeholder="e.g. ${isEditMode ? 'Round 1 Edit Package' : 'Investigative Report Title'}" value="">
                    </div>

                    ${template.attributes.filter((a) => !(a.dataType === 'relation' && template.relationships.some((rel) => rel.relationName === a.name))).length > 0 ? `
                        <div class="border-top pt-3">
                            <label class="form-label small font-weight-bold d-flex align-items-center gap-1 mb-2">
                                <i class="bx bx-slider-alt text-success"></i> Promoted Form Attributes
                            </label>
                            <div class="row g-2 attr-form">
                                ${template.attributes
                                    .filter((a) => !(a.dataType === 'relation' && template.relationships.some((rel) => rel.relationName === a.name)))
                                    .map(a => {
                                    const opts = a.options || (
                                        a.name === 'priority' ? ['medium', 'high', 'low'] :
                                        a.name === 'complexity' ? ['simple', 'multi'] :
                                        a.name === 'kind' ? ['project', 'edit', 'client', 'internal'] :
                                        a.name === 'status' ? (
                                            templateId === 'story' ? ['drafting', 'review', 'published'] :
                                            templateId === 'edit' ? ['editing', 'approved', 'returned'] :
                                            templateId === 'projectHub' ? ['active', 'on_hold', 'complete', 'archived'] :
                                            ['todo', 'in_progress', 'done', 'cancelled']
                                        ) : undefined
                                    );
                                    const isRelationPicker = a.dataType === 'relation' && Boolean(a.targetTemplateId);
                                    const isOptionPicker = isRelationPicker || a.dataType === 'select' || Boolean(opts);
                                    const relationOptions = isRelationPicker ? (relationCandidates.get(a.name) || []) : [];
                                    const targetTpl = a.targetTemplateId ? templateEngine.getTemplate(a.targetTemplateId) : undefined;
                                    return `
                                    <div class="col-md-6">
                                        <label class="form-label tiny text-muted font-weight-bold">#${a.name}</label>
                                        ${isOptionPicker ? `
                                            <div class="attr-picker" data-attr-picker="${escapeHtml(a.name)}"></div>
                                        ` : `
                                            <input type="${a.dataType === 'date' ? 'date' : 'text'}" class="form-control form-control-sm attr-input" data-attr="${escapeHtml(a.name)}" value="${escapeHtml(String(a.defaultValue ?? ''))}" placeholder="Value...">
                                        `}
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${template.relationships.length > 0 ? `
                        <div class="border-top pt-3 rel-form">
                            <label class="form-label small font-weight-bold d-flex align-items-center gap-1 mb-2">
                                <i class="bx bx-link text-warning"></i> Parent links
                            </label>
                        </div>
                    ` : ''}

                    <!-- Error state -->
                    <div class="create-error alert alert-danger d-none m-0"></div>
                </div>
                <div class="modal-footer border-top p-3 d-flex justify-content-between align-items-center">
                    <span class="destination-badge text-muted tiny font-weight-bold d-flex align-items-center gap-1" style="opacity: 0.85;">
                        <i class="bx bx-map-pin text-primary"></i> <span class="dest-label">Landing: ${escapeHtml(template.title)} Container</span>
                    </span>
                    <div class="d-flex align-items-center gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary close-btn">Cancel</button>
                        <button type="button" class="btn btn-sm btn-primary create-btn d-flex align-items-center gap-1" title="Cmd/Ctrl+Enter to create">
                            <i class="bx bx-plus"></i> Create ${modalTitle}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const closeButtons = modal.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => btn.addEventListener('click', closeModal));

    const tplSwitchButtons = modal.querySelectorAll('.tpl-switch-btn');
    tplSwitchButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const targetTpl = (e.currentTarget as HTMLElement).dataset.tpl;
            if (targetTpl && targetTpl !== templateId) {
                closeModal();
                showQuickCaptureModal(targetTpl, templateEngine, noteCreationEngine, onCreated, initialRelations, options);
            }
        });
    });

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    const destLabel = modal.querySelector('.dest-label') as HTMLElement;
    function updateDestinationBadge() {
        if (!destLabel) return;
        const projectPicker = relPickers.get('project');
        const selectedProjectVal = projectPicker ? projectPicker.getValue() : null;
        if (isStoryOrEdit && !selectedProjectVal) {
            destLabel.textContent = 'Destination: Projects / Active';
        } else if (selectedProjectVal) {
            const projCandidates = relationCandidates.get('project') || [];
            const match = projCandidates.find((c) => c.noteId === selectedProjectVal);
            destLabel.textContent = `Destination: Under ${match?.title || 'Selected Project'}`;
        } else if (templateId === 'task') {
            destLabel.textContent = 'Destination: Tasks / Unassigned (+ Journal Clone)';
        } else if (templateId === 'scratch') {
            destLabel.textContent = 'Destination: Projects / Unassigned';
        } else {
            destLabel.textContent = `Destination: ${template?.title || modalTitle} Folder`;
        }
    }

    // Relation pickers are real controls, not markup, so they carry their own
    // state the same way nativeUi's other composite fields do.
    const attrPickers = new Map<string, ComboboxHandle<any>>();
    const relPickers = new Map<string, ComboboxHandle<any>>();
    modal.querySelectorAll<HTMLElement>('.attr-picker').forEach((placeholder) => {
        const attrName = placeholder.dataset.attrPicker;
        const attrDef = template.attributes.find((candidate) => candidate.name === attrName);
        if (!attrName || !attrDef) return;

        const isRelationPicker = attrDef.dataType === 'relation' && Boolean(attrDef.targetTemplateId);
        const fallbackOptions = attrDef.name === 'priority' ? ['medium', 'high', 'low']
            : attrDef.name === 'complexity' ? ['simple', 'multi']
                : attrDef.name === 'kind' ? ['project', 'edit', 'client', 'internal']
                    : attrDef.name === 'status' ? (
                        templateId === 'story' ? ['drafting', 'review', 'published']
                            : templateId === 'edit' ? ['editing', 'approved', 'returned']
                                : templateId === 'projectHub' ? ['active', 'on_hold', 'complete', 'archived']
                                    : ['todo', 'in_progress', 'done', 'cancelled']
                    ) : [];
        const options = isRelationPicker
            ? (relationCandidates.get(attrName) || []).map((note) => ({
                value: note.noteId,
                label: note.title,
                icon: attrDef.targetTemplateId ? `bx-${templateEngine.getTemplate(attrDef.targetTemplateId)?.icon || 'file'}` : 'bx-file',
            }))
            : (attrDef.options || fallbackOptions).map((option) => ({
                value: option,
                label: formatOptionLabel(attrName, option),
            }));
        const picker = searchableSelect({
            id: `attr-${attrName}`,
            value: String(attrDef.defaultValue ?? ''),
            placeholder: isRelationPicker
                ? (options.length ? `Search ${templateEngine.getTemplate(attrDef.targetTemplateId!)?.title || 'notes'}…` : 'No matching notes found')
                : 'Choose or search…',
            options,
        });
        placeholder.replaceWith(picker.el);
        attrPickers.set(attrName, picker);
    });

    const relForm = modal.querySelector('.rel-form');
    for (const rel of template.relationships) {
        const candidates = relationCandidates.get(rel.relationName) ?? [];
        const field = document.createElement('div');
        field.className = 'ns-field mb-2';
        const labelText = rel.isMulti
            ? `~${escapeHtml(rel.relationName)} (multi) &rarr; ${escapeHtml(rel.targetTemplateName)}`
            : `~${escapeHtml(rel.relationName)} &rarr; ${escapeHtml(rel.targetTemplateName)}`;

        const headerRow = document.createElement('div');
        headerRow.className = 'd-flex justify-content-between align-items-center mb-1';
        headerRow.innerHTML = `<label class="form-label tiny text-muted font-weight-bold m-0">${labelText}</label>`;

        const targetTplId = rel.targetTemplateId;
        if (['organization', 'person', 'client', 'companyOnBehalf', 'employer'].includes(rel.relationName) || ['organization', 'person'].includes(targetTplId)) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn btn-link btn-sm p-0 tiny text-decoration-none text-primary';
            addBtn.innerHTML = `<i class="bx bx-plus-circle"></i> New ${escapeHtml(rel.targetTemplateName)}`;
            addBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const newTitle = (globalThis as any).prompt ? (globalThis as any).prompt(`Enter title for new ${rel.targetTemplateName}:`) : null;
                if (!newTitle || !newTitle.trim()) return;
                const entType = targetTplId === 'person' ? 'person' : 'organization';
                const plan = noteCreationEngine.planNoteCreation({
                    type: entType,
                    title: newTitle.trim(),
                });
                try {
                    const res = api ? await materializeNoteCreation(plan, { api }) : undefined;
                    const createdId = res ? res.noteId : `preview_${Date.now()}`;
                    candidates.push({ noteId: createdId, title: newTitle.trim() });
                    picker.setOptions?.(candidates.map((n) => ({ value: n.noteId, label: n.title })));
                    picker.setValue(rel.isMulti ? [...(Array.isArray(picker.getValue()) ? picker.getValue() : []), createdId] : createdId);
                    updateDestinationBadge();
                } catch (err: any) {
                    if ((globalThis as any).alert) (globalThis as any).alert(`Could not create ${rel.targetTemplateName}: ${err.message}`);
                }
            });
            headerRow.appendChild(addBtn);
        }
        field.appendChild(headerRow);

        // Add Quick Chips for top candidate active projects
        if (rel.relationName === 'project' && candidates.length > 0) {
            const chipsRow = document.createElement('div');
            chipsRow.className = 'd-flex align-items-center gap-1 mb-1.5 flex-wrap project-quick-chips';
            chipsRow.innerHTML = `<span class="tiny text-muted me-1">Quick pick:</span>`;
            candidates.slice(0, 4).forEach((c) => {
                const chipBtn = document.createElement('button');
                chipBtn.type = 'button';
                chipBtn.className = 'btn btn-micro btn-outline-secondary';
                chipBtn.style.borderRadius = '10px';
                chipBtn.innerHTML = `<i class="bx bx-book"></i> ${escapeHtml(c.title)}`;
                chipBtn.addEventListener('click', () => {
                    picker.setValue(c.noteId);
                    updateDestinationBadge();
                });
                chipsRow.appendChild(chipBtn);
            });
            field.appendChild(chipsRow);
        }

        const initialVal = initialRelations && initialRelations[rel.relationName]
            ? initialRelations[rel.relationName]
            : (rel.isMulti ? [] : '');

        const targetTpl = templateEngine.getTemplate(rel.targetTemplateId);
        const iconClass = targetTpl?.icon ? `bx-${targetTpl.icon}` : 'bx-file';

        const picker = searchableSelect({
            id: `rel-${rel.relationName}`,
            value: initialVal,
            isMulti: rel.isMulti,
            placeholder: candidates.length ? `Search ${rel.targetTemplateName}…` : `No existing ${rel.targetTemplateName} notes found`,
            options: candidates.map((n) => ({ value: n.noteId, label: n.title, icon: iconClass })),
        });
        field.appendChild(picker.el);
        relForm?.appendChild(field);
        relPickers.set(rel.relationName, picker);
    }

    updateDestinationBadge();

    const titleInput = modal.querySelector('.title-input') as HTMLInputElement;
    const createBtn = modal.querySelector('.create-btn') as HTMLButtonElement;
    const errorBox = modal.querySelector('.create-error') as HTMLElement;

    setTimeout(() => titleInput?.focus(), 50);

    modal.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            createBtn.click();
        }
    });

    createBtn.addEventListener('click', async () => {
        const rawTitle = titleInput.value.trim() || `Untitled ${modalTitle}`;
        const attrInputs = modal.querySelectorAll('.attr-input');
        const attributes: Record<string, any> = {};

        attrInputs.forEach((input: any) => {
            const attrName = input.dataset.attr;
            if (attrName) attributes[attrName] = input.value;
        });
        for (const [attrName, picker] of attrPickers) {
            const value = picker.getValue();
            if (value && (Array.isArray(value) ? value.length > 0 : true)) {
                attributes[attrName] = value;
            }
        }

        const relations: Record<string, string | string[]> = {};
        for (const [relationName, picker] of relPickers) {
            const value = picker.getValue();
            if (value && (Array.isArray(value) ? value.length > 0 : true)) {
                relations[relationName] = value;
            }
        }

        const plan = noteCreationEngine.planNoteCreation({
            type: templateId,
            title: rawTitle,
            attributes,
            relations,
            mode: isEditMode ? 'edit' : 'project',
        });

        errorBox.classList.add('d-none');
        createBtn.disabled = true;
        createBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating…';

        try {
            const result = api ? await materializeNoteCreation(plan, { api }) : undefined;
            if (result) api?.showMessage?.(`Created "${result.title}".`);
            closeModal();
            onCreated?.({ plan, result });
        } catch (err: any) {
            errorBox.textContent = `Could not create the note: ${err.message}`;
            errorBox.classList.remove('d-none');
            createBtn.disabled = false;
            createBtn.innerHTML = `<i class="bx bx-plus"></i> Create ${escapeHtml(modalTitle)}`;
        }
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
}
