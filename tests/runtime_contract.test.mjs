import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('runtime entrypoints keep the corrected marker and note-id contracts', () => {
    const onThisDay = read('src/artifacts/notes-system-on-this-day.jsx');
    const stale = read('src/artifacts/notes-system-stale-notes.jsx');
    const today = read('src/components/TodayHomepage.tsx');

    assert.doesNotMatch(onThisDay, /#story\b|#meeting\b|#scratch\b/);
    assert.doesNotMatch(stale, /#story\b|#meeting\b|#scratch\b/);
    assert.match(onThisDay, /entry\.noteId/);
    assert.match(stale, /entry\.noteId/);
    assert.match(today, /generation === dataGeneration/);
    assert.match(today, /weatherRequestKey === key/);
});

test('backend hooks are origin-scoped and package hook wiring covers creation plus changes', () => {
    const projectSync = read('src/backend/project-metadata-sync.backend.js');
    const topicSync = read('src/backend/topic-association-sync.backend.js');
    const bootstrap = read('src/artifacts/notes-system-workspace-bootstrap.js');
    const maintenance = read('tools/cli_maintenance.py');

    assert.match(projectSync, /if \(!originEntity \|\| !originEntity\.noteId\)/);
    assert.match(topicSync, /if \(!originEntity \|\| !originEntity\.noteId\)/);
    for (const relation of ['runOnNoteCreation', 'runOnNoteChange', 'runOnAttributeCreation', 'runOnAttributeChange']) {
        assert.match(bootstrap, new RegExp(relation));
        assert.match(maintenance, new RegExp(relation));
    }
});

test('all declared if/then triggers have runtime entry points', () => {
    const dispatcher = read('src/backend/if-then-dispatch.backend.ts');
    const manual = read('src/engine/ifThenManualDispatcher.ts');
    const studio = read('src/components/TemplateStudio.tsx');
    const manifest = JSON.parse(read('trilium-package.json'));

    for (const trigger of ['onNoteCreated', 'onAttributeChanged', 'onManualAction', 'onScheduledCheck']) {
        assert.match(dispatcher + manual + studio, new RegExp(trigger));
    }
    assert.match(dispatcher, /dispatchAttributeChange/);
    assert.match(dispatcher, /dispatchScheduled/);
    assert.match(manual, /runManualIfThenRules/);
    assert.match(studio, /When manually run/);
    assert.match(studio, /During scheduled checks/);
    assert.ok(manifest.artifacts.some((artifact) => artifact.id === 'notes-system-if-then-dispatch'));
});

test('Today exposes a tomorrow planning action through the date-note API', () => {
    const today = read('src/components/TodayHomepage.tsx');

    assert.match(today, /Plan for Tomorrow/);
    assert.match(today, /api\.getDayNote\(tomorrow\)/);
    assert.match(today, /format\('YYYY-MM-DD'\)/);
    assert.match(today, /openJournalNote\(api, tomorrowNote\.noteId\)/);
});

test('Quick Capture uses fuzzy comboboxes for finite and note-backed fields', () => {
    const quickCapture = read('src/components/QuickCaptureModal.ts');

    assert.match(quickCapture, /searchableSelect/);
    assert.match(quickCapture, /data-attr-picker/);
    assert.match(quickCapture, /attrPickers/);
    assert.match(quickCapture, /candidateTemplateIds/);
    assert.match(quickCapture, /attributes\[attrName\] = value/);
});

test('standalone widgets use the persisted runtime model instead of demo constants', () => {
    const insights = read('src/artifacts/notes-system-insights.jsx');
    const weather = read('src/artifacts/notes-system-weather.jsx');
    const kanban = read('src/artifacts/notes-system-kanban.jsx');

    assert.match(insights, /loadRuntimeModel/);
    assert.match(insights, /loadSummaries/);
    assert.doesNotMatch(insights, /currentWords\s*=\s*320/);
    assert.match(weather, /fetchWeather/);
    assert.match(weather, /loadRuntimeModel/);
    assert.match(kanban, /taskLoadGeneration/);
});

test('mutation code checks Trilium refusal bodies after successful HTTP responses', () => {
    const bridge = read('src/engine/triliumApiBridge.ts');
    const materializer = read('src/engine/noteMaterializer.ts');
    assert.ok((bridge.match(/success === false/g) || []).length >= 4);
    assert.match(bridge, /Trilium refused to clone note/);
    assert.match(materializer, /Trilium refused to file the note/);
    assert.match(materializer, /Trilium refused to set/);
});

test('shared button actions observe rejected async handlers instead of creating unhandled promises', () => {
    const nativeUi = read('src/components/nativeUi.ts');
    assert.match(nativeUi, /Promise\.resolve\(onClick\(\)\)\.catch/);
    assert.match(nativeUi, /bindAsyncClick\(btn, onClick\)/);
});
