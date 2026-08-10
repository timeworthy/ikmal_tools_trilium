"use strict";
(() => {
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
  function findOnThisDay(notes, today = /* @__PURE__ */ new Date()) {
    const month = today.getMonth();
    const day = today.getDate();
    const thisYear = today.getFullYear();
    return notes.map((note) => {
      const created = new Date(note.dateCreated);
      return { note, created };
    }).filter(
      ({ created }) => created.getMonth() === month && created.getDate() === day && created.getFullYear() < thisYear
    ).map(({ note, created }) => ({
      yearsAgo: thisYear - created.getFullYear(),
      noteId: note.noteId,
      title: note.title
    })).sort((a, b) => a.yearsAgo - b.yearsAgo);
  }
  var KNOWN_NEW_MOON_MS = Date.UTC(2e3, 0, 6, 18, 14);

  // src/artifacts/notes-system-on-this-day.jsx
  var WORK_NOTE_QUERY = "#extTask OR #extStoryDraft OR #extMeeting OR #extEmailDraft OR #extScratch OR #extReportingNotes OR #extProjectHub OR #extPerson OR #extOrganization OR #extTopic";
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
  function initIkmalOnThisDay(containerEl) {
    const shell = document.createElement("div");
    shell.className = "notes-system-shell p-3";
    const { card } = section(shell, {
      title: "Ikmal Time Machine (On This Day)",
      description: "Notes and journal entries written on this day in past years."
    });
    function loadEntries() {
      if (typeof api === "undefined" || !api.searchForNotes) {
        const sample = [
          { id: "1", title: "Productivity System Draft", yearsAgo: 1 },
          { id: "2", title: "Architecture Refactoring Notes", yearsAgo: 2 }
        ];
        renderList(sample);
        return;
      }
      api.searchForNotes(WORK_NOTE_QUERY).then((notes) => {
        const summaries = (notes || []).map((n) => ({
          noteId: n.noteId,
          title: n.title || "Untitled",
          dateCreated: timestamp(n, "dateCreated", "utcDateCreated"),
          dateModified: timestamp(n, "dateModified", "utcDateModified")
        }));
        const results = findOnThisDay(summaries, /* @__PURE__ */ new Date());
        renderList(results);
      }).catch(() => {
        renderList([]);
      });
    }
    function renderList(entries) {
      if (!entries.length) {
        card.appendChild(emptyState("No historical notes found from this calendar day in previous years."));
        return;
      }
      for (const entry of entries) {
        card.appendChild(listItem({
          icon: "bx-history",
          title: entry.title,
          description: `${entry.yearsAgo} year${entry.yearsAgo === 1 ? "" : "s"} ago today`,
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
    loadEntries();
  }
  if (typeof api !== "undefined" || typeof window !== "undefined") {
    const init = () => {
      const container = typeof api !== "undefined" && api.$container && (api.$container[0] || api.$container) || document.querySelector(".ikmal-on-this-day-root") || document.body;
      if (container) {
        initIkmalOnThisDay(container);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
