"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/engine/settingsEngine.ts
  var DEFAULT_AUTOMATION_SETTINGS = {
    autoRunIfThenRulesOnCreation: true,
    enableDerivedTopics: true,
    autoJournalClone: true,
    defaultQuickCaptureTemplate: "task",
    staleThresholdDays: 14,
    writingGoalWords: 500
  };
  var SettingsEngine = class {
    constructor(initial) {
      __publicField(this, "settings");
      this.settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...initial };
    }
    get(key) {
      return this.settings[key];
    }
    getAll() {
      return { ...this.settings };
    }
    set(key, value) {
      this.settings[key] = value;
    }
  };

  // src/components/nativeUi.ts
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function section(parent, { title, description, actions, collapsible } = {}) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "ns-section";
    const card = document.createElement("div");
    card.className = "ns-section-card";
    if (title || actions?.length || collapsible) {
      const header = document.createElement("div");
      header.className = "ns-section-header d-flex justify-content-between align-items-center";
      header.innerHTML = `<h4 class="ns-section-title m-0">${escapeHtml(title ?? "")}</h4>`;
      const headerRight = document.createElement("div");
      headerRight.className = "ns-actions d-flex align-items-center gap-2";
      if (actions?.length) {
        actions.forEach((a) => headerRight.appendChild(a));
      }
      if (collapsible) {
        const toggleBtn = iconAction({
          icon: "bx-chevron-up",
          title: "Collapse section",
          onClick: () => {
            const isHidden = card.hidden;
            card.hidden = !isHidden;
            toggleBtn.querySelector("span")?.setAttribute("class", `bx ${card.hidden ? "bx-chevron-down" : "bx-chevron-up"}`);
          }
        });
        headerRight.appendChild(toggleBtn);
      }
      header.appendChild(headerRight);
      sectionEl.appendChild(header);
    }
    if (description) {
      const p = document.createElement("p");
      p.className = "ns-section-description";
      p.textContent = description;
      card.appendChild(p);
    }
    sectionEl.appendChild(card);
    parent.appendChild(sectionEl);
    return { section: sectionEl, card };
  }
  function listItem({ icon, title, description, disabled, actions }) {
    const item = document.createElement("div");
    item.className = `ns-list-item${disabled ? " is-disabled" : ""}`;
    item.innerHTML = `
        <div class="ns-list-item-main">
            ${icon ? `<span class="ns-list-item-icon bx ${escapeHtml(icon)}" aria-hidden="true"></span>` : ""}
            <div>
                <span class="ns-list-item-title">${escapeHtml(title)}</span>
                ${description ? `<div class="ns-list-item-desc">${escapeHtml(description)}</div>` : ""}
            </div>
        </div>
    `;
    if (actions?.length) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "ns-list-item-actions";
      actions.forEach((a) => actionsEl.appendChild(a));
      item.appendChild(actionsEl);
    }
    return item;
  }
  function emptyState(text) {
    const el = document.createElement("div");
    el.className = "ns-empty";
    el.textContent = text;
    return el;
  }
  function bindAsyncClick(button, onClick) {
    button.addEventListener("click", () => {
      try {
        Promise.resolve(onClick()).catch((error) => {
          console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
        });
      } catch (error) {
        console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
      }
    });
  }
  function iconAction({ icon, title, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-action";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = `<span class="bx ${escapeHtml(icon)}"></span>`;
    bindAsyncClick(btn, onClick);
    return btn;
  }
  function showToast(opts, typeArg, durationArg) {
    if (typeof document === "undefined") return;
    const message = typeof opts === "string" ? opts : opts.message;
    const type = typeof opts === "string" ? typeArg || "success" : opts.type || "success";
    const durationMs = typeof opts === "string" ? durationArg ?? 3500 : opts.durationMs ?? 3500;
    const undoAction = typeof opts === "string" ? void 0 : opts.undoAction;
    let container = document.querySelector(".ns-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "ns-toast-container";
      container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 1060; display: flex; flex-direction: column; gap: 8px; max-width: 360px; pointer-events: none;";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    const bgClass = type === "success" ? "bg-success" : type === "warning" ? "bg-warning text-dark" : type === "danger" ? "bg-danger" : "bg-primary";
    const icon = type === "success" ? "bx-check-circle" : type === "warning" ? "bx-error" : type === "danger" ? "bx-x-circle" : "bx-info-circle";
    toast.className = `toast show align-items-center text-white ${bgClass} border-0 shadow-lg`;
    toast.style.cssText = "pointer-events: auto; transition: all 0.3s ease; opacity: 1; transform: translateY(0);";
    toast.innerHTML = `
        <div class="d-flex p-2.5">
            <div class="toast-body d-flex align-items-center gap-2 small">
                <i class="bx ${icon} fs-6"></i>
                <span>${escapeHtml(message)}</span>
                ${undoAction ? `<button type="button" class="btn btn-micro btn-light text-dark ms-2 undo-btn">Undo</button>` : ""}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto close-toast-btn" aria-label="Close"></button>
        </div>
    `;
    if (undoAction) {
      toast.querySelector(".undo-btn")?.addEventListener("click", () => {
        undoAction();
        removeToast();
      });
    }
    const removeToast = () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector(".close-toast-btn")?.addEventListener("click", removeToast);
    container.appendChild(toast);
    if (durationMs > 0) {
      setTimeout(removeToast, durationMs);
    }
  }
  if (typeof window !== "undefined") {
    window.__ikmalToast = showToast;
  }

  // src/engine/noteInsightsEngine.ts
  function findStaleNotes(notes, today = /* @__PURE__ */ new Date(), thresholdDays = 14, closedStatuses = ["done", "cancelled", "complete", "completed", "archived"]) {
    const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
    const nowMs = today.getTime();
    const dayMs = 24 * 60 * 60 * 1e3;
    return notes.filter((note) => !closed.has((note.status ?? "").toLowerCase())).map((note) => ({
      noteId: note.noteId,
      title: note.title,
      daysSinceModified: Math.floor((nowMs - note.dateModified) / dayMs)
    })).filter((n) => n.daysSinceModified >= thresholdDays).sort((a, b) => b.daysSinceModified - a.daysSinceModified);
  }
  var KNOWN_NEW_MOON_MS = Date.UTC(2e3, 0, 6, 18, 14);

  // src/engine/packagePersistence.ts
  var PACKAGE_ID = "iansherr/ikmal_tools_trilium";
  function settingLabelName(key) {
    return `packageSetting:${key}`;
  }
  function triliumApi(explicitApi) {
    const a = explicitApi || globalThis.api;
    return a && typeof a.searchForNotes === "function" ? a : null;
  }
  async function findManifestNote(explicitApi) {
    const api2 = triliumApi(explicitApi);
    if (!api2) return null;
    const notes = await api2.searchForNotes(`#packageOwner="${PACKAGE_ID}" #packageArtifact="manifest"`);
    return notes[0] ?? null;
  }
  function parseStoredBoolean(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "boolean" ? parsed : fallback;
    } catch {
      return raw === "true";
    }
  }
  var memoryStore = /* @__PURE__ */ new Map();
  async function loadAutomationSettings(explicitApi) {
    const note = await findManifestNote(explicitApi);
    const result = { ...DEFAULT_AUTOMATION_SETTINGS };
    for (const key of Object.keys(DEFAULT_AUTOMATION_SETTINGS)) {
      const raw = note ? note.getOwnedLabelValue(settingLabelName(key)) : memoryStore.get(key) ?? null;
      if (raw !== null) {
        const def = DEFAULT_AUTOMATION_SETTINGS[key];
        if (typeof def === "boolean") {
          result[key] = parseStoredBoolean(raw, def);
        } else if (typeof def === "number") {
          const num = Number(raw);
          result[key] = isNaN(num) ? def : num;
        } else {
          result[key] = String(raw);
        }
      }
    }
    return result;
  }

  // src/artifacts/notes-system-stale-notes.jsx
  var WORK_NOTE_QUERY = "#extTask OR #extStoryDraft OR #extMeeting OR #extEmailDraft OR #extScratch OR #extReportingNotes";
  function labelValue(note, name) {
    return note?.getOwnedLabelValue?.(name) ?? note?.getLabelValue?.(name) ?? note?.labels?.find?.((label) => label.name === name)?.value ?? note?.attributes?.find?.((attribute) => attribute.type === "label" && attribute.name === name)?.value ?? "";
  }
  function timestamp(note, field, label) {
    const raw = labelValue(note, label) || note?.[field];
    if (typeof raw === "number") return raw;
    if (typeof raw !== "string") return NaN;
    const parsed = Date.parse(raw.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  function initIkmalStaleNotes(containerEl) {
    const settingsEngine = new SettingsEngine();
    const shell = document.createElement("div");
    shell.className = "notes-system-shell p-3";
    const { card } = section(shell, {
      title: "Ikmal Stale Notes Reviewer",
      description: "Active tasks and drafts untouched for longer than the configured threshold."
    });
    function loadNotes() {
      if (typeof api === "undefined" || !api.searchForNotes) {
        const sample = [
          { id: "1", title: "Untouched Specification Draft", daysSinceModified: 21 },
          { id: "2", title: "Legacy Architecture Review", daysSinceModified: 18 }
        ];
        renderList(sample);
        return;
      }
      const threshold = settingsEngine.get("staleThresholdDays") ?? 14;
      api.searchForNotes(WORK_NOTE_QUERY).then((notes) => {
        const summaries = (notes || []).map((n) => ({
          noteId: n.noteId,
          title: n.title || "Untitled",
          dateCreated: timestamp(n, "dateCreated", "utcDateCreated"),
          dateModified: timestamp(n, "dateModified", "utcDateModified"),
          status: labelValue(n, "status")
        }));
        const stale = findStaleNotes(summaries, /* @__PURE__ */ new Date(), threshold);
        renderList(stale);
      }).catch(() => {
        renderList([]);
      });
    }
    function renderList(stale) {
      if (!stale.length) {
        card.appendChild(emptyState("No stale notes found! All active notes are up to date."));
        return;
      }
      for (const entry of stale.slice(0, 10)) {
        card.appendChild(listItem({
          icon: "bx-time-five",
          title: entry.title,
          description: `Untouched for ${entry.daysSinceModified} days`,
          actions: typeof api !== "undefined" && api.openNote ? [{
            icon: "bx-link-external",
            title: `Open ${entry.title}`,
            onClick: () => api.openNote(entry.noteId)
          }] : []
        }));
      }
    }
    shell.appendChild(card);
    containerEl.appendChild(shell);
    const frontendApi = typeof api !== "undefined" ? api : null;
    loadAutomationSettings(frontendApi).then((loaded) => {
      settingsEngine.set("staleThresholdDays", loaded.staleThresholdDays);
    }).catch((error) => {
      console.warn(`[Ikmal Tools] Stale-note settings could not load: ${error}`);
    }).finally(() => loadNotes());
  }
  if (typeof api !== "undefined" || typeof window !== "undefined") {
    const init = () => {
      const container = typeof api !== "undefined" && api.$container && (api.$container[0] || api.$container) || document.querySelector(".ikmal-stale-notes-root") || document.body;
      if (container) {
        initIkmalStaleNotes(container);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
