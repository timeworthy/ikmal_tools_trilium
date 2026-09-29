# Ikmal Tools E2E tests

These tests run against a disposable Trilium instance, not a mocked browser.
They create a uniquely named fixture tree through the authenticated frontend
API, exercise the render notes through Trilium's tab manager, and delete the
fixture tree in `afterEach`.

```sh
IKMAL_E2E_URL=http://127.0.0.1:37840 \
IKMAL_E2E_STORAGE_STATE=/path/to/trilium-storage-state.json \
npm run test:e2e
```

The storage state must be captured from an authenticated test account/profile;
do not commit it. On a workstation with an installed browser, set
`IKMAL_E2E_BROWSER` to its executable path. CI should omit that variable and
run `npx playwright install chromium` during setup.

The suite intentionally uses serial workers and an isolated fixture namespace:
parallel runs against the same Trilium database would make UI assertions and
cleanup race with one another.

`acceptance.spec.mjs` is the end-to-end acceptance layer. It drives the shipped
`dist` render artifacts from user actions and verifies persisted note content,
labels, relations, branches, YAML/printable browser artifacts, request bodies,
and visible failure/retry states. Its source notes come from
`realistic-fixtures.json`; `weather-response.json` is the recorded service
fixture used for deterministic weather success/retry coverage. The suite
intentionally keeps setup API-only and never uses that shortcut for the behavior
under test.
