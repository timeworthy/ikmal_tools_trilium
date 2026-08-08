/**
 * Notes System Dashboard Entrypoint (JSX Render Note)
 * Combines Today Homepage, Template Studio (which owns relationship and if/then
 * rule editing inline), and Package Settings.
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { TodayEngine } from '../engine/todayEngine.js';
import { NoteCreationEngine } from '../engine/noteCreationEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { loadAutomationSettings, loadYamlSpecification, saveYamlSpecification } from '../engine/packagePersistence.js';
import { parseAndApplyYamlSpec } from '../engine/yamlSpec.js';
import { renderTodayHomepage } from '../components/TodayHomepage.js';
import { renderTemplateStudio } from '../components/TemplateStudio.js';
import { renderSettingsStudio } from '../components/SettingsStudio.js';
import { showQuickCaptureModal } from '../components/QuickCaptureModal.js';

// Render errors can carry note-derived text (a title echoed into a thrown
// message), and the error card writes them through innerHTML.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function initNotesSystemDashboard(containerEl) {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const todayEngine = new TodayEngine();
    const settingsEngine = new SettingsEngine();
    const noteCreationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine);

    let activeTab = 'today';

    function renderMain() {
        containerEl.innerHTML = '';

        // Container shell. Colours and spacing come from notes-system.css so the
        // page tracks whichever Trilium theme is active.
        const shell = document.createElement('div');
        shell.className = 'notes-system-shell';

        // Top navigation: an underlined tab strip, the way Trilium marks a selected
        // view, rather than filled pills.
        const nav = document.createElement('div');
        nav.className = 'ns-tabs';
        nav.setAttribute('role', 'tablist');

        const tabs = [
            { id: 'today', label: 'Today', icon: 'home-alt' },
            { id: 'templates', label: 'Template Studio', icon: 'layer' },
            { id: 'settings', label: 'Settings', icon: 'slider-alt' },
        ];

        for (const t of tabs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `ns-tab ${activeTab === t.id ? 'active' : ''}`;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', String(activeTab === t.id));
            btn.innerHTML = `<span class="bx bx-${t.icon}"></span> ${t.label}`;
            btn.addEventListener('click', () => {
                activeTab = t.id;
                renderMain();
            });
            nav.appendChild(btn);
        }

        shell.appendChild(nav);

        // View Content Area
        const contentArea = document.createElement('div');
        contentArea.className = 'notes-system-content';

        try {
            if (activeTab === 'today') {
                renderTodayHomepage(contentArea, todayEngine, templateEngine, (templateId) => {
                    showQuickCaptureModal(templateId, templateEngine, noteCreationEngine, ({ plan, result }) => {
                        if (result) {
                            renderMain();
                        } else {
                            const cloneTarget = plan.autoCloneContainers.length
                                ? plan.autoCloneContainers.join(', ')
                                : (plan.journalClone ? "Today's Journal" : 'None');
                            alert(`Preview only (no Trilium api present).\n\nFormatted Title: ${plan.formattedTitle}\nLabels: ${plan.labelsToCreate.map(l => '#' + l.name + '=' + l.value).join(', ')}\nAuto-Clone Target: ${cloneTarget}`);
                        }
                    });
                }, settingsEngine, { api: typeof api !== 'undefined' ? api : null });
            } else if (activeTab === 'templates') {
                renderTemplateStudio(contentArea, templateEngine, ifThenRuleEngine, () => {
                    console.log('Templates & Automations updated!');
                });
            } else if (activeTab === 'settings') {
                renderSettingsStudio(contentArea, todayEngine, templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine, (yamlSpec) => {
                    return saveYamlSpecification(yamlSpec);
                });
            }
        } catch (renderError) {
            contentArea.innerHTML = `
                <div class="card p-4 my-3 text-center border-danger">
                    <div class="card-body">
                        <i class="bx bx-error-circle text-danger display-4 mb-2"></i>
                        <h4 class="card-title text-danger">Widget Render Issue</h4>
                        <p class="card-text text-muted">${escapeHtml(renderError?.message || 'An unexpected rendering error occurred in this view.')}</p>
                        <button type="button" class="btn btn-outline-primary btn-sm mt-2" data-action="reload-widget">
                            <i class="bx bx-refresh"></i> Reload View
                        </button>
                    </div>
                </div>
            `;
            contentArea.querySelector('[data-action="reload-widget"]')?.addEventListener('click', () => renderMain());
        }

        shell.appendChild(contentArea);
        containerEl.appendChild(shell);
    }

    renderMain();

    // A previously saved YAML specification (Today layout, templates, categories,
    // if/then rules) is applied as a patch on top of the built-in defaults the
    // engines were constructed with, the same way parseAndApplyYamlSpec is used
    // from the Settings tab's Save button. Without this, "Save specification"
    // would only ever last until the next reload.
    loadYamlSpecification().then((savedSpec) => {
        if (savedSpec) {
            parseAndApplyYamlSpec(savedSpec, todayEngine, templateEngine, ifThenRuleEngine);
            renderMain();
        }
    });

    // Automation settings load from the package's manifest note asynchronously
    // (or resolve immediately outside Trilium); re-render once they land so the
    // Settings tab and NoteCreationEngine reflect the saved values rather than
    // the defaults they were constructed with.
    loadAutomationSettings().then((loaded) => {
        for (const key of Object.keys(loaded)) {
            settingsEngine.set(key, loaded[key]);
        }
        renderMain();
    });
}

// Auto-initialize inside Trilium render note or browser window
if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.notes-system-root')
            || document.body;
        if (container) {
            initNotesSystemDashboard(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
