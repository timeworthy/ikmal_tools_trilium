/**
 * Standalone Quick Capture Toolbar (JSX Render Note)
 * Renders a compact Quick Capture button bar for primary note templates, allowing
 * it to be embedded directly into project hubs or section container notes.
 */

import { TemplateEngine } from '../engine/templateEngine.js';
import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { TodayEngine } from '../engine/todayEngine.js';
import { NoteCreationEngine } from '../engine/noteCreationEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { showQuickCaptureModal } from '../components/QuickCaptureModal.js';
import { button, section } from '../components/nativeUi.js';
import { loadRuntimeModel } from '../engine/runtimeModel.js';

export function initNotesSystemQuickCapture(containerEl) {
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

    const { card } = section(shell, {
        title: 'Quick Capture Toolbar',
        description: 'Create new tasks, meeting prep, story packages, or scratch notes with parent links.',
    });

    const templates = templateEngine.getAllTemplates().filter((t) => !t.noJournalClone).slice(0, 6);

    const actions = document.createElement('div');
    actions.className = 'ns-actions d-flex flex-wrap gap-2 mt-2';

    for (const tpl of templates) {
        actions.appendChild(button({
            text: tpl.title,
            icon: `bx-${tpl.icon}`,
            onClick: async () => {
                await modelReady;
                return showQuickCaptureModal(tpl.id, templateEngine, noteCreationEngine, undefined, undefined, {
                    api: frontendApi,
                });
            },
        }));
    }

    card.appendChild(actions);
    shell.appendChild(card);
    containerEl.appendChild(shell);
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.notes-system-quick-capture-root')
            || document.body;
        if (container) {
            initNotesSystemQuickCapture(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
