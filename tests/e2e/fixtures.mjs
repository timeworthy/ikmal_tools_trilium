export async function createE2EFixture(api, runId) {
    const root = await api.createNote('root', {
        title: `[E2E] Ikmal Fixture ${runId}`,
        type: 'book',
        attributes: [{ type: 'label', name: 'e2eFixture', value: runId }],
    });
    const rootId = root?.note?.noteId;
    if (!rootId) throw new Error(`Fixture root was not created: ${JSON.stringify(root)}`);

    try {
        const projectResult = await api.createNote(rootId, {
            title: `E2E Project ${runId}`,
            type: 'book',
            attributes: [
                { type: 'label', name: 'extProjectHub', value: '' },
                { type: 'label', name: 'kind', value: 'project' },
                { type: 'label', name: 'status', value: 'active' },
                { type: 'label', name: 'nextAction', value: 'Review E2E fixture' },
            ],
        });
        const projectId = projectResult?.note?.noteId;
        if (!projectId) throw new Error(`Fixture project was not created: ${JSON.stringify(projectResult)}`);

        const taskResult = await api.createNote(rootId, {
            title: `E2E Task ${runId}`,
            content: '<p>Playwright fixture task.</p>',
            attributes: [
                { type: 'label', name: 'extTask', value: '' },
                { type: 'label', name: 'status', value: 'todo' },
                { type: 'label', name: 'priority', value: 'high' },
                { type: 'relation', name: 'project', value: projectId },
            ],
        });
        const taskId = taskResult?.note?.noteId;
        if (!taskId) throw new Error(`Fixture task was not created: ${JSON.stringify(taskResult)}`);

        const doneTaskResult = await api.createNote(rootId, {
            title: `E2E Completed Task ${runId}`,
            content: '<p>Completed Playwright fixture task.</p>',
            attributes: [
                { type: 'label', name: 'extTask', value: '' },
                { type: 'label', name: 'status', value: 'done' },
                { type: 'label', name: 'doneDate', value: new Date().toISOString().slice(0, 10) },
                { type: 'relation', name: 'project', value: projectId },
            ],
        });
        const doneTaskId = doneTaskResult?.note?.noteId;

        // The project dashboard render note is package-owned and safe to clone into
        // the fixture. This exercises the same render path used by real project hubs.
        const dashboardArtifact = await api.findArtifact('notes-system-project-dashboard');
        if (!dashboardArtifact?.noteId) throw new Error('The project dashboard artifact is not installed.');
        await api.toggleInParent(dashboardArtifact.noteId, projectId, true);

        const activeRoot = (await api.search('#activeProjectRoot'))[0];
        if (activeRoot?.noteId) await api.toggleInParent(projectId, activeRoot.noteId, true);

        return { rootId, projectId, taskId, doneTaskId, dashboardId: dashboardArtifact?.noteId, runId };
    } catch (error) {
        // A failed setup must not leave a partial fixture in the test DB.
        await api.deleteNote(rootId, `e2e-setup-cleanup-${runId}`).catch(() => {});
        throw error;
    }
}

export async function destroyE2EFixture(api, fixture) {
    if (!fixture?.rootId) return;
    await api.deleteNote(fixture.rootId, `e2e-cleanup-${fixture.runId}`);
}
