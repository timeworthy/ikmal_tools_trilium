import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('trilium-package.json', root), 'utf8'));

test('side-effect frontend artifacts are not declared as custom-widget launchers', () => {
    const launcherArtifact = manifest.artifacts.find((artifact) => artifact.id === 'notes-system-launcher');
    const wordCountArtifact = manifest.artifacts.find((artifact) => artifact.id === 'notes-system-word-count');

    assert.equal(launcherArtifact?.type, 'frontend');
    assert.equal(launcherArtifact?.activation, 'startup');
    assert.equal(wordCountArtifact, undefined);
});

test('Ikmal Tools no longer owns the editor implementation', () => {
    assert.equal(fs.existsSync(new URL('src/artifacts/notes-system-word-count.js', root)), false);
    assert.equal(fs.existsSync(new URL('manifests/ikmal-editor.json', root)), false);
    assert.doesNotMatch(fs.readFileSync(new URL('src/artifacts/notes-system.css', root), 'utf8'), /Ikmal Editor standalone styles begin/);
});

test('bundle metadata points to the separately owned Ikmal Editor package', () => {
    const bundleManifest = JSON.parse(fs.readFileSync(new URL('manifests/ikmal-tools-bundle.json', root), 'utf8'));

    assert.equal(bundleManifest.kind, 'bundle');
    assert.equal(bundleManifest.staged, true);
    assert.deepEqual(bundleManifest.components.map((component) => component.id), [
        'iansherr/ikmal_tools_trilium',
        'iansherr/ikmal_editor_trilium'
    ]);
    assert.equal(bundleManifest.components[1].defaultEnabled, true);
});

test('launcher registers native configurable launchbar entries', () => {
    const launcherSource = fs.readFileSync(new URL('src/artifacts/notes-system-launcher.js', root), 'utf8');

    assert.match(launcherSource, /createOrUpdateLauncher/);
    assert.match(launcherSource, /scriptInLauncherContent/);
    assert.match(launcherSource, /iconClass/);
    assert.doesNotMatch(launcherSource, /text-primary/);
    assert.match(launcherSource, /New Project Hub/);
    assert.match(launcherSource, /New Edit/);
    assert.match(launcherSource, /New Email/);
    assert.match(launcherSource, /__ikmalQuickCapture/);
    assert.match(launcherSource, /showPromptDialog/);
    assert.match(launcherSource, /custom\/create-note/);
    assert.match(launcherSource, /startStory/);
    assert.match(launcherSource, /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === '\?' /);
    assert.match(launcherSource, /Cmd \/ Ctrl \+ \?/);
    assert.match(launcherSource, /getParentBranches/);
    assert.doesNotMatch(launcherSource, /legacyTitles/);
    assert.doesNotMatch(launcherSource, /removeLegacyLaunchers/);
    assert.doesNotMatch(launcherSource, /deleteNote\(\)/);
    assert.doesNotMatch(launcherSource, /querySelector<|querySelectorAll</);
});

test('focused Today page hides the workspace Open Tasks widget and repairs daily-note sections', () => {
    const todayPageSource = fs.readFileSync(new URL('src/artifacts/notes-system-today-page.jsx', root), 'utf8');
    const homepageSource = fs.readFileSync(new URL('src/components/TodayHomepage.tsx', root), 'utf8');
    const bootstrapSource = fs.readFileSync(new URL('src/artifacts/notes-system-workspace-bootstrap.js', root), 'utf8');

    assert.match(todayPageSource, /showOpenTasks: false/);
    assert.match(homepageSource, /widget\.id !== 'openTasks'/);
    assert.match(homepageSource, /openJournalNote/);
    assert.match(homepageSource, /journalWidthPercent/);
    assert.match(bootstrapSource, /cleanDailyNotes/);
    assert.match(bootstrapSource, /cleanDailyTemplate/);
    assert.match(bootstrapSource, /removeProjectDashboardsFromDailyNotes/);
    assert.match(bootstrapSource, /removeStrayReportingNotesFromDailyNotes/);
    assert.match(bootstrapSource, /isProjectHubCandidate/);
    assert.match(bootstrapSource, /notes\/\$\{noteId\}\/data/);
    assert.match(bootstrapSource, /data-box-size="expandable"/);
    assert.match(homepageSource, /isProjectDashboard/);
    assert.match(homepageSource, /loadProjectDashboardIds/);
    assert.match(homepageSource, /project\.dashboardId \|\| project\.id/);
    assert.doesNotMatch(homepageSource, /api\.createNote\(project\.noteId/);
});

test('daily repair does not pull story projects into newly opened journals', () => {
    const bootstrapSource = fs.readFileSync(new URL('src/artifacts/notes-system-workspace-bootstrap.js', root), 'utf8');
    const dailyRepairSource = fs.readFileSync(new URL('src/backend/daily-note-repair.backend.js', root), 'utf8');
    const repairBody = bootstrapSource.match(/async function repairTodayBranches\(\) \{([\s\S]*?)\n    \}\n\n    function isDailyNote/)[1];

    assert.doesNotMatch(repairBody, /extStoryDraft|extReportingNotes/);
    assert.doesNotMatch(dailyRepairSource, /extStoryDraft|extReportingNotes/);
    assert.match(bootstrapSource, /explicit New Story workflow/);
    assert.match(dailyRepairSource, /explicit New Story/);
    assert.match(bootstrapSource, /projectId !== dailyNote\.noteId/);
    assert.match(bootstrapSource, /owned markers only/);
    assert.match(bootstrapSource, /Saturday\)\$\/\.test/);
    assert.match(bootstrapSource, /toggle-in-parent\/\$\{parentNoteId\}\/false/);
    assert.match(bootstrapSource, /would orphan\/delete the note/);
});

