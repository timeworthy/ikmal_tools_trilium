# LanguageTool for Trilium: related integration

The full Trilium LanguageTool integration is maintained separately in
[`trilium_languagetool_plugin`](https://github.com/iansherr/trilium_languagetool_plugin).
It is the LanguageTool package for Trilium and follows the open LanguageTool
HTTP response contract used by the companion integrations.

Ikmal Editor is a separate Trilium companion package. It provides the editor
surface—word count, selection tools, duplicate-word diagnostics, inline status,
and LanguageTool-powered underlines—while the LanguageTool package owns the
analysis endpoint and service configuration.

---

## Key Features

1. **LanguageTool package**: Install and configure it from the standalone repository above.
2. **Vostego service**: The local quality proxy is available at `http://127.0.0.1:8096/v2/check`.
3. **Ikmal Editor package**: Install it separately when you want Ikmal's editor affordances and inline analysis.

---

## Local service

For local analysis, use the Vostego application
([`timeworthy/ikmal-editor`](https://github.com/timeworthy/ikmal-editor)). It
manages LanguageTool and the optional local quality sidecar. The Trilium
packages only consume its HTTP contract; they do not install or supervise its
runtime.

---

## Official LanguageTool Documentation References

- **[LanguageTool HTTP Server Specification](https://dev.languagetool.org/http-server)**
- **[LanguageTool Rule Syntax & XML Schema](https://dev.languagetool.org/rule-syntax)**
- **[LanguageTool Developer Overview](https://dev.languagetool.org/development-overview)**
- **[LanguageTool Conciseness & Writing Insights](https://languagetool.org/insights/post/conciseness-in-writing/)**
