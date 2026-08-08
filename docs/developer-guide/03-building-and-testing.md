# Building & Testing Suite

## Build Pipeline (`tools/build.mjs`)

The build pipeline compiles TypeScript sources and bundles artifacts using `esbuild`:

```bash
npm run build
```

This performs 3 steps:
1. Compiles `src/engine/` and `src/components/` via TypeScript (`tsconfig.build.json`) to `dist/`.
2. Bundles all declared render and frontend artifacts to `dist/artifacts/` using `esbuild` target ES2020.
3. Computes SRI SHA-256 hashes and updates `trilium-package.json`.

---

## Running Test Suites

Execute all test suites with a single command:

```bash
./tests/run_all.sh
```

### Test Suites Included:
1. **Node Unit & Engine Tests**: `node --test tests/*.test.mjs` (42 tests at the current baseline)
2. **ETAPI Client Tests**: `python3 -m unittest tests/test_etapi.py` (3 tests)
3. **Live Docker Instance E2E Smoke Tests**: `PYTHONPATH=. python3 tests/smoke_test_live_instance.py` (8 tests)

---

## Redeploying to Live Instance

To deploy updated artifacts to a live Trilium instance (`http://127.0.0.1:37840`):

```bash
PYTHONPATH=. python3 tools/deploy_plugin_to_instance.py http://127.0.0.1:37840 ETAPI_TOKEN trilium-package.json
```

For a clean refresh after a package has been substantially reorganized, run
`tools/cleanup_plugin_artifacts.py` first. It archives old package notes and
removes activation labels without deleting user-authored notes.

## Responsive visual verification

The Today page must be checked in a real Trilium renderer after CSS or layout
changes. In particular, verify a narrow note pane around the preferred 22%
split (a 500px Playwright viewport is a useful regression fixture):

1. The auto-fit widget grid is one column when the available pane cannot fit two
   readable cards.
2. The Open Tasks board is contained within its card, with no horizontal
   overflow or partial second column.
3. Task text wraps inside its card.
4. Quick-capture buttons stay one line tall, retain left-aligned labels, and
   remain easy to tap.

The Today page establishes its own container-query boundary because the
standalone file-tree note does not have the workspace dashboard's outer shell.
Keep that boundary when changing the page wrapper; otherwise the narrow-pane
breakpoints will not apply to the standalone page.
