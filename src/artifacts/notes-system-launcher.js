/**
 * Notes System Launcher Bar script.
 * Registers the legacy Ikmal creation actions and keyboard shortcut
 * (Cmd/Ctrl+Shift+K) and the Cmd/Ctrl+? help shortcut into Trilium, allowing instant note creation from
 * anywhere in Trilium. The native launchbar can be vertical and icon-only,
 * so every action keeps an explicit title and accessible label even when its
 * text is hidden.
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { NoteCreationEngine } from '../engine/noteCreationEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { showQuickCaptureModal } from '../components/QuickCaptureModal.js';
import { openModal } from '../components/nativeUi.js';

(function initLauncherBar() {
    if (typeof document === 'undefined') return;

    const LAUNCHER_ACTIONS = [
        { id: 'newProjectHub', type: 'projectHub', label: 'New Project Hub', icon: 'book', shortcut: '' },
        { id: 'newScratch', type: 'scratch', label: 'New Scratch', icon: 'file-blank', shortcut: '' },
        { id: 'newMeeting', type: 'meeting', label: 'New Meeting', icon: 'calendar-event', shortcut: 'alt+m' },
        { id: 'newTask', type: 'task', label: 'New Task', icon: 'check-square', shortcut: 'alt+t' },
        { id: 'newStory', type: 'story', label: 'New Story', icon: 'news', shortcut: 'alt+s' },
        { id: 'newEdit', type: 'edit', label: 'New Edit', icon: 'edit-alt', shortcut: '' },
        { id: 'newEmail', type: 'email', label: 'New Email', icon: 'envelope', shortcut: '' },
        { id: 'newPerson', type: 'person', label: 'New Person', icon: 'user', shortcut: '' },
        { id: 'newOrganization', type: 'organization', label: 'New Organization', icon: 'buildings', shortcut: '' },
        { id: 'newTopic', type: 'topic', label: 'New Topic', icon: 'purchase-tag', shortcut: '' },
    ];

    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const settingsEngine = new SettingsEngine();
    const noteCreationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine);

    function triggerQuickCapture(templateId, initialRelations) {
        const targetTpl = templateId || settingsEngine.get('defaultQuickCaptureTemplate') || 'task';
        showQuickCaptureModal(targetTpl, templateEngine, noteCreationEngine, undefined, initialRelations)
            .catch((error) => {
                if (typeof api !== 'undefined' && api.showError) {
                    api.showError(`Could not open quick capture: ${error.message || error}`);
                }
            });
    }

    // Native script launchers execute a small copy of this source in the
    // launcher note. Keep the action bridge global so those notes can call the
    // same fully bundled Quick Capture modal without creating a second bundle.
    window.__ikmalQuickCapture = triggerQuickCapture;
    if (typeof api !== 'undefined' && api.currentNote?.hasLabel?.('extLauncherType')) {
        const type = api.currentNote.getOwnedLabelValue('extLauncherType');
        if (type) triggerQuickCapture(type);
        return;
    }

    // Register global keyboard shortcuts (Cmd/Ctrl+Shift+K, Alt+M, Alt+T, Alt+S, Cmd/Ctrl+?).
    if (!window.__ns_keyboard_shortcut_registered) {
        window.__ns_keyboard_shortcut_registered = true;
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
                e.preventDefault();
                e.stopPropagation();
                triggerQuickCapture();
            } else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                const k = e.key.toLowerCase();
                if (k === 'm') {
                    e.preventDefault(); e.stopPropagation();
                    triggerQuickCapture('meeting');
                } else if (k === 't') {
                    e.preventDefault(); e.stopPropagation();
                    triggerQuickCapture('task');
                } else if (k === 's') {
                    e.preventDefault(); e.stopPropagation();
                    triggerQuickCapture('story');
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === '?' && !e.isComposing) {
                e.preventDefault();
                const hotkeyModal = openModal({
                    title: 'Keyboard Shortcuts & Quick Actions',
                    icon: 'bx-keyboard',
                    body: `
                        <div class="mb-2">
                            <input type="text" id="hotkey-search-input" class="form-control form-control-sm" placeholder="Search shortcuts…">
                        </div>
                        <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
                            <table class="table table-sm text-start m-0" id="hotkeys-table">
                                <thead><tr><th>Shortcut</th><th>Action</th></tr></thead>
                                <tbody>
                                    <tr data-action="quick capture palette command"><td><code>Cmd / Ctrl + Shift + K</code></td><td>Open Quick Capture Command Palette</td></tr>
                                    <tr data-action="quick capture task"><td><code>Alt + T</code></td><td>Quick Capture Task</td></tr>
                                    <tr data-action="quick capture story project"><td><code>Alt + S</code></td><td>Quick Capture Story Project</td></tr>
                                    <tr data-action="quick capture meeting"><td><code>Alt + M</code></td><td>Quick Capture Meeting</td></tr>
                                    <tr data-action="show hotkey cheatsheet help"><td><code>Cmd / Ctrl + ?</code></td><td>Show Hotkey Cheatsheet</td></tr>
                                    <tr data-action="close active dialog modal cancel"><td><code>Esc</code></td><td>Close Active Dialog / Modal</td></tr>
                                </tbody>
                            </table>
                        </div>
                    `,
                    confirmText: 'Got It',
                }, () => true);

                setTimeout(() => {
                    // This artifact is JavaScript (not TypeScript); keeping the
                    // selectors unparameterized prevents esbuild from emitting
                    // the generic syntax as runtime comparison operators.
                    const searchInput = hotkeyModal.querySelector('#hotkey-search-input');
                    const rows = hotkeyModal.querySelectorAll('#hotkeys-table tbody tr');
                    searchInput?.focus();
                    searchInput?.addEventListener('input', () => {
                        const q = searchInput.value.toLowerCase().trim();
                        rows.forEach((row) => {
                            const text = (row.dataset.action || '') + ' ' + row.textContent?.toLowerCase();
                            row.style.display = text.includes(q) ? '' : 'none';
                        });
                    });
                }, 50);
            }
        }, true);
        window.__ikmalShortcuts = {
            trigger: triggerQuickCapture,
            list: LAUNCHER_ACTIONS,
        };
        console.log('[Notes System Plugin] Global keyboard shortcuts registered (Cmd/Ctrl+Shift+K, Alt+M/T/S, Cmd/Ctrl+?).');
    }

    // In-editor Reporting Notes Action Bar Renderer
    function initReportingNoteActionBars() {
        const placeholders = document.querySelectorAll('.reporting-note-actions-placeholder[data-reporting-note-actions="true"]');
        placeholders.forEach((placeholder) => {
            if (placeholder.dataset.initialized === 'true') return;
            placeholder.dataset.initialized = 'true';
            placeholder.className = 'ikmal-reporting-actions-bar';
            placeholder.style.cssText = 'display:flex;gap:0.5rem;margin:1rem 0;padding:0.75rem;background:var(--main-background-color);border:1px solid var(--main-border-color);border-radius:6px;';

            const actions = [
                { label: 'Add Round / Edit', icon: 'bx-edit-alt', type: 'edit' },
                { label: 'Log Meeting', icon: 'bx-calendar-event', type: 'meeting' },
                { label: 'Add Task', icon: 'bx-check-square', type: 'task' },
            ];

            actions.forEach((act) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-sm btn-secondary';
                btn.style.cssText = 'display:inline-flex;align-items:center;gap:0.35rem;cursor:pointer;';
                btn.innerHTML = `<i class="bx ${act.icon}"></i> ${act.label}`;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    let initialRelations;
                    if (typeof api !== 'undefined' && api.currentNote) {
                        const projRel = api.currentNote.getRelations?.('project')?.[0];
                        if (projRel?.value) {
                            initialRelations = { project: projRel.value };
                        }
                    }
                    triggerQuickCapture(act.type, initialRelations);
                });
                placeholder.appendChild(btn);
            });
        });
    }

    // In-editor Story Draft Actions Bar & Breadcrumb Navigation Renderer
    function initStoryDraftEditorUI() {
        if (typeof api === 'undefined' || !api.currentNote) return;
        const current = api.currentNote;
        const isDraft = current.hasLabel?.('extStoryDraft') || current.hasLabel?.('extTemplate', 'storyDraft');
        if (!isDraft) return;

        const jqueryContainer = api.$container;
        const container = jqueryContainer && (jqueryContainer[0] || jqueryContainer);
        if (!container || typeof container.querySelector !== 'function') return;
        if (container.querySelector('.extension-round-actions')) return;

        api.runOnBackend((noteId) => {
            const round = api.getNote(noteId);
            const hubRel = round.getRelations('project')[0];
            const hub = hubRel ? api.getNote(hubRel.value) : null;
            if (!hub) return null;
            const rounds = hub.getTargetRelations()
                .filter((r) => r.type === 'relation' && r.name === 'project')
                .map((r) => api.getNote(r.noteId))
                .filter((candidate) => candidate.hasLabel('extStoryDraft') || candidate.hasLabel('extTemplate', 'storyDraft'))
                .map((candidate) => Number(candidate.getLabelValue('round')))
                .filter((num) => Number.isFinite(num));
            const nextRound = rounds.length ? Math.max(...rounds) + 1 : 1;
            const hubKind = hub.getLabelValue('kind') || 'project';
            const suffix = hubKind === 'edit' ? `Round ${nextRound}` : `Draft ${nextRound}`;
            const baseTitle = hub.title.replace(/\s+[—-]\s+(?:Round|Draft)\s+\d+\s*$/i, '').trim();
            const hubArea = hub.getParentNotes().some((parent) => parent.hasLabel('projectArchive')) ? 'archive' : 'active';
            const projectRoot = api.getNoteWithLabel('projectRoot');
            const dashboard = hub.getChildNotes().find((child) => child.hasLabel('extHubDashboard', 'projectHub') || child.hasLabel('extProjectDashboard', 'projectHub'));

            return {
                hubId: hub.noteId,
                hubTitle: hub.title,
                projectRootId: projectRoot ? projectRoot.noteId : null,
                hubDashboardId: dashboard ? dashboard.noteId : null,
                hubKind,
                hubArea,
                defaultTitle: `${baseTitle} — ${suffix}`,
                roundTitle: round.title,
            };
        }, [current.noteId]).then((context) => {
            if (!context) return;

            const nav = document.createElement('nav');
            nav.className = 'extension-project-breadcrumbs small text-muted mb-2 d-flex align-items-center gap-1.5';
            nav.innerHTML = `
                <i class="bx bx-folder"></i>
                <a href="#" class="text-reset text-decoration-none nav-proj-root">Projects</a> /
                <a href="#" class="text-reset text-decoration-none font-weight-bold nav-hub-link">${context.hubTitle}</a> /
                <span class="text-body">${context.roundTitle}</span>
            `;
            nav.querySelector('.nav-proj-root')?.addEventListener('click', (e) => {
                e.preventDefault();
                if (context.projectRootId && api.activateNote) api.activateNote(context.projectRootId);
            });
            nav.querySelector('.nav-hub-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                if (api.activateNote) api.activateNote(context.hubId);
            });

            const bar = document.createElement('div');
            bar.className = 'extension-round-actions alert alert-secondary p-2.5 mb-3 d-flex align-items-center flex-wrap gap-2';
            bar.innerHTML = `<strong class="me-2 tiny text-uppercase text-muted"><i class="bx bx-layer"></i> Round Actions:</strong>`;

            const btn = (title, icon, className, tooltip, handler) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `btn btn-sm ${className} d-inline-flex align-items-center gap-1`;
                b.title = tooltip || title;
                b.setAttribute('aria-label', tooltip || title);
                b.innerHTML = `<i class="bx ${icon}"></i> ${title}`;
                b.addEventListener('click', handler);
                bar.appendChild(b);
            };

            btn('New Round', 'bx-plus-circle', 'btn-primary', 'Create next iteration draft or edit round under this Project Hub', () => {
                openModal({
                    title: 'Create New Round / Draft',
                    icon: 'bx-plus-circle',
                    body: `
                        <div class="mb-3">
                            <label class="form-label small font-weight-bold">Round Title</label>
                            <input type="text" class="form-control form-control-sm new-round-title-input" value="${context.defaultTitle.replace(/"/g, '&quot;')}">
                        </div>
                    `,
                    confirmText: 'Create Round',
                }, (modalEl) => {
                    const input = modalEl.querySelector('.new-round-title-input');
                    const title = input ? input.value.trim() : '';
                    if (!title) return false;
                    const plan = noteCreationEngine.planNoteCreation({
                        type: 'story',
                        title,
                        relations: { project: context.hubId },
                        mode: context.hubKind === 'edit' ? 'edit' : 'project',
                    });
                    materializeNoteCreation(plan).then((res) => {
                        if (res?.noteId && api.activateNote) api.activateNote(res.noteId);
                    });
                    return true;
                });
            });

            btn('Mark Awaiting Reply', 'bx-time-five', 'btn-outline-secondary', 'Set waitingOn and followUpDate attributes on current note', () => {
                const dateStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
                openModal({
                    title: 'Mark Awaiting Reply',
                    icon: 'bx-time-five',
                    body: `
                        <div class="mb-3">
                            <label class="form-label small font-weight-bold">Waiting On (Person / Organization)</label>
                            <input type="text" class="form-control form-control-sm waiting-on-input" placeholder="e.g. Jane Doe / Acme Corp">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small font-weight-bold">Follow-Up Date</label>
                            <input type="date" class="form-control form-control-sm follow-up-date-input" value="${dateStr}">
                        </div>
                    `,
                    confirmText: 'Set Awaiting Details',
                }, (modalEl) => {
                    const wOnInput = modalEl.querySelector('.waiting-on-input');
                    const fDateInput = modalEl.querySelector('.follow-up-date-input');
                    const wOn = wOnInput ? wOnInput.value.trim() : '';
                    const fDate = fDateInput ? fDateInput.value.trim() : '';
                    if (!wOn || !fDate) return false;
                    api.runOnBackend((noteId, waitingOn, followUpDate) => {
                        const n = api.getNote(noteId);
                        if (n) {
                            n.setLabel('waitingOn', waitingOn);
                            n.setLabel('followUpDate', followUpDate);
                        }
                    }, [current.noteId, wOn, fDate]).then(() => {
                        if (api.showMessage) api.showMessage('Set Awaiting Reply details.');
                    });
                    return true;
                });
            });

            btn('Mark Project Complete', 'bx-check-double', 'btn-outline-success', 'Mark project status complete and move to Archive Projects', () => {
                openModal({
                    title: 'Mark Project Complete',
                    icon: 'bx-check-double',
                    body: `<p class="m-0">Are you sure you want to mark <strong>${context.hubTitle.replace(/</g, '&lt;')}</strong> as complete and archive it?</p>`,
                    confirmText: 'Mark Complete & Archive',
                    confirmKind: 'primary',
                }, () => {
                    api.runOnBackend((hubId) => {
                        const hubNote = api.getNote(hubId);
                        const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
                        if (hubNote) {
                            hubNote.setLabel('status', 'complete');
                            if (archiveRoot) api.ensureNoteIsPresentInParent(hubId, archiveRoot.noteId, '');
                        }
                    }, [context.hubId]).then(() => {
                        if (api.showMessage) api.showMessage(`Project "${context.hubTitle}" marked complete.`);
                    });
                    return true;
                });
            });

            if (context.hubArea === 'active') {
                btn('Archive Project', 'bx-archive-in', 'btn-outline-warning', 'Move project to Archive Projects root folder', () => {
                    openModal({
                        title: 'Archive Project',
                        icon: 'bx-archive-in',
                        body: `<p class="m-0">Move <strong>${context.hubTitle.replace(/</g, '&lt;')}</strong> to Archive Projects?</p>`,
                        confirmText: 'Archive Project',
                    }, () => {
                        api.runOnBackend((hubId) => {
                            const hubNote = api.getNote(hubId);
                            const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
                            const activeRoot = api.getNoteWithLabel('activeProjectRoot');
                            if (hubNote && archiveRoot) {
                                api.ensureNoteIsPresentInParent(hubId, archiveRoot.noteId, '');
                                if (activeRoot) api.ensureNoteIsAbsentFromParent(hubId, activeRoot.noteId);
                            }
                        }, [context.hubId]).then(() => {
                            if (api.showMessage) api.showMessage(`Project archived.`);
                        });
                        return true;
                    });
                });
            } else {
                btn('Reopen Project', 'bx-archive-out', 'btn-outline-info', 'Reopen project and move back to Active Projects root folder', () => {
                    api.runOnBackend((hubId) => {
                        const hubNote = api.getNote(hubId);
                        const activeRoot = api.getNoteWithLabel('activeProjectRoot');
                        const archiveRoot = api.getNoteWithLabel('archiveProjectRoot');
                        if (hubNote && activeRoot) {
                            hubNote.setLabel('status', 'active');
                            api.ensureNoteIsPresentInParent(hubId, activeRoot.noteId, '');
                            if (archiveRoot) api.ensureNoteIsAbsentFromParent(hubId, archiveRoot.noteId);
                        }
                    }, [context.hubId]).then(() => {
                        if (api.showMessage) api.showMessage(`Project reopened.`);
                    });
                });
            }

            container.prepend(bar);
            container.prepend(nav);
        });
    }

    // Render editor affordances for the current note and after Trilium replaces
    // the note-detail DOM during navigation. Startup scripts run before the
    // first note detail exists, so a one-shot call is insufficient. Trilium's
    // public frontend API does not expose a global event listener; observing
    // child-list replacement gives the same lifecycle signal without keeping
    // a timer awake forever.
    if (typeof window !== 'undefined') {
        const renderEditorAffordances = () => {
            initReportingNoteActionBars();
            initStoryDraftEditorUI();
        };
        renderEditorAffordances();
        if (typeof MutationObserver !== 'undefined' && !window.__ikmal_editor_affordance_observer) {
            let renderQueued = false;
            const scheduleRender = () => {
                if (renderQueued) return;
                renderQueued = true;
                window.setTimeout(() => {
                    renderQueued = false;
                    renderEditorAffordances();
                }, 0);
            };
            const observeRoot = document.body || document.documentElement;
            if (observeRoot) {
                const observer = new MutationObserver((mutations) => {
                    if (mutations.some((mutation) => mutation.type === 'childList'
                        && (mutation.addedNodes.length || mutation.removedNodes.length))) {
                        scheduleRender();
                    }
                });
                observer.observe(observeRoot, { childList: true, subtree: true });
                window.__ikmal_editor_affordance_observer = observer;
            }
        }
    }

    // Trilium's native launcher configuration owns these buttons. This keeps
    // them visible in Configure Launchbar, lets users reorder/hide them, and
    // gives their icons the current theme's normal launcher color.
    const launcherScriptFor = (type) => `(() => {
        const type = ${JSON.stringify(type)};
        (async () => {
            if (window.__ikmalQuickCapture) {
                await window.__ikmalQuickCapture(type);
                return;
            }

            // Native launchers can execute in a context which does not share
            // the startup artifact's window. Keep creation usable there by
            // dispatching straight to the backend note-creation handler.
            if (!api.showPromptDialog || !api.runOnBackend) {
                throw new Error('Quick capture is not ready. Reload the frontend.');
            }

            const title = await api.showPromptDialog({
                title: type === 'edit' ? 'New Edit Package' : ('New ' + type),
                message: 'Title',
                defaultValue: '',
            });
            if (!title || !title.trim()) return;

            let body = { type, title: title.trim() };
            if (type === 'story' || type === 'edit') {
                body = { action: 'startStory', title: title.trim(), mode: type === 'edit' ? 'edit' : 'project' };
            }

            // Preferred path. The backend artifact registers its dispatcher in
            // process, so creation never leaves the server. Reaching the HTTP
            // handler instead would mean pulling the shared #createNoteSecret
            // into page JS, where any other script in this window can read it.
            let payload = null;
            try {
                payload = await api.runOnBackend((requestBody) => {
                    const dispatch = globalThis.__ikmalCreateNote;
                    return typeof dispatch === 'function' ? dispatch(requestBody) : null;
                }, [body]);
            } catch {
                payload = null;
            }

            if (!payload) {
                // An older backend artifact is still deployed. Fall back to the
                // HTTP handler, deriving its URL from baseApiUrl -- a hardcoded
                // '/custom/create-note' 404s behind a sub-path reverse proxy.
                const secret = await api.runOnBackend(() => {
                    const config = api.getNoteWithLabel('extConfig');
                    return config?.getOwnedLabelValue('createNoteSecret') || null;
                });
                if (!secret) throw new Error('Note creation is not configured. Run workspace repair.');

                // baseApiUrl is relative and ends in 'api/' ('api/' on a root
                // install, '/trilium/api/' when proxied under a sub-path). The
                // custom route is its sibling, so swapping the last segment
                // keeps both shapes correct; a leading-slash path would 404
                // behind a sub-path proxy, and 'api/custom/...' 404s everywhere.
                let base = (window.glob && window.glob.baseApiUrl) || 'api/';
                if (!base.endsWith('/')) base = base + '/';
                const root = base.endsWith('api/') ? base.slice(0, -4) : base;

                const response = await fetch(root + 'custom/create-note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-extension-secret': secret },
                    credentials: 'same-origin',
                    body: JSON.stringify(body),
                });
                payload = await response.json();
                if (!response.ok) throw new Error(payload.error || ('request failed (' + response.status + ')'));
            }
            if (payload.error) throw new Error(payload.error);
            await api.waitUntilSynced?.();
            if (payload.noteId && api.activateNewNote) await api.activateNewNote(payload.noteId);
        })().catch((error) => {
            if (api.showError) api.showError('Could not create note: ' + (error.message || error));
        });
    })();`;
    if (typeof api !== 'undefined' && typeof api.runOnBackend === 'function' && api.currentNote?.noteId) {
        api.runOnBackend((launchers, scriptNoteId) => {
            // This startup script must be strictly idempotent. Older versions
            // recursively deleted launchers by title before recreating them;
            // on some databases that also matched the stable `al_*` notes and
            // caused a delete/create feedback loop during frontend startup.
            // Leave legacy launchers alone here. A cleanup can be explicit and
            // user-invoked later, but startup should only upsert our own IDs.
            for (const launcher of launchers) {
                let isVisible = true;
                try {
                    const existingLauncher = api.getNote(`al_${launcher.id}`);
                    isVisible = existingLauncher.getParentBranches()
                        .some((branch) => branch.parentNoteId === '_lbVisibleLaunchers');
                } catch (error) {
                    // A first install has no native launcher note yet, so use
                    // the package default and place the new action visibly.
                }
                const result = api.createOrUpdateLauncher({
                    id: launcher.id,
                    title: launcher.label,
                    icon: launcher.icon,
                    keyboardShortcut: launcher.shortcut || '',
                    isVisible,
                    type: 'script',
                    scriptNoteId,
                    targetNoteId: 'root',
                });
                const note = result?.note;
                if (!note) continue;
                note.setRelation('script', scriptNoteId);
                note.setLabel('extLauncherType', launcher.type);
                note.setLabel('extLauncherLabel', launcher.label);
                note.setContent(launcher.script);
                note.setLabel('scriptInLauncherContent');
                note.mime = 'application/javascript;env=frontend';
                note.setLabel('iconClass', `bx bx-${launcher.icon}`);
                note.save();
            }

            try {
                const root = api.getNote('_lbVisibleLaunchers');
                if (root) {
                    const extensionIds = launchers.map((l) => `al_${l.id}`);
                    const extensionSet = new Set(extensionIds);
                    const branches = [];
                    for (const childId of root.getChildNoteIds()) {
                        const note = api.getNote(childId);
                        const branchId = (note.parentBranchIds || []).find(
                            (bId) => api.getBranch(bId)?.parentNoteId === '_lbVisibleLaunchers'
                        );
                        if (branchId) {
                            branches.push({ noteId: childId, branchId, pos: api.getBranch(branchId)?.notePosition || 0 });
                        }
                    }
                    const nativeMax = Math.max(0, ...branches.filter((b) => !extensionSet.has(b.noteId)).map((b) => b.pos));
                    extensionIds.forEach((launcherId, idx) => {
                        const target = branches.find((b) => b.noteId === launcherId);
                        if (target) {
                            api.setBranchPosition(target.branchId, nativeMax + (idx + 1) * 10);
                        }
                    });
                    api.refreshNoteOrdering('_lbVisibleLaunchers');
                }
            } catch (err) {
                // Ordering is non-critical if branch manipulation isn't supported
            }
        }, [LAUNCHER_ACTIONS.map((launcher) => ({
            ...launcher,
            script: launcherScriptFor(launcher.type),
        })), api.currentNote.noteId]);
    }
})();
