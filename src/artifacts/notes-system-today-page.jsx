/**
 * The visible Today page.
 *
 * Package settings and workspace editing stay in notes-system-dashboard. The
 * file-tree Today note deliberately renders this smaller, read-only entry point
 * and provides one obvious link to the current editable journal note.
 */

import { RelationshipEngine } from '../engine/relationshipEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { TodayEngine } from '../engine/todayEngine.js';
import { NoteCreationEngine } from '../engine/noteCreationEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { renderTodayHomepage } from '../components/TodayHomepage.js';
import { TemplateEngine } from '../engine/templateEngine.js';
import { showQuickCaptureModal } from '../components/QuickCaptureModal.js';
import { loadRuntimeModel } from '../engine/runtimeModel.js';

export function initNotesSystemTodayPage(containerEl) {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const todayEngine = new TodayEngine();
    const settingsEngine = new SettingsEngine();
    const noteCreationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine);
    const frontendApi = typeof api !== 'undefined' ? api : null;
    const modelReady = loadRuntimeModel(templateEngine, todayEngine, ifThenRuleEngine, settingsEngine, frontendApi);

    let refreshHomepage;
    refreshHomepage = renderTodayHomepage(
        containerEl,
        todayEngine,
        templateEngine,
        async (templateId) => {
            await modelReady;
            return showQuickCaptureModal(templateId, templateEngine, noteCreationEngine, () => {
                refreshHomepage?.();
            }, undefined, {
                api: frontendApi,
            });
        },
        settingsEngine,
        {
            api: frontendApi,
            showEditor: false,
            showHeader: false,
            showJournalCard: true,
            showOpenTasks: false,
        },
    );
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.notes-system-root')
            || document.body;
        if (container) initNotesSystemTodayPage(container);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
