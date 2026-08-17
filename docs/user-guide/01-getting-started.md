# Getting Started with Ikmal Tools for Trilium

Welcome to **Ikmal Tools for Trilium** (`iansherr/ikmal_tools_trilium`) — a component-driven workspace dashboard, template studio, automation engine, and micro-tools suite designed specifically for Trilium Notes.

Ikmal Tools is a separate package, not a fork or bundled copy of Trilium. The Trilium-side
package manager and Plugins settings tab are developed separately in the experimental
[`integration/plugins` branch](https://github.com/iansherr/Trilium/tree/integration/plugins).

---

## Installation

### Method 1: Import via Trilium Package (Recommended)

1. Run Trilium from the separate experimental [`integration/plugins` branch](https://github.com/iansherr/Trilium/tree/integration/plugins).
2. Open **Settings → Plugins**.
3. Add a registry source or the direct manifest URL:
   `https://raw.githubusercontent.com/iansherr/ikmal_tools_trilium/main/trilium-package.json`.
4. Install and enable **Ikmal Tools for Trilium**.
5. Trilium will instantiate the `#packageOwner="iansherr/ikmal_tools_trilium"` container note and its package artifacts.

### Local development install

The Plugins page runs in the browser, so it can load a local package only through a
localhost HTTP URL (for example, a local registry server whose manifest artifact URLs
also point to that server). It cannot fetch a filesystem
path or `file://` URL. For a checkout-to-instance install, use:

```bash
PYTHONPATH=. python3 tools/deploy_plugin_to_instance.py http://127.0.0.1:37840 ETAPI_TOKEN trilium-package.json
```

The local deployer and URL installer use the same package ID and manifest version. The
stored manifest is used when the catalog is unavailable, while a newer remote manifest
can still update the local installation later.

---

## First Launch

Once installed, **Ikmal Tools for Trilium** provides two primary access points:

1. **Workspace Dashboard Note**: Open the **Ikmal Tools: Today Homepage & Workspace Dashboard** render note to access the 3 main tabs:
   - **Today**: Your daily workspace, resizable journal panel, and live productivity widgets.
   - **Template Studio**: Manage note schemas, custom attributes, and If/Then automation rules.
   - **Settings**: Toggle global preferences, manage package options, and export/import YAML specs.

2. **Global Quick Capture Launcher**: Look for the **Ikmal Quick Capture** button in Trilium's top header bar, or press **`Cmd+Shift+K`** (Mac) or **`Ctrl+Shift+K`** (Windows/Linux) anywhere in Trilium.
