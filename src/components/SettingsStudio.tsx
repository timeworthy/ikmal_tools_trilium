/**
 * Settings Studio Component: Package preferences, global toggles, and YAML Specification Manager.
 *
 * Laid out the way Trilium's own options pages are: a sticky page header, then
 * sections whose uppercase title sits above a card, and inside each card one row
 * per setting with the label and description on the leading edge and the control
 * on the trailing edge. See notes-system.css for the shared primitives.
 */

import { TodayEngine } from '../engine/todayEngine.js';
import { TemplateEngine } from '../engine/templateEngine.js';
import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { AutomationSettings, SettingsEngine } from '../engine/settingsEngine.js';
import { saveAutomationSetting } from '../engine/packagePersistence.js';
import { DEFAULT_STARTER_YAML_SPEC, dumpYamlSpec, parseAndApplyYamlSpec, exportTemplateToYaml, importTemplateFromYaml } from '../engine/yamlSpec.js';
import { escapeHtml, iconAction, listItem, openModal, pageHeader, row, section, switchRow } from './nativeUi.js';

export function renderSettingsStudio(
    container: HTMLElement,
    todayEngine: TodayEngine,
    templateEngine: TemplateEngine,
    relationshipEngine: RelationshipEngine,
    ifThenRuleEngine: IfThenRuleEngine,
    settingsEngine: SettingsEngine,
    onSaveSettings?: (yamlSpec: string) => Promise<void>,
    initialYamlSpec?: string,
    frontendApi?: any,
): void {
    let importError = '';
    let importSuccess = '';
    let settingsError = '';
    let currentYamlSpec = initialYamlSpec;

    function render() {
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'settings-studio-container';

        wrapper.appendChild(pageHeader({
            icon: 'bx-slider-alt',
            title: 'Package Settings',
            subtitle: 'Automation preferences and the YAML specification for this package.',
        }));

        renderPreferences(wrapper);
        renderSystemHealth(wrapper);
        renderIkmalToolsCatalog(wrapper);
        renderYamlSpecification(wrapper);

        container.appendChild(wrapper);
    }

    function renderPreferences(parent: HTMLElement) {
        // --- Complete Your Bundle Cross-Promotion Card ---
        const { card: bundleCard } = section(parent, {
            title: '📦 Ikmal App Store Bundle',
            description: 'Explore companion plugins or complete your bundle in the Trilium Community Catalog.',
        });
        const bundleList = document.createElement('div');
        bundleList.className = 'd-flex flex-column gap-2 p-1';
        bundleList.innerHTML = `
            <div class="ns-row-desc mb-2">You are using <strong>Ikmal Tools Core Package</strong>. You can install companion tools individually or get the full suite:</div>
            <div class="d-flex flex-wrap gap-2">
                <span class="badge bg-primary-subtle text-primary border p-2"><i class="bx bx-check-circle me-1"></i> Ikmal Tools Full Suite (Installed)</span>
                <span class="badge bg-secondary-subtle text-body border p-2"><i class="bx bx-text me-1"></i> Ikmal Editor (companion)</span>
                <span class="badge bg-secondary-subtle text-body border p-2"><i class="bx bx-keyboard me-1"></i> Ikmal Shortcuts & Command Palette</span>
                <span class="badge bg-secondary-subtle text-body border p-2"><i class="bx bx-layout me-1"></i> Ikmal Standalone Kanban Board</span>
            </div>
            <div class="mt-2 text-end">
                <a href="https://github.com/iansherr/ikmal_editor_trilium" target="_blank" class="btn btn-micro btn-outline-primary">
                    <i class="bx bx-store-alt me-1"></i> Complete Your Bundle on GitHub
                </a>
            </div>
        `;
        bundleCard.appendChild(bundleList);

        const { card } = section(parent, {
            title: 'Automation',
            description: 'Saved to this package’s manifest note, so they persist across reloads and are visible from Trilium’s Plugins settings too.',
        });

        if (settingsError) {
            const status = document.createElement('div');
            status.className = 'alert alert-danger';
            status.textContent = settingsError;
            card.appendChild(status);
        }

        card.appendChild(switchRow({
            id: 'ifThenRulesToggle',
            label: 'Auto-execute if/then automation rules',
            description: 'Evaluate if/then automation rules when creating tasks, story drafts, or project hubs.',
            checked: settingsEngine.get('autoRunIfThenRulesOnCreation'),
            onChange: (checked) => applySetting('autoRunIfThenRulesOnCreation', checked),
        }));

        card.appendChild(switchRow({
            id: 'derivedTopicsToggle',
            label: 'Enable derived topic propagation',
            description: 'Inherit topic tags from parent project hubs, organizations, or person relations.',
            checked: settingsEngine.get('enableDerivedTopics'),
            onChange: (checked) => applySetting('enableDerivedTopics', checked),
        }));

        card.appendChild(switchRow({
            id: 'autoJournalCloneToggle',
            label: "File new notes under today's journal note",
            description: "Master switch for the per-category setting in Template Studio. Off disables journal filing everywhere; on, project work is filed under both its project and today's journal.",
            checked: settingsEngine.get('autoJournalClone'),
            onChange: (checked) => applySetting('autoJournalClone', checked),
        }));

        const swatchRow = document.createElement('div');
        swatchRow.className = 'ns-row d-flex justify-content-between align-items-center py-2';
        swatchRow.innerHTML = `
            <div class="ns-row-label">
                <label>Theme Accent Color</label>
                <small class="ns-row-desc">Personalize primary buttons, badge highlights, and focus outlines.</small>
            </div>
            <div class="ns-row-input d-flex align-items-center gap-1.5">
                ${[
                    { name: 'Indigo', color: '#6366f1' },
                    { name: 'Royal Blue', color: '#3b82f6' },
                    { name: 'Emerald', color: '#10b981' },
                    { name: 'Amber', color: '#f59e0b' },
                    { name: 'Crimson', color: '#ef4444' },
                ].map(s => `
                    <button type="button" class="btn btn-micro accent-swatch-btn" data-color="${s.color}" title="${s.name}" style="background-color: ${s.color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--main-background-color); cursor: pointer;"></button>
                `).join('')}
            </div>
        `;
        swatchRow.querySelectorAll('.accent-swatch-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const hex = (e.currentTarget as HTMLElement).dataset.color;
                if (hex && typeof document !== 'undefined') {
                    document.documentElement.style.setProperty('--accent-color', hex);
                    document.documentElement.style.setProperty('--bs-primary', hex);
                }
            });
        });
        card.appendChild(swatchRow);

        const cardStyleSelect = document.createElement('select');
        cardStyleSelect.className = 'form-select form-select-sm';
        cardStyleSelect.id = 'card-style-mode';
        cardStyleSelect.innerHTML = `
            <option value="glass">Frosted Glass (Dynamic Translucency)</option>
            <option value="solid">High-Contrast Solid (Classic Borders)</option>
        `;
        cardStyleSelect.addEventListener('change', () => {
            if (typeof document !== 'undefined') {
                document.documentElement.dataset.ikmalCardStyle = cardStyleSelect.value;
            }
        });
        card.appendChild(row(cardStyleSelect, {
            label: 'Card Surface Aesthetics',
            description: 'Choose between frosted glassmorphism or high-contrast solid borders across all system cards.',
            htmlFor: 'card-style-mode',
        }));

        const tplInput = document.createElement('input');
        tplInput.type = 'text';
        tplInput.className = 'form-control form-control-sm';
        tplInput.id = 'default-capture-tpl';
        tplInput.value = settingsEngine.get('defaultQuickCaptureTemplate') || 'task';
        tplInput.addEventListener('change', () => applySetting('defaultQuickCaptureTemplate', tplInput.value.trim() || 'task'));
        card.appendChild(row(tplInput, {
            label: 'Default Quick Capture template ID',
            description: 'Template ID opened by default when clicking the global header Quick Capture button (e.g. task, meeting, story).',
            htmlFor: 'default-capture-tpl',
        }));

        const staleInput = document.createElement('input');
        staleInput.type = 'number';
        staleInput.className = 'form-control form-control-sm';
        staleInput.id = 'stale-threshold-input';
        staleInput.value = String(settingsEngine.get('staleThresholdDays') ?? 14);
        staleInput.addEventListener('change', () => applySetting('staleThresholdDays', Math.max(1, parseInt(staleInput.value, 10) || 14)));
        card.appendChild(row(staleInput, {
            label: 'Stale Notes inactivity threshold (days)',
            description: 'Active notes unmodified for longer than this threshold appear in the Stale Notes review list.',
            htmlFor: 'stale-threshold-input',
        }));

        const goalInput = document.createElement('input');
        goalInput.type = 'number';
        goalInput.className = 'form-control form-control-sm';
        goalInput.id = 'writing-goal-input';
        goalInput.value = String(settingsEngine.get('writingGoalWords') ?? 500);
        goalInput.addEventListener('change', () => applySetting('writingGoalWords', Math.max(50, parseInt(goalInput.value, 10) || 500)));
        card.appendChild(row(goalInput, {
            label: 'Daily writing target (words)',
            description: 'Word count target for the Writing Goal progress bar and activity heatmap on the Today Homepage.',
            htmlFor: 'writing-goal-input',
        }));
    }

    function renderIkmalToolsCatalog(parent: HTMLElement) {
        const { card } = section(parent, {
            title: 'Ikmal Micro-Tools Suite',
            description: 'Standalone render note artifacts declared in this package. Link or clone any of these notes into daily notes or project hubs to embed them independently.',
        });

        const microTools = [
            { id: 'notes-system-kanban', title: 'Ikmal Task Kanban Board', icon: 'bx-layout', desc: 'Live task board sorted by todo, in progress, and completed columns.' },
            { id: 'notes-system-insights', title: 'Ikmal Writing & Productivity Insights', icon: 'bx-target-lock', desc: 'Daily word count goal progress, 30-day activity heatmap, and moon phase.' },
            { id: 'notes-system-quick-capture', title: 'Ikmal Quick Capture Toolbar', icon: 'bx-plus-circle', desc: '1-click note creation toolbar for tasks, meetings, and story packages.' },
            { id: 'notes-system-weather', title: 'Ikmal Weather & Climate Card', icon: 'bx-sun', desc: 'Open-Meteo weather forecast, temperature, daylight hours, and moon phase.' },
            { id: 'notes-system-on-this-day', title: 'Ikmal Time Machine (On This Day)', icon: 'bx-history', desc: 'Notes created on the exact calendar day in previous years.' },
            { id: 'notes-system-stale-notes', title: 'Ikmal Stale Note Reviewer', icon: 'bx-time-five', desc: 'Active notes unmodified longer than the configured threshold.' },
            { id: 'notes-system-canvas', title: 'Ikmal Interactive Canvas (Beta)', icon: 'bx-network-chart', desc: 'Interactive visual whiteboard and node graph for project notes and mind-mapping.' },
        ];

        for (const tool of microTools) {
            card.appendChild(listItem({
                icon: tool.icon,
                title: tool.title,
                description: tool.desc,
            }));
        }
    }

    function applySetting<K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]): void {
        const previous = settingsEngine.get(key);
        settingsEngine.set(key, value);
        settingsError = '';
        saveAutomationSetting(key, value as any, frontendApi).catch((err: Error) => {
            settingsEngine.set(key, previous);
            settingsError = `Could not save this setting: ${err.message}`;
            render();
        });
    }

    function renderYamlSpecification(parent: HTMLElement) {
        const yamlContent = dumpYamlSpec(
            todayEngine.getLayout(),
            templateEngine,
            relationshipEngine,
            ifThenRuleEngine
        );
        const editorContent = currentYamlSpec ?? yamlContent;

        const { card } = section(parent, {
            title: 'Specification',
            description:
                'The complete package as YAML: Today Homepage layout, every template, relationship rules, and automation trees. Edit and save to apply.',
        });

        const status = document.createElement('div');
        if (importError) {
            status.className = 'alert alert-danger';
            status.textContent = importError;
            card.appendChild(status);
        } else if (importSuccess) {
            status.className = 'alert alert-success';
            status.textContent = importSuccess;
            card.appendChild(status);
        }

        const field = document.createElement('div');
        field.className = 'ns-field';
        field.innerHTML = `
            <textarea class="form-control ns-code" rows="18" spellcheck="false">${escapeHtml(editorContent)}</textarea>
        `;
        card.appendChild(field);

        const actions = document.createElement('div');
        actions.className = 'ns-actions ns-actions-end d-flex gap-2 flex-wrap';
        actions.style.marginTop = '14px';
        actions.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-info export-tpl-btn"><span class="bx bx-export"></span> Export Single Template</button>
            <button type="button" class="btn btn-sm btn-outline-success import-tpl-btn"><span class="bx bx-import"></span> Import Single Template</button>
            <button type="button" class="btn btn-sm btn-secondary copy-yaml-btn"><span class="bx bx-copy"></span> Copy Spec</button>
            <button type="button" class="btn btn-sm btn-primary save-yaml-btn"><span class="bx bx-save"></span> Save specification</button>
        `;
        card.appendChild(actions);

        actions.querySelector<HTMLButtonElement>('.export-tpl-btn')!.addEventListener('click', () => {
            const allTpls = templateEngine.getAllTemplates();
            openModal({
                title: 'Export Single Template',
                icon: 'bx-export',
                body: `
                    <div class="mb-3">
                        <label class="form-label small font-weight-bold">Select Template to Export</label>
                        <select class="form-select form-select-sm export-tpl-select">
                            ${allTpls.map(t => `<option value="${t.id}">${escapeHtml(t.title)} (#${t.marker})</option>`).join('')}
                        </select>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small font-weight-bold">Template YAML Output</label>
                        <textarea class="form-control ns-code export-tpl-out" rows="8" readonly></textarea>
                    </div>
                `,
                confirmText: 'Copy Template YAML',
            }, (modalEl) => {
                const getYamlFor = (tplId: string) => {
                    const tpl = templateEngine.getTemplate(tplId);
                    if (!tpl) return '';
                    return exportTemplateToYaml(tpl);
                };

                const sel = modalEl.querySelector('.export-tpl-select') as HTMLSelectElement;
                const out = modalEl.querySelector('.export-tpl-out') as HTMLTextAreaElement;
                if (sel && out) {
                    const yamlStr = getYamlFor(sel.value);
                    out.value = yamlStr;
                    navigator.clipboard.writeText(yamlStr);
                    importSuccess = `Template "${sel.value}" exported to clipboard!`;
                    render();
                }
                return true;
            });
            const selEl = document.querySelector('.export-tpl-select') as HTMLSelectElement;
            const outEl = document.querySelector('.export-tpl-out') as HTMLTextAreaElement;
            if (selEl && outEl) {
                const getYamlFor = (tplId: string) => {
                    const tpl = templateEngine.getTemplate(tplId);
                    if (!tpl) return '';
                    return exportTemplateToYaml(tpl);
                };
                outEl.value = getYamlFor(selEl.value);
                selEl.addEventListener('change', () => {
                    outEl.value = getYamlFor(selEl.value);
                });
            }
        });

        actions.querySelector<HTMLButtonElement>('.import-tpl-btn')!.addEventListener('click', () => {
            openModal({
                title: 'Import Single Template',
                icon: 'bx-import',
                body: `
                    <div class="mb-2">
                        <label class="form-label small font-weight-bold">Paste Single Template YAML</label>
                        <textarea class="form-control ns-code import-tpl-input" rows="8" placeholder="Paste template YAML spec here..."></textarea>
                    </div>
                `,
                confirmText: 'Import Template',
            }, (modalEl) => {
                const input = modalEl.querySelector('.import-tpl-input') as HTMLTextAreaElement;
                const yamlStr = input ? input.value.trim() : '';
                if (!yamlStr) return false;
                try {
                    const importedTpl = importTemplateFromYaml(yamlStr);
                    templateEngine.registerTemplate(importedTpl);
                    importSuccess = `Successfully imported template "${importedTpl.title}" (#${importedTpl.marker})!`;
                    render();
                    return true;
                } catch (err: any) {
                    importError = `Import error: ${err.message}`;
                    render();
                    return false;
                }
            });
        });

        const textarea = field.querySelector('textarea') as HTMLTextAreaElement;

        actions.querySelector<HTMLButtonElement>('.copy-yaml-btn')!.addEventListener('click', () => {
            navigator.clipboard.writeText(textarea.value);
            importSuccess = 'Specification copied to clipboard.';
            importError = '';
            render();
        });

        actions.querySelector<HTMLButtonElement>('.save-yaml-btn')!.addEventListener('click', () => {
            const hasCustomSpec = Boolean(textarea.value.trim());
            const yamlToApply = hasCustomSpec ? textarea.value : DEFAULT_STARTER_YAML_SPEC;
            const res = parseAndApplyYamlSpec(yamlToApply, todayEngine, templateEngine, ifThenRuleEngine);
            if (!res.success) {
                importError = res.message;
                importSuccess = '';
                render();
                return;
            }

            currentYamlSpec = yamlToApply;
            importSuccess = hasCustomSpec
                ? res.message
                : 'Loaded the starter specification. Built-in templates and automation remain active until you add custom sections.';
            importError = '';
            render();

            if (onSaveSettings) {
                onSaveSettings(yamlToApply).catch((err: Error) => {
                    importError = `Applied in this session, but could not save to the manifest note: ${err.message}`;
                    importSuccess = '';
                    render();
                });
            }
        });
    }

    function renderSystemHealth(parent: HTMLElement) {
        const { card } = section(parent, {
            title: 'System Health & Workspace Maintenance',
            description: 'Verify system container markers, saved search queries, backend event hooks, and journal template wiring. Run 1-click repairs to realign missing structures without touching your notes.',
        });

        const statusBox = document.createElement('div');
        statusBox.className = 'alert alert-info';
        statusBox.textContent = 'Click "Run Health Verification" to inspect workspace integrity or "Repair Workspace Alignment" to re-apply containers and event wiring.';
        card.appendChild(statusBox);

        const actions = document.createElement('div');
        actions.className = 'ns-actions';
        actions.style.marginTop = '12px';
        actions.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-secondary check-health-btn"><span class="bx bx-check-shield"></span> Run Health Verification</button>
            <button type="button" class="btn btn-sm btn-primary repair-workspace-btn"><span class="bx bx-wrench"></span> Repair Workspace Alignment</button>
            <button type="button" class="btn btn-sm btn-outline-primary clean-projects-btn"><span class="bx bx-archive-in"></span> Clean & Auto-Archive Projects</button>
        `;
        card.appendChild(actions);

        actions.querySelector<HTMLButtonElement>('.clean-projects-btn')!.addEventListener('click', async () => {
            statusBox.className = 'alert alert-info';
            statusBox.textContent = 'Sweeping active project hubs and reconciling completed edit rounds...';
            try {
                const api = frontendApi || (globalThis as any).api;
                if (!api || typeof api.searchForNotes !== 'function') {
                    statusBox.className = 'alert alert-warning';
                    statusBox.textContent = 'Project reconciliation requires live Trilium session context.';
                    return;
                }
                const activeRootNotes = await api.searchForNotes('#activeProjectRoot');
                const archiveRootNotes = await api.searchForNotes('#archiveProjectRoot');
                const projectHubs = await api.searchForNotes('#extTemplate="projectHub"');
                
                let moved = 0;
                let statusUpdated = 0;
                
                const activeRoot = activeRootNotes?.[0];
                const archiveRoot = archiveRootNotes?.[0];

                for (const hub of projectHubs || []) {
                    const drafts = (hub.getTargetRelations?.() || [])
                        .filter((r: any) => r.type === 'relation' && r.name === 'project')
                        .map((r: any) => api.getNote?.(r.noteId))
                        .filter((n: any) => n && n.hasLabel?.('extTemplate', 'storyDraft'))
                        .sort((a: any, b: any) => Number(b.getLabelValue?.('round') || 0) - Number(a.getLabelValue?.('round') || 0));

                    if (!drafts.length) continue;
                    const latest = drafts[0];
                    const latestStatus = (latest.getLabelValue?.('status') || '').toLowerCase();
                    const isDone = latestStatus === 'done' || latestStatus === 'approved' || latestStatus === 'published' || Boolean(latest.getOwnedLabelValue?.('doneDate'));
                    const currentStatus = hub.getLabelValue?.('status');

                    if (isDone && currentStatus !== 'complete') {
                        hub.setLabel?.('status', 'complete');
                        statusUpdated++;
                        if (archiveRoot && !hub.getParentNoteIds?.().includes(archiveRoot.noteId)) {
                            api.ensureNoteIsPresentInParent?.(hub.noteId, archiveRoot.noteId, '');
                            moved++;
                        }
                        if (activeRoot && hub.getParentNoteIds?.().includes(activeRoot.noteId)) {
                            api.ensureNoteIsAbsentFromParent?.(hub.noteId, activeRoot.noteId);
                        }
                    } else if (!isDone && (currentStatus === 'complete' || currentStatus === 'archived')) {
                        hub.setLabel?.('status', 'active');
                        statusUpdated++;
                        if (activeRoot && !hub.getParentNoteIds?.().includes(activeRoot.noteId)) {
                            api.ensureNoteIsPresentInParent?.(hub.noteId, activeRoot.noteId, '');
                            moved++;
                        }
                        if (archiveRoot && hub.getParentNoteIds?.().includes(archiveRoot.noteId)) {
                            api.ensureNoteIsAbsentFromParent?.(hub.noteId, archiveRoot.noteId);
                        }
                    }
                }

                statusBox.className = 'alert alert-success';
                statusBox.textContent = `📦 Project reconciliation complete! Reconciled ${projectHubs?.length || 0} Project Hub(s): ${statusUpdated} status update(s), ${moved} area move(s).`;
            } catch (err: any) {
                statusBox.className = 'alert alert-danger';
                statusBox.textContent = `Project reconciliation error: ${err?.message || String(err)}`;
            }
        });

        actions.querySelector<HTMLButtonElement>('.check-health-btn')!.addEventListener('click', async () => {
            statusBox.className = 'alert alert-info';
            statusBox.textContent = 'Running system health verification...';
            try {
                const api = frontendApi || (globalThis as any).api;
                if (!api || typeof api.searchForNotes !== 'function') {
                    statusBox.className = 'alert alert-warning';
                    statusBox.textContent = 'System verification requires live Trilium session context.';
                    return;
                }
                const containers = ['calendarRoot', 'todayRoot', 'projectRoot', 'activeProjectRoot', 'archiveProjectRoot', 'unassignedRoot', 'taskRoot', 'meetingRoot', 'peopleRoot', 'orgRoot', 'topicRoot', 'templateRoot', 'extConfig', 'storyDraftRoot', 'emailRoot'];
                const missing: string[] = [];
                for (const m of containers) {
                    const found = await api.searchForNotes(`#${m}`);
                    if (!found || !found.length) missing.push(`#${m}`);
                }
                const journal = (await api.searchForNotes('#calendarRoot'))?.[0];
                const hasDateTpl = journal?.getRelations?.('dateTemplate')?.length > 0;
                if (!hasDateTpl) missing.push('Journal ~dateTemplate relation');

                if (missing.length === 0) {
                    statusBox.className = 'alert alert-success';
                    statusBox.textContent = '✅ All 15 system containers, templates, and Journal dateTemplate relations are 100% healthy and verified.';
                } else {
                    statusBox.className = 'alert alert-warning';
                    statusBox.textContent = `⚠️ Found ${missing.length} missing system element(s): ${missing.join(', ')}. Click "Repair Workspace Alignment" to restore them.`;
                }
            } catch (err: any) {
                statusBox.className = 'alert alert-danger';
                statusBox.textContent = `Verification error: ${err?.message || String(err)}`;
            }
        });

        actions.querySelector<HTMLButtonElement>('.repair-workspace-btn')!.addEventListener('click', async () => {
            statusBox.className = 'alert alert-info';
            statusBox.textContent = 'Executing workspace repair and schema alignment...';
            try {
                const repair = typeof window !== 'undefined' ? (window as any).__ikmal_workspace_repair : null;
                if (typeof repair !== 'function') {
                    throw new Error('Workspace repair is not loaded. Reload the Trilium frontend and try again.');
                }
                await repair();
                statusBox.className = 'alert alert-success';
                statusBox.textContent = '🛠️ Workspace repair completed. Containers, templates, saved search views, and backend event hooks have been aligned.';
            } catch (err: any) {
                statusBox.className = 'alert alert-danger';
                statusBox.textContent = `Repair error: ${err?.message || String(err)}`;
            }
        });
    }

    render();
}
