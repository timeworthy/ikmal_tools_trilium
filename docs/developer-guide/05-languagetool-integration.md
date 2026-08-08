# LanguageTool Integration & XML Rule Pack Specification

This document records the boundary between **LanguageTool for Trilium**
(`iansherr/languagetool`) and **Ikmal Editor** (`iansherr/ikmal_editor_trilium`).
The LanguageTool package is maintained in the standalone
`trilium_languagetool_plugin` repository and follows LanguageTool's open HTTP
contract. Ikmal Editor remains a separate editor-utility package; it consumes
the LanguageTool package's protected endpoint and adds editor-specific features
without copying its service configuration.

## Related service

Vostego's local quality proxy exposes the LanguageTool-compatible endpoint:

```text
http://127.0.0.1:8096/v2/check
```

It forwards native LanguageTool matches and can add local quality matches while
preserving the LanguageTool response shape. The Trilium LanguageTool plugin
points at that endpoint. Ikmal Editor calls the LanguageTool plugin's protected
Trilium endpoint, so the two packages share one service configuration while
remaining independently installed, enabled, and debugged.

---

## Architecture Overview

```
trilium_languagetool_plugin/
├── src/
│   ├── languagetool-widget.js      # Trilium LanguageTool UI
│   └── languagetool-endpoint.js    # Protected Trilium-to-service bridge
└── trilium-package.json             # Standalone package manifest

vostego-lmlt/
├── quality_proxy.go                 # LanguageTool-compatible local proxy
└── quality_server.go                # Optional local quality sidecar

ikmal_editor_trilium/
├── src/ikmal-editor-widget.js          # Editor UI + Ikmal-local diagnostics
└── src/ikmal-editor.css
```

---

## Ownership

LanguageTool's server, open rule format, Vostego's XML rule pack, and the
quality sidecar belong to the Vostego project. Ikmal Editor consumes the
LanguageTool plugin's protected custom endpoint for full grammar/style analysis
and adds its own writing-surface features. The full LanguageTool package
documentation belongs in `trilium_languagetool_plugin`.
