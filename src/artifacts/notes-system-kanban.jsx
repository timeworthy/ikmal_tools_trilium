/**
 * Standalone Task Kanban Board (JSX Render Note)
 * Renders an interactive Kanban board note for tasks (#extTask), allowing it
 * to be embedded anywhere in Trilium or pinned in the sidebar.
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { TodayEngine } from '../engine/todayEngine.js';
import { NoteCreationEngine } from '../engine/noteCreationEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { escapeHtml, section } from '../components/nativeUi.js';
import { loadRuntimeModel } from '../engine/runtimeModel.js';

function labelValue(note, name) {
    return note?.getOwnedLabelValue?.(name)
        ?? note?.getLabelValue?.(name)
        ?? note?.labels?.find?.((label) => label.name === name)?.value
        ?? note?.attributes?.find?.((attribute) => attribute.type === 'label' && attribute.name === name)?.value
        ?? '';
}

export function initNotesSystemKanban(containerEl) {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const todayEngine = new TodayEngine();
    const settingsEngine = new SettingsEngine();
    const noteCreationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine);
    const frontendApi = typeof api !== 'undefined' ? api : null;
    const modelReady = loadRuntimeModel(templateEngine, todayEngine, ifThenRuleEngine, settingsEngine, frontendApi);

    const shell = document.createElement('div');
    shell.className = 'notes-system-shell p-3';

    let priorityFilter = 'all';

    const { card } = section(shell, {
        title: 'Task Kanban Board',
        description: 'Live active task cards sorted by status column.',
    });

    const filterRow = document.createElement('div');
    filterRow.className = 'd-flex align-items-center gap-1.5 mb-2 mt-1 flex-wrap';
    filterRow.innerHTML = `
        <span class="tiny text-muted me-1"><i class="bx bx-filter-alt"></i> Filter:</span>
        <button type="button" class="btn btn-micro btn-primary filter-pill" data-filter="all">All Tasks</button>
        <button type="button" class="btn btn-micro btn-outline-danger filter-pill" data-filter="high">🔴 High Priority</button>
        <button type="button" class="btn btn-micro btn-outline-warning filter-pill" data-filter="medium">🟡 Medium</button>
        <button type="button" class="btn btn-micro btn-outline-secondary filter-pill" data-filter="low">🟢 Low</button>
    `;
    filterRow.querySelectorAll('.filter-pill').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            filterRow.querySelectorAll('.filter-pill').forEach((b) => {
                b.className = b.className.replace('btn-primary', 'btn-outline-primary');
            });
            const filter = (e.currentTarget).dataset.filter;
            priorityFilter = filter || 'all';
            (e.currentTarget).className = (e.currentTarget).className.replace('btn-outline-primary', 'btn-primary');
            renderColumns();
        });
    });
    card.appendChild(filterRow);

    const board = document.createElement('div');
    board.className = 'ns-kanban mt-2';

    const KANBAN_COLUMNS = [
        { id: 'todo', title: 'To Do' },
        { id: 'in_progress', title: 'In Progress' },
        { id: 'done', title: 'Done' },
    ];

    let taskCache = [];
    let taskLoadGeneration = 0;

    function loadTasks() {
        const generation = ++taskLoadGeneration;
        if (!frontendApi?.searchForNotes) {
            taskCache = [
                { id: 't1', title: 'Sample Task 1 (Offline)', status: 'todo' },
                { id: 't2', title: 'Sample Task 2 (Offline)', status: 'in_progress' },
            ];
            renderColumns();
            return;
        }

        frontendApi.searchForNotes('#extTask').then((notes) => {
            if (generation !== taskLoadGeneration) return;
            taskCache = (notes || []).map((n) => ({
                id: n.noteId,
                title: n.title || 'Untitled Task',
                status: labelValue(n, 'status') || 'todo',
                priority: labelValue(n, 'priority') || 'medium',
            }));
            renderColumns();
        }).catch((err) => {
            console.error('[Kanban Widget] Search failed:', err);
        });
    }

    function priorityBadgeHtml(prio) {
        const map = {
            high: '<span class="badge bg-danger-subtle text-danger tiny font-weight-bold"><i class="bx bxs-circle"></i> High</span>',
            medium: '<span class="badge bg-warning-subtle text-warning tiny font-weight-bold"><i class="bx bxs-circle"></i> Medium</span>',
            low: '<span class="badge bg-success-subtle text-success tiny font-weight-bold"><i class="bx bxs-circle"></i> Low</span>',
        };
        return map[prio] || map.medium;
    }

    function renderColumns() {
        board.innerHTML = '';
        for (const column of KANBAN_COLUMNS) {
            const tasks = taskCache.filter((t) => t.status === column.id && (priorityFilter === 'all' || (t.priority || 'medium') === priorityFilter));

            const col = document.createElement('div');
            col.className = 'kanban-col';
            col.dataset.colId = column.id;
            col.innerHTML = `
                <div class="ns-kanban-head d-flex justify-content-between align-items-center">
                    <span>${escapeHtml(column.title)}</span>
                    <span class="ns-count">${tasks.length}</span>
                </div>
            `;

            const list = document.createElement('div');
            list.className = 'ns-kanban-list';
            list.dataset.colId = column.id;

            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                list.classList.add('kanban-drag-over');
            });
            list.addEventListener('dragleave', () => {
                list.classList.remove('kanban-drag-over');
            });
            list.addEventListener('drop', (e) => {
                e.preventDefault();
                list.classList.remove('kanban-drag-over');
                const noteId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
                if (!noteId) return;
                const task = taskCache.find((t) => t.id === noteId);
                if (task && task.status !== column.id) {
                    task.status = column.id;
                    if (frontendApi?.getNote) {
                        try {
                            const note = frontendApi.getNote(noteId);
                            if (note) {
                                note.setLabel('status', column.id);
                                if (column.id === 'done') {
                                    note.setLabel('doneDate', new Date().toISOString().slice(0, 10));
                                }
                            }
                        } catch (err) {}
                    }
                    renderColumns();
                }
            });

            if (tasks.length) {
                for (const t of tasks) {
                    const cardItem = document.createElement('div');
                    cardItem.className = `ns-kanban-card d-flex flex-column gap-1 ${t.status === 'done' ? 'ns-card-done' : ''}`;
                    cardItem.draggable = true;
                    cardItem.dataset.noteId = t.id;

                    cardItem.addEventListener('dragstart', (e) => {
                        if (e.dataTransfer) {
                            e.dataTransfer.setData('text/plain', t.id);
                            e.dataTransfer.effectAllowed = 'move';
                        }
                        cardItem.classList.add('ns-card-dragging');
                    });
                    cardItem.addEventListener('dragend', () => {
                        cardItem.classList.remove('ns-card-dragging');
                    });

                    cardItem.innerHTML = `
                        <div class="d-flex justify-content-between align-items-start gap-1">
                            <span class="ns-card-title cursor-pointer">${escapeHtml(t.title)}</span>
                            ${priorityBadgeHtml(t.priority || 'medium')}
                        </div>
                        <div class="d-flex align-items-center gap-1 mt-1 card-actions-row">
                            ${column.id !== 'in_progress' && column.id !== 'done' ? `
                                <button type="button" class="btn btn-micro btn-outline-info move-btn" data-target="in_progress" title="Move to In Progress">
                                    <i class="bx bx-time"></i> Progress
                                </button>
                            ` : ''}
                            ${column.id !== 'done' ? `
                                <button type="button" class="btn btn-micro btn-outline-success move-btn" data-target="done" title="Mark Done">
                                    <i class="bx bx-check"></i> Done
                                </button>
                            ` : ''}
                        </div>
                    `;
                    cardItem.querySelector('.ns-card-title')?.addEventListener('click', () => {
                        if (frontendApi?.openNote) {
                            frontendApi.openNote(t.id);
                        }
                    });
                    cardItem.querySelectorAll('.move-btn').forEach((btn) => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const newStatus = (e.currentTarget).dataset.target;
                            if (!newStatus) return;
                            t.status = newStatus;
                            if (newStatus === 'done') {
                                cardItem.classList.add('ns-card-done-anim');
                            }
                            if (frontendApi?.getNote) {
                                try {
                                    const note = frontendApi.getNote(t.id);
                                    if (note) {
                                        note.setLabel('status', newStatus);
                                        if (newStatus === 'done') {
                                            note.setLabel('doneDate', new Date().toISOString().slice(0, 10));
                                        }
                                    }
                                } catch (err) {}
                            }
                            setTimeout(() => loadTasks(), 250);
                        });
                    });
                    list.appendChild(cardItem);
                }
            } else {
                const empty = document.createElement('div');
                empty.className = 'ns-empty tiny p-2 text-center text-muted';
                empty.textContent = 'No tasks';
                list.appendChild(empty);
            }

            col.appendChild(list);
            board.appendChild(col);
        }
    }

    card.appendChild(board);
    shell.appendChild(card);
    containerEl.appendChild(shell);

    modelReady.then(() => loadTasks()).catch((error) => {
        console.warn(`[Ikmal Tools] Kanban model could not load: ${error.message}`);
        loadTasks();
    });
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.notes-system-kanban-root')
            || document.body;
        if (container) {
            initNotesSystemKanban(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
