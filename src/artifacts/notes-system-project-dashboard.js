/* A compact, native-looking dashboard attached to each Ikmal Project Hub. */

(async function initProjectDashboard() {
    const isProjectHub = (note) => note && (
        note.hasLabel?.('extProjectHub')
        || note.hasLabel?.('extTemplate', 'projectHub')
        || note.hasLabel?.('noteType', 'projectHub')
    );
    let hub;
    let container;
    let context;

    // Trilium can invoke a render artifact before the active context's parent
    // branches have finished arriving in the frontend cache. A one-shot lookup
    // loses the dashboard until the user hard-refreshes the page, so retry the
    // bounded context discovery while the note is settling.
    for (let attempt = 0; attempt < 20 && !hub; attempt += 1) {
        try {
            if (typeof api !== 'undefined' && api.getActiveContextNote) {
                container = api.$container && (api.$container[0] || api.$container);
                context = api.getActiveContextNote();
                hub = isProjectHub(context) ? context : null;
                if (!hub && context) {
                    const directParents = await Promise.resolve(context.getParentNotes?.() || []);
                    hub = directParents.find((parent) => isProjectHub(parent));
                    if (!hub && context.getParentNoteIds && api.getNote) {
                        const parentIds = await Promise.resolve(context.getParentNoteIds());
                        const parents = await Promise.all((parentIds || []).map((parentId) => api.getNote(parentId)));
                        hub = parents.find((parent) => isProjectHub(parent));
                    }
                }
            }
        } catch {
            // The context is still being assembled; the next attempt can use
            // the now-populated frontend cache.
        }
        if (!hub) await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (!container || !hub) return;

    const isProjectHubContext = hub && (
        hub.hasLabel?.('extProjectHub')
        || hub.hasLabel?.('extTemplate', 'projectHub')
        || hub.hasLabel?.('noteType', 'projectHub')
    );
    if (!isProjectHubContext || container.querySelector('.ikmal-project-dashboard')) return;

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
    const labelValue = (note, name) => note?.getOwnedLabelValue?.(name)
        ?? note?.labels?.find?.((label) => label.name === name)?.value
        ?? '';
    const status = labelValue(hub, 'status') || 'active';
    const kind = labelValue(hub, 'kind') || 'project';
    const nextAction = labelValue(hub, 'nextAction') || 'Not set';
    const panel = document.createElement('section');
    panel.className = 'ikmal-project-dashboard card mb-3';
    panel.innerHTML = `
        <style>
            .ikmal-project-dashboard { max-width: 1120px; margin: 0 auto 1rem; container-type: inline-size; container-name: project-dashboard; }
            .ikmal-project-dashboard .ikmal-project-summary { background: var(--accented-background-color); border-radius: .55rem; padding: .7rem .9rem; }
            .ikmal-project-dashboard .ikmal-project-summary p { margin: .2rem 0; }
            .ikmal-project-dashboard .ikmal-project-actions { display: flex; flex-wrap: wrap; gap: .4rem; margin: .75rem 0 1rem; }
            .ikmal-project-dashboard .ikmal-project-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem; }
            .ikmal-project-dashboard .ikmal-project-section { min-width: 0; border: 1px solid var(--main-border-color); border-radius: .55rem; padding: .7rem .8rem; }
            .ikmal-project-dashboard .ikmal-project-section[hidden] { display: none; }
            .ikmal-project-dashboard .ikmal-project-section h3 { border-bottom: 1px solid var(--main-border-color); font-size: .95rem; letter-spacing: .03em; margin: 0 0 .5rem; padding-bottom: .3rem; }
            .ikmal-project-dashboard table { width: 100%; table-layout: fixed; }
            .ikmal-project-dashboard th, .ikmal-project-dashboard td { overflow-wrap: anywhere; vertical-align: top; }
            .ikmal-project-dashboard th:first-child, .ikmal-project-dashboard td:first-child { width: 55%; }
            .ikmal-project-dashboard .ikmal-rounds-table th:first-child, .ikmal-project-dashboard .ikmal-rounds-table td:first-child { width: 14%; }
            .ikmal-project-dashboard .ikmal-rounds-table th:nth-child(2), .ikmal-project-dashboard .ikmal-rounds-table td:nth-child(2) { width: 66%; }
            .ikmal-project-dashboard .ikmal-rounds-table th:nth-child(3), .ikmal-project-dashboard .ikmal-rounds-table td:nth-child(3) { width: 20%; }
            .ikmal-project-dashboard .ikmal-project-status { color: var(--muted-text-color); }
            .ikmal-project-dashboard .ikmal-project-status-badge { background: var(--accented-background-color); border: 1px solid var(--main-border-color); border-radius: 999px; display: inline-block; font-size: .8rem; line-height: 1.25; padding: .12rem .45rem; text-transform: capitalize; }
            .ikmal-project-dashboard .ikmal-project-date { white-space: nowrap; }
            .ikmal-project-dashboard .ikmal-project-date-overdue { color: var(--text-error); font-weight: 600; }
            .ikmal-project-dashboard .ikmal-project-date-today { color: var(--text-accent); font-weight: 600; }
            .ikmal-project-dashboard .ikmal-project-empty { color: var(--muted-text-color); margin: 0; }
            @media (max-width: 600px) {
                .ikmal-project-dashboard { margin-left: 0; margin-right: 0; }
                .ikmal-project-dashboard .ikmal-project-sections { grid-template-columns: 1fr; }
                .ikmal-project-dashboard .ikmal-project-actions button { flex: 1 1 10rem; }
                .ikmal-project-dashboard table { font-size: .9em; }
            }
            @container project-dashboard (max-width: 520px) {
                .ikmal-project-dashboard .ikmal-project-sections { grid-template-columns: 1fr; }
                .ikmal-project-dashboard .ikmal-project-actions button { flex: 1 1 10rem; }
            }
        </style>
        <div class="card-body">
            <div class="ikmal-project-summary mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <p class="m-0"><strong>Project status:</strong> <span data-project-status class="badge bg-primary text-white">${escapeHtml(status)}</span></p>
                    <small class="text-muted" data-project-task-completion>0% Tasks Completed</small>
                </div>
                <div class="progress mb-2" style="height: 6px; background-color: var(--main-border-color, rgba(128,128,128,0.2));">
                    <div class="progress-bar bg-success" data-project-task-progress-bar style="width: 0%; transition: width 0.3s ease;"></div>
                </div>
                <p class="m-0"><strong>Next action:</strong> ${escapeHtml(nextAction)}</p>
                <p class="ikmal-project-status m-0" data-project-current-round>Current round: loading…</p>
                <div class="d-flex align-items-center gap-1.5 mt-2 pt-2 border-top flex-wrap" data-project-timeline-nodes></div>
            </div>
            <div class="ikmal-project-actions" role="group" aria-label="Project actions">
                <button type="button" class="btn btn-outline-primary" data-project-action="task"><i class="bx bx-check-square"></i> New task</button>
                <button type="button" class="btn btn-outline-info" data-project-action="round"><i class="bx bx-edit-alt"></i> New round</button>
                <button type="button" class="btn btn-outline-secondary" data-project-action="export-summary"><i class="bx bx-printer"></i> Export summary</button>
                <button type="button" class="btn btn-outline-warning" data-project-action="archive"><i class="bx bx-archive"></i> Archive project</button>
                <button type="button" class="btn btn-outline-success" data-project-action="reopen"><i class="bx bx-folder-open"></i> Reopen project</button>
            </div>
            <div class="ikmal-project-sections">
                <section class="ikmal-project-section" data-project-section="rounds"><h3>Rounds</h3><div data-project-list="rounds"><p class="ikmal-project-empty">Loading…</p></div></section>
                <section class="ikmal-project-section" data-project-section="tasks"><h3>Open tasks</h3><div data-project-list="tasks"><p class="ikmal-project-empty">Loading…</p></div></section>
                <section class="ikmal-project-section" data-project-section="meetings"><h3>Meetings</h3><div data-project-list="meetings"><p class="ikmal-project-empty">Loading…</p></div></section>
                <section class="ikmal-project-section" data-project-section="communications"><h3>Communications</h3><div data-project-list="communications"><p class="ikmal-project-empty">Loading…</p></div></section>
                <section class="ikmal-project-section" data-project-section="followups"><h3>Awaiting replies & follow-ups</h3><div data-project-list="followups"><p class="ikmal-project-empty">Loading…</p></div></section>
            </div>
            <div class="ikmal-project-dashboard-status text-muted mt-2" aria-live="polite"></div>
        </div>`;
    container.prepend(panel);

    const statusLine = panel.querySelector('.ikmal-project-dashboard-status');
    const openNote = (noteId) => {
        if (api.openTabWithNote) api.openTabWithNote(noteId, true);
        else if (api.openNote) api.openNote(noteId);
    };
    const setAttribute = async (noteId, type, name, value) => {
        if (typeof api !== 'undefined' && typeof api.runOnBackend === 'function') {
            try {
                // The closure reports whether it wrote anything. Returning
                // unconditionally would silently drop any attribute type the
                // backend path does not handle -- the `project` relation on a
                // new task, for one, leaving it invisible to searchRelated().
                const applied = await api.runOnBackend((nId, aType, aName, aVal) => {
                    const note = api.getNote(nId);
                    if (!note) return false;
                    if (aType === 'label') {
                        note.setLabel(aName, aVal || '');
                        return true;
                    }
                    if (aType === 'relation' && aVal) {
                        note.setRelation(aName, aVal);
                        return true;
                    }
                    return false;
                }, [noteId, type, name, value || '']);
                if (applied) return;
            } catch {}
        }
        const glob = window.glob;
        if (!glob) throw new Error('Trilium session context is unavailable.');
        const headers = {
            'x-csrf-token': glob.csrfToken,
            'trilium-component-id': glob.componentId,
            'content-type': 'application/json',
        };
        const response = await fetch(`${glob.baseApiUrl}notes/${noteId}/set-attribute`, {
            method: 'PUT', credentials: 'same-origin', headers,
            body: JSON.stringify({ type, name, value, isInheritable: false }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    };
    const setLabel = (noteId, name, value) => setAttribute(noteId, 'label', name, value);
    const relationTarget = (note, name) => {
        const relation = note?.getRelations?.(name)?.[0]
            || note?.attributes?.find?.((attribute) => attribute.type === 'relation' && attribute.name === name);
        return relation?.targetNoteId || relation?.value || '';
    };
    const noteKind = (note) => {
        const marker = labelValue(note, 'noteType') || labelValue(note, 'extTemplate');
        if (note.hasLabel?.('extStoryDraft') || marker === 'storyDraft') return 'round';
        if (note.hasLabel?.('extTask') || marker === 'task' || marker === 'projectTask') return 'task';
        if (note.hasLabel?.('extMeeting') || marker === 'meeting') return 'meeting';
        if (note.hasLabel?.('extEmailDraft') || marker === 'emailDraft') return 'email';
        if (note.hasLabel?.('extReportingNotes') || marker === 'reportingNotes') return 'reporting';
        return '';
    };
    const isDone = (note) => Boolean(labelValue(note, 'doneDate'))
        || ['done', 'complete', 'completed'].includes(labelValue(note, 'status').toLowerCase());
    const noteDate = (note) => labelValue(note, 'startDate') || labelValue(note, 'followUpDate') || '';

    const searchRelated = async () => {
        if (typeof api.searchForNotes !== 'function') return [];
        const queries = ['#extTask', '#extMeeting', '#extStoryDraft', '#extEmailDraft', '#extReportingNotes'];
        const results = await Promise.all(queries.map((query) => api.searchForNotes(query).catch(() => [])));
        const unique = new Map();
        results.flat().forEach((note) => {
            if (note?.noteId && relationTarget(note, 'project') === hub.noteId) unique.set(note.noteId, note);
        });
        return [...unique.values()];
    };
    const makeLink = (note) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = note.title || 'Untitled note';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            openNote(note.noteId);
        });
        return link;
    };
    const makeStatus = (value) => {
        const cell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'ikmal-project-status-badge';
        badge.textContent = value || 'not set';
        cell.appendChild(badge);
        return cell;
    };
    const makeDate = (value) => {
        const cell = document.createElement('td');
        cell.className = 'ikmal-project-date';
        cell.textContent = value || '—';
        return cell;
    };
    const makeTable = (headers, rows, className = '') => {
        if (!rows.length) {
            const empty = document.createElement('p');
            empty.className = 'ikmal-project-empty';
            empty.textContent = 'None yet.';
            return empty;
        }
        const table = document.createElement('table');
        table.className = `table table-sm${className ? ` ${className}` : ''}`;
        const head = table.createTHead().insertRow();
        headers.forEach((header) => {
            const cell = document.createElement('th');
            cell.scope = 'col';
            cell.textContent = header;
            head.appendChild(cell);
        });
        const body = table.createTBody();
        rows.forEach((cells) => {
            const row = body.insertRow();
            cells.forEach((cell) => row.appendChild(cell instanceof Node ? cell : Object.assign(document.createElement('td'), { textContent: cell || '—' })));
        });
        return table;
    };
    const renderSection = (name, content, hasItems) => {
        const section = panel.querySelector(`[data-project-section="${name}"]`);
        const list = panel.querySelector(`[data-project-list="${name}"]`);
        section.hidden = !hasItems;
        if (hasItems) list.replaceChildren(content);
    };

    let dashboardLoadSequence = 0;
    const loadDashboard = async () => {
        const loadSequence = ++dashboardLoadSequence;
        const notes = await searchRelated();
        if (loadSequence !== dashboardLoadSequence) return;
        const rounds = notes.filter((note) => noteKind(note) === 'round')
            .sort((a, b) => Number(labelValue(a, 'round') || 0) - Number(labelValue(b, 'round') || 0));
        const allTasks = notes.filter((note) => noteKind(note) === 'task');
        const openTasks = allTasks.filter((note) => !isDone(note));
        const completedTasksCount = allTasks.length - openTasks.length;
        const completionPct = allTasks.length > 0 ? Math.round((completedTasksCount / allTasks.length) * 100) : 0;

        const completionText = panel.querySelector('[data-project-task-completion]');
        const progressBar = panel.querySelector('[data-project-task-progress-bar]');
        if (completionText) completionText.textContent = `${completedTasksCount}/${allTasks.length} Tasks Completed (${completionPct}%)`;
        if (progressBar) progressBar.style.width = `${completionPct}%`;

        const timelineContainer = panel.querySelector('[data-project-timeline-nodes]');
        if (timelineContainer) {
            timelineContainer.innerHTML = '';
            if (rounds.length === 0) {
                timelineContainer.innerHTML = '<span class="tiny text-muted">No draft rounds created yet.</span>';
            } else {
                rounds.forEach((rd, idx) => {
                    const rNum = labelValue(rd, 'round') || (idx + 1);
                    const rStatus = labelValue(rd, 'status') || 'open';
                    const nodeBtn = document.createElement('button');
                    nodeBtn.type = 'button';
                    nodeBtn.className = `btn btn-micro ${isDone(rd) ? 'btn-success' : 'btn-outline-primary'} d-inline-flex align-items-center gap-1`;
                    nodeBtn.style.borderRadius = '12px';
                    nodeBtn.innerHTML = `<i class="bx ${isDone(rd) ? 'bx-check-circle' : 'bx-layer'}"></i> Round ${rNum}`;
                    nodeBtn.title = `${rd.title} (${rStatus})`;
                    nodeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        openNote(rd.noteId);
                    });
                    timelineContainer.appendChild(nodeBtn);

                    if (idx < rounds.length - 1) {
                        const arrow = document.createElement('span');
                        arrow.className = 'tiny text-muted me-1 ms-1';
                        arrow.innerHTML = '&rarr;';
                        timelineContainer.appendChild(arrow);
                    }
                });
            }
        }
        const meetings = notes.filter((note) => noteKind(note) === 'meeting')
            .sort((a, b) => noteDate(a).localeCompare(noteDate(b)));
        const communications = notes.filter((note) => ['email', 'reporting'].includes(noteKind(note)));
        const followups = notes.filter((note) => labelValue(note, 'status') === 'awaiting'
            || (labelValue(note, 'followUpDate') && !isDone(note)));
        
        const currentRound = rounds.length ? rounds[rounds.length - 1] : null;
        panel.querySelector('[data-project-current-round]').textContent = currentRound
            ? `Current round: ${labelValue(currentRound, 'round') || '—'} — ${currentRound.title}`
            : 'Current round: none yet.';

        const timelineEl = panel.querySelector('[data-project-timeline-nodes]');
        if (timelineEl) {
            timelineEl.innerHTML = '';
            if (rounds.length > 0) {
                const label = document.createElement('span');
                label.className = 'tiny text-muted me-1 font-weight-bold';
                label.textContent = 'Round Stepper:';
                timelineEl.appendChild(label);
                rounds.forEach((rnd, idx) => {
                    const rndNum = labelValue(rnd, 'round') || String(idx + 1);
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `btn btn-micro ${idx === rounds.length - 1 ? 'btn-primary' : 'btn-outline-secondary'}`;
                    btn.innerHTML = `<i class="bx bx-file"></i> Draft ${escapeHtml(rndNum)}`;
                    btn.title = `${rnd.title} (${labelValue(rnd, 'status') || 'drafting'})`;
                    btn.addEventListener('click', () => openNote(rnd.noteId));
                    timelineEl.appendChild(btn);
                    if (idx < rounds.length - 1) {
                        const arrow = document.createElement('span');
                        arrow.className = 'tiny text-muted';
                        arrow.innerHTML = '&rarr;';
                        timelineEl.appendChild(arrow);
                    }
                });
            }
        }

        renderSection('rounds', makeTable(['Round', 'Story', 'Status'], [...rounds].reverse().map((note) => [
            labelValue(note, 'round'), makeLink(note), makeStatus(labelValue(note, 'status')),
        ]), 'ikmal-rounds-table'), rounds.length > 0);
        renderSection('tasks', makeTable(['Task', 'Status'], openTasks.map((note) => [
            makeLink(note), makeStatus(labelValue(note, 'status')),
        ])), openTasks.length > 0);
        renderSection('meetings', makeTable(['Meeting', 'Starts'], meetings.map((note) => [
            makeLink(note), makeDate(noteDate(note)),
        ])), meetings.length > 0);
        renderSection('communications', makeTable(['Note', 'Status'], communications.map((note) => [
            makeLink(note), makeStatus(labelValue(note, 'status')),
        ])), communications.length > 0);
        renderSection('followups', makeTable(['Note', 'Status / follow-up'], followups.map((note) => [
            makeLink(note), `${labelValue(note, 'status') || 'open'}${labelValue(note, 'followUpDate') ? ` · ${labelValue(note, 'followUpDate')}` : ''}`,
        ])), followups.length > 0);
    };

    panel.querySelector('[data-project-action="task"]').addEventListener('click', async () => {
        try {
            const result = await api.createNote(hub.noteId, {
                title: 'New project task', content: '<p>Task details...</p>', type: 'text', activate: true,
            });
            if (!result.note) throw new Error('Trilium did not return the task.');
            await setLabel(result.note.noteId, 'extTask', '');
            await setLabel(result.note.noteId, 'status', 'todo');
            await setAttribute(result.note.noteId, 'relation', 'project', hub.noteId);
            statusLine.textContent = 'New task created.';
            await loadDashboard();
        } catch (error) {
            statusLine.textContent = `Could not create task: ${error.message}`;
        }
    });

    panel.querySelector('[data-project-action="round"]')?.addEventListener('click', () => {
        if (window.__ikmalQuickCapture) {
            Promise.resolve(window.__ikmalQuickCapture(
                kind === 'edit' ? 'edit' : 'story',
                { project: hub.noteId },
                () => loadDashboard(),
            )).catch((error) => {
                statusLine.textContent = `Could not open new round: ${error.message || error}`;
            });
        } else {
            statusLine.textContent = 'Quick Capture modal is unavailable.';
        }
    });

    panel.querySelector('[data-project-action="export-summary"]')?.addEventListener('click', async () => {
        const title = hub.title || 'Project Summary';
        const currentRoundStr = panel.querySelector('[data-project-current-round]')?.textContent || '';
        const taskCompStr = panel.querySelector('[data-project-task-completion]')?.textContent || '';
        const markdownBrief = `# ${title}\n- Status: ${status}\n- ${currentRoundStr}\n- Completion: ${taskCompStr}\n- Next Action: ${nextAction}\n`;

        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(markdownBrief);
                if (window.__ikmalToast) window.__ikmalToast('Copied Markdown Brief to clipboard!', 'success');
            } catch (e) {}
        }

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${escapeHtml(title)} - Printable Executive Report</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; color: #111; max-width: 800px; margin: 0 auto; line-height: 1.5; }
                        h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; margin-bottom: 1rem; }
                        .meta-box { background: #f5f5f7; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
                        .meta-box p { margin: 0.25rem 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                        th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
                        th { background: #eee; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <h1>${escapeHtml(title)}</h1>
                    <div class="meta-box">
                        <p><strong>Status:</strong> ${escapeHtml(status)}</p>
                        <p><strong>Next Action:</strong> ${escapeHtml(nextAction)}</p>
                        <p><strong>Current Round:</strong> ${escapeHtml(currentRoundStr)}</p>
                        <p><strong>Task Progress:</strong> ${escapeHtml(taskCompStr)}</p>
                    </div>
                    <h2>Rounds & Draft Timeline</h2>
                    <div>${panel.querySelector('[data-project-list="rounds"]')?.innerHTML || 'None'}</div>
                    <h2>Open Tasks</h2>
                    <div>${panel.querySelector('[data-project-list="tasks"]')?.innerHTML || 'None'}</div>
                    <script>window.onload = () => window.print();</script>
                </body>
                </html>
            `);
            win.document.close();
        }
    });

    panel.querySelector('[data-project-action="archive"]')?.addEventListener('click', async () => {
        const previousStatus = labelValue(hub, 'status') || 'active';
        const previousDoneDate = labelValue(hub, 'doneDate') || '';
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let archived = false;
        try {
            if (typeof api !== 'undefined' && typeof api.runOnBackend === 'function') {
                await api.runOnBackend((hubId, todayDate) => {
                    const hubNote = api.getNote(hubId);
                    const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
                    const activeRoot = api.getNoteWithLabel('activeProjectRoot');
                    if (!hubNote || !archiveRoot) throw new Error('Archive root folder (#archiveProjectRoot) is not available.');
                    hubNote.setLabel('status', 'complete');
                    hubNote.setLabel('doneDate', todayDate);
                    api.ensureNoteIsPresentInParent(hubId, archiveRoot.noteId, '');
                    if (activeRoot) api.ensureNoteIsAbsentFromParent(hubId, activeRoot.noteId);
                }, [hub.noteId, today]);
            } else {
                const archiveRoot = (await api.searchForNotes('#archiveProjectRoot'))?.[0];
                const activeRoot = (await api.searchForNotes('#activeProjectRoot'))?.[0];
                if (!archiveRoot?.noteId) throw new Error('Archive root folder (#archiveProjectRoot) is not available.');
                const glob = window.glob;
                if (!glob) throw new Error('Trilium session context is unavailable.');

                const toggleInParent = async (parentNoteId, present) => {
                    const response = await fetch(`${glob.baseApiUrl}notes/${hub.noteId}/toggle-in-parent/${parentNoteId}/${present}`, {
                        method: 'PUT', credentials: 'same-origin',
                        headers: { 'x-csrf-token': glob.csrfToken, 'trilium-component-id': glob.componentId, 'content-type': 'application/json' },
                        body: JSON.stringify({}),
                    });
                    if (!response.ok) {
                        throw new Error(`Could not ${present ? 'add' : 'remove'} project branch (HTTP ${response.status}).`);
                    }
                    const result = await response.json().catch(() => null);
                    if (result?.success === false) {
                        throw new Error(`Trilium refused to ${present ? 'add' : 'remove'} the project branch.`);
                    }
                };

                await toggleInParent(archiveRoot.noteId, true);
                if (activeRoot?.noteId) {
                    await toggleInParent(activeRoot.noteId, false);
                }
                await setLabel(hub.noteId, 'status', 'complete');
                await setLabel(hub.noteId, 'doneDate', today);
            }
            archived = true;
            statusLine.textContent = 'Project archived successfully.';
            panel.querySelector('[data-project-status]').textContent = 'complete';
        } catch (error) {
            // Atomic rollback. Only the move itself is covered: once the hub is
            // filed under Archive, rolling `status` back would leave the label
            // contradicting the note's real parent, so the refresh below stays
            // outside the try.
            try {
                await setLabel(hub.noteId, 'status', previousStatus);
                await setLabel(hub.noteId, 'doneDate', previousDoneDate);
            } catch {}
            statusLine.textContent = `Could not archive project: ${error.message}`;
        }
        if (archived) {
            await loadDashboard().catch((error) => {
                statusLine.textContent = `Project archived, but the view could not refresh: ${error.message}`;
            });
        }
    });

    panel.querySelector('[data-project-action="reopen"]')?.addEventListener('click', async () => {
        const previousStatus = labelValue(hub, 'status') || 'complete';
        let reopened = false;
        try {
            if (typeof api !== 'undefined' && typeof api.runOnBackend === 'function') {
                await api.runOnBackend((hubId) => {
                    const hubNote = api.getNote(hubId);
                    const activeRoot = api.getNoteWithLabel('activeProjectRoot');
                    const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
                    if (!hubNote || !activeRoot) throw new Error('Active root folder (#activeProjectRoot) is not available.');
                    hubNote.setLabel('status', 'active');
                    api.ensureNoteIsPresentInParent(hubId, activeRoot.noteId, '');
                    if (archiveRoot) api.ensureNoteIsAbsentFromParent(hubId, archiveRoot.noteId);
                }, [hub.noteId]);
            } else {
                const activeRoot = (await api.searchForNotes('#activeProjectRoot'))?.[0];
                const archiveRoot = (await api.searchForNotes('#archiveProjectRoot'))?.[0];
                if (!activeRoot?.noteId) throw new Error('Active root folder (#activeProjectRoot) is not available.');
                const glob = window.glob;
                if (!glob) throw new Error('Trilium session context is unavailable.');

                const toggleInParent = async (parentNoteId, present) => {
                    const response = await fetch(`${glob.baseApiUrl}notes/${hub.noteId}/toggle-in-parent/${parentNoteId}/${present}`, {
                        method: 'PUT', credentials: 'same-origin',
                        headers: { 'x-csrf-token': glob.csrfToken, 'trilium-component-id': glob.componentId, 'content-type': 'application/json' },
                        body: JSON.stringify({}),
                    });
                    if (!response.ok) {
                        throw new Error(`Could not ${present ? 'add' : 'remove'} project branch (HTTP ${response.status}).`);
                    }
                    const result = await response.json().catch(() => null);
                    if (result?.success === false) {
                        throw new Error(`Trilium refused to ${present ? 'add' : 'remove'} the project branch.`);
                    }
                };

                await toggleInParent(activeRoot.noteId, true);
                if (archiveRoot?.noteId) {
                    await toggleInParent(archiveRoot.noteId, false);
                }
                await setLabel(hub.noteId, 'status', 'active');
            }
            reopened = true;
            statusLine.textContent = 'Project reopened and set active.';
            panel.querySelector('[data-project-status]').textContent = 'active';
        } catch (error) {
            // Atomic rollback, covering the move only -- see the archive handler.
            try { await setLabel(hub.noteId, 'status', previousStatus); } catch {}
            statusLine.textContent = `Could not reopen project: ${error.message}`;
        }
        if (reopened) {
            await loadDashboard().catch((error) => {
                statusLine.textContent = `Project reopened, but the view could not refresh: ${error.message}`;
            });
        }
    });

    loadDashboard().catch((error) => {
        statusLine.textContent = `Project activity unavailable: ${error.message}`;
    });
})();