test('workspace bootstrap is a startup artifact and project dashboards are render artifacts', () => {
    const bootstrap = manifest.artifacts.find((artifact) => artifact.id === 'notes-system-workspace-bootstrap');
    const projectDashboard = manifest.artifacts.find((artifact) => artifact.id === 'notes-system-project-dashboard');

    assert.equal(bootstrap?.type, 'frontend');
    assert.equal(bootstrap?.activation, 'startup');
    assert.equal(projectDashboard?.type, 'render');
    assert.equal(projectDashboard?.activation, 'manual');

    const source = fs.readFileSync(new URL('src/artifacts/notes-system-workspace-bootstrap.js', root), 'utf8');
    assert.match(source, /findOrCreateVisibleToday/);
    assert.match(source, /ensureTodayAlignment/);
    assert.match(source, /type === 'label' && typeof api !== 'undefined'/);
    assert.match(source, /getFreshOwnedRelationTarget/);
    assert.match(source, /notes\/\$\{noteId\}\/attributes/);
    assert.match(source, /!freshRelation\.available \|\| currentTarget !== todayCode\.noteId/);
    assert.match(source, /setInterval\(checkTodayAlignment, 60_000\)/);
    assert.match(source, /attachProjectDashboards/);
    assert.match(source, /Dashboard: \$\{project\.title\}/);
    assert.match(source, /#extTemplate/);
    assert.match(source, /projectHub/);
    assert.match(source, /markerValue/);
    assert.match(source, /hasMarker/);
    assert.match(source, /extHubDashboard/);
    assert.match(source, /repairTodayBranches/);
    assert.match(source, /disableLegacyStartupScripts/);
    assert.match(source, /Today Dashboard/);
    assert.match(source, /note\.removeLabel\('run'\)/);
    assert.match(source, /toggle-in-parent/);
    assert.match(source, /quick-search/);
    assert.match(source, /notes\/\$\{noteId\}\/title/);
    assert.doesNotMatch(source, /notes\/\$\{reporting\.noteId\}\/data/);
    assert.match(source, /preserving any text the user entered there/);
});

test('project dashboards support legacy hubs and show live related work', () => {
    const source = fs.readFileSync(new URL('src/artifacts/notes-system-project-dashboard.js', root), 'utf8');
    assert.match(source, /extProjectHub/);
    assert.match(source, /extTemplate.*projectHub/);
    assert.match(source, /noteType.*projectHub/);
    assert.match(source, /searchRelated/);
    assert.match(source, /Awaiting replies & follow-ups/);
    assert.match(source, /Archive project/);
    assert.match(source, /container-type: inline-size/);
    assert.match(source, /@container project-dashboard/);
    assert.match(source, /getParentNoteIds/);
    assert.match(source, /getParentNotes/);
});

test('a fresh install provisions itself once, and the watchdog never creates', () => {
    const source = fs.readFileSync(new URL('src/artifacts/notes-system-workspace-bootstrap.js', root), 'utf8');

    // repair() is the only caller of the provisioning steps, so startup has to
    // reach it at least once or a Community Packages install stays empty.
    assert.match(source, /runFirstRunBootstrapIfNeeded\(\)/);
    assert.match(source, /searchIncludingHidden\('#extBootstrapped'\)/);
    assert.match(source, /await window\.__ikmal_workspace_repair\(\)/);

    // The marker is written last so an early bail retries on the next startup.
    const repairBody = source.match(/async function repair\(\) \{([\s\S]*?)\n    \}\n/)[1];
    assert.ok(repairBody.indexOf('extBootstrapped') > repairBody.indexOf('runSystemVerification'));

    // The recurring tick is lookup-only; a transient empty #todayRoot result
    // must never mint a second root-level Today note.
    assert.match(source, /ensureTodayAlignment\(\{ allowCreate: false \}\)/);
    assert.doesNotMatch(source, /todayCreateAllowed/);
});

test('project archive and reopen refresh outside the rollback boundary', () => {
    const source = fs.readFileSync(new URL('src/artifacts/notes-system-project-dashboard.js', root), 'utf8');

    // loadDashboard() must not sit inside the try: a render failure after the
    // hub has moved would otherwise roll `status` back to contradict its parent.
    assert.match(source, /if \(archived\) \{\s*await loadDashboard\(\)/);
    assert.match(source, /if \(reopened\) \{\s*await loadDashboard\(\)/);
    // An empty previous doneDate must still be restored, not left behind.
    assert.match(source, /await setLabel\(hub\.noteId, 'doneDate', previousDoneDate\);/);
    assert.doesNotMatch(source, /if \(previousDoneDate\) await setLabel/);
});

test('launcher creates notes in process rather than shipping the handler secret to page JS', () => {
    const launcherSource = fs.readFileSync(new URL('src/artifacts/notes-system-launcher.js', root), 'utf8');
    const backendSource = fs.readFileSync(new URL('src/backend/create-note-api.backend.js', root), 'utf8');

    assert.match(backendSource, /globalThis\.__ikmalCreateNote = dispatchAction/);
    assert.match(backendSource, /function dispatchAction\(body = \{\}\)/);
    assert.match(launcherSource, /globalThis\.__ikmalCreateNote/);

    // The HTTP fallback survives for older backend artifacts, but its URL has
    // to come from baseApiUrl or it 404s behind a sub-path reverse proxy.
    // Verified against a live instance: baseApiUrl is 'api/' (relative), so the
    // route must be its sibling -- 'api/custom/create-note' 404s.
    assert.match(launcherSource, /root \+ 'custom\/create-note'/);
    assert.match(launcherSource, /base\.endsWith\('api\/'\) \? base\.slice\(0, -4\) : base/);
    assert.doesNotMatch(launcherSource, /fetch\('\/custom\/create-note'/);
});

test('both deploy archive paths strip the same activation labels', () => {
    const source = fs.readFileSync(new URL('tools/deploy_plugin_to_instance.py', root), 'utf8');

    assert.match(source, /ACTIVATION_LABELS = \{"run", "appCss", "widget", "customRequestHandler"\}/);
    assert.equal(source.match(/delete_owned_labels\(api, note, ACTIVATION_LABELS\)/g)?.length, 2);
    assert.doesNotMatch(source, /delete_owned_labels\(api, note, \{"/);
});

test('the version stamped on #extConfig matches the package manifest', () => {
    const source = fs.readFileSync(new URL('src/artifacts/notes-system-workspace-bootstrap.js', root), 'utf8');
    const declared = source.match(/const PACKAGE_VERSION = '([^']+)'/)?.[1];

    assert.equal(declared, manifest.version);
    assert.match(source, /value: PACKAGE_VERSION/);
});

test('render errors are escaped before reaching innerHTML', () => {
    const source = fs.readFileSync(new URL('src/artifacts/notes-system-dashboard.jsx', root), 'utf8');

    assert.match(source, /const escapeHtml = /);
    assert.match(source, /\$\{escapeHtml\(renderError\?\.message/);
});

test('Today has a separate visible page from the workspace settings dashboard', () => {
    const todayPage = manifest.artifacts.find((artifact) => artifact.id === 'notes-system-today-page');
    assert.equal(todayPage?.type, 'render');
    assert.equal(todayPage?.activation, 'manual');

    const source = fs.readFileSync(new URL('src/artifacts/notes-system-today-page.jsx', root), 'utf8');
    const homepageSource = fs.readFileSync(new URL('src/components/TodayHomepage.tsx', root), 'utf8');
    assert.match(source, /showEditor: false/);
    assert.match(source, /showJournalCard: true/);
    assert.match(homepageSource, /renderActiveProjects/);
    assert.match(homepageSource, /#kind AND #status = active/);
    assert.doesNotMatch(source, /renderSettingsStudio/);
});
