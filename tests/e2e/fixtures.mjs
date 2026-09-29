import { readFileSync } from 'node:fs';

const REALISTIC_FIXTURES = JSON.parse(readFileSync(new URL('./realistic-fixtures.json', import.meta.url), 'utf8'));
export const realisticFixtures = REALISTIC_FIXTURES;

function resolveAttributes(attributes, ids) {
    return (attributes || []).map((attribute) => {
        const { ref, ...rest } = attribute;
        let value = ref ? ids[ref] : rest.value;
        if (value === 'dynamic-stale') {
            const old = new Date();
            old.setUTCDate(old.getUTCDate() - 45);
            value = old.toISOString();
        }
        return { ...rest, value };
    });
}

async function createFixtureNote(api, parentId, definition, ids, runId) {
    const result = await api.createNote(parentId, {
        title: `${definition.title} [${runId}]`,
        content: definition.content,
        type: definition.type || 'text',
        attributes: resolveAttributes(definition.attributes, ids),
    });
    const noteId = result?.note?.noteId;
    if (!noteId) throw new Error(`Fixture note was not created: ${definition.title}`);
    return noteId;
}

export async function createE2EFixture(api, runId) {
    const root = await api.createNote('root', {
        title: `[E2E] Ikmal Fixture ${runId}`,
        type: 'book',
        attributes: [{ type: 'label', name: 'e2eFixture', value: runId }],
    });
    const rootId = root?.note?.noteId;
    if (!rootId) throw new Error(`Fixture root was not created: ${JSON.stringify(root)}`);

    try {
        const ids = {};
        ids.organization = await createFixtureNote(api, rootId, REALISTIC_FIXTURES.organization, ids, runId);
        ids.person = await createFixtureNote(api, rootId, REALISTIC_FIXTURES.person, ids, runId);
        ids.topic = await createFixtureNote(api, rootId, REALISTIC_FIXTURES.topic, ids, runId);

        for (const project of REALISTIC_FIXTURES.projects) {
            ids[project.key] = await createFixtureNote(api, rootId, { ...project, type: 'book' }, ids, runId);
        }
        const activeRoot = (await api.search('#activeProjectRoot'))[0];
        if (activeRoot?.noteId) {
            for (const key of ['activeProject', 'secondProject']) {
                await api.toggleInParent(ids[key], activeRoot.noteId, true);
            }
        }

        for (const task of REALISTIC_FIXTURES.tasks) {
            ids[task.key] = await createFixtureNote(api, rootId, task, ids, runId);
        }
        ids.meeting = await createFixtureNote(api, rootId, REALISTIC_FIXTURES.meeting, ids, runId);

        // Add a genuinely historical source for On This Day using today's
        // local calendar date in a prior year, while keeping the fixture
        // content in the checked-in realistic dataset. The widget deliberately
        // compares local calendar dates, not UTC dates.
        const now = new Date();
        const historical = {
            ...REALISTIC_FIXTURES.historical,
            title: REALISTIC_FIXTURES.historical.title,
            attributes: REALISTIC_FIXTURES.historical.attributes.map((attribute) => ({
                ...attribute,
                value: attribute.name === 'utcDateCreated'
                    ? `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T12:00:00.000Z`
                    : attribute.value,
            })),
        };
        ids.historical = await createFixtureNote(api, rootId, historical, ids, runId);

        // The project dashboard render note is package-owned and safe to clone into
        // the fixture. This exercises the same render path used by real project hubs.
        const dashboardArtifact = await api.findArtifact('notes-system-project-dashboard');
        if (!dashboardArtifact?.noteId) throw new Error('The project dashboard artifact is not installed.');
        await api.toggleInParent(dashboardArtifact.noteId, ids.activeProject, true);
        // Relation candidates are resolved from Trilium's frontend note cache.
        // Warm every realistic source before opening UI controls that depend
        // on those candidates.
        await api.reloadNotes([...Object.values(ids), dashboardArtifact.noteId]);

        return {
            rootId,
            projectId: ids.activeProject,
            secondProjectId: ids.secondProject,
            taskId: ids.researchTask,
            inProgressTaskId: ids.writingTask,
            doneTaskId: ids.completedTask,
            staleTaskId: ids.staleTask,
            organizationId: ids.organization,
            personId: ids.person,
            topicId: ids.topic,
            meetingId: ids.meeting,
            historicalId: ids.historical,
            // Open the project hub in acceptance tests. The dashboard is cloned
            // beneath it; opening the shared artifact note directly can inherit
            // whichever project happens to be active in another pane.
            dashboardId: ids.activeProject,
            titles: {
                organization: `${REALISTIC_FIXTURES.organization.title} [${runId}]`,
                person: `${REALISTIC_FIXTURES.person.title} [${runId}]`,
                topic: `${REALISTIC_FIXTURES.topic.title} [${runId}]`,
                activeProject: `${REALISTIC_FIXTURES.projects[0].title} [${runId}]`,
                secondProject: `${REALISTIC_FIXTURES.projects[1].title} [${runId}]`,
                researchTask: `${REALISTIC_FIXTURES.tasks[0].title} [${runId}]`,
                writingTask: `${REALISTIC_FIXTURES.tasks[1].title} [${runId}]`,
                completedTask: `${REALISTIC_FIXTURES.tasks[2].title} [${runId}]`,
                staleTask: `${REALISTIC_FIXTURES.tasks[3].title} [${runId}]`,
                meeting: `${REALISTIC_FIXTURES.meeting.title} [${runId}]`,
                historical: `${REALISTIC_FIXTURES.historical.title} [${runId}]`,
            },
            runId,
        };
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

/**
 * Delete a fixture after its frontend page has been closed. Erasing a subtree
 * emits one reload request per erased entity to an attached Trilium client;
 * using the browser context's authenticated request channel keeps teardown
 * isolated from the UI under test.
 */
export async function destroyE2EFixtureWithRequest(requestContext, origin, headers, fixture) {
    if (!fixture?.rootId) return;
    const response = await requestContext.delete(
        `${origin}/api/notes/${encodeURIComponent(fixture.rootId)}?taskId=${encodeURIComponent(`e2e-cleanup-${fixture.runId}`)}&last=true&eraseNotes=true`,
        { headers },
    );
    if (!response.ok()) {
        throw new Error(`Fixture cleanup failed with HTTP ${response.status()}`);
    }
}
