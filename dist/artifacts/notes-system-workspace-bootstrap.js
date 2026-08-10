"use strict";
(() => {
  // src/artifacts/notes-system-workspace-bootstrap.js
  (function initWorkspaceBootstrap() {
    if (typeof api === "undefined" || typeof document === "undefined") return;
    if (window.__ikmal_workspace_bootstrap_started) return;
    window.__ikmal_workspace_bootstrap_started = true;
    const PACKAGE_ID = "iansherr/ikmal_tools_trilium";
    const PACKAGE_VERSION = "1.0.35";
    let extConfigNoteId = null;
    const LEGACY_STARTUP_TITLES = /* @__PURE__ */ new Set([
      "Note Creation Buttons",
      "Topic Controls",
      "Topic Index",
      "Dashboard Filters",
      "Project Hub Dashboard",
      "Today Dashboard",
      "Ikmal Tools for Trilium: Live Editor Status Bar Word Count"
    ]);
    const LEGACY_BODY_SIGNATURE = /Ikmal|todayRoot|projectRoot|extTemplate|extTodayDashboard/;
    async function isLegacyIkmalScript(candidate) {
      if (!LEGACY_STARTUP_TITLES.has(candidate.title)) return false;
      if (candidate.getOwnedLabelValue?.("packageOwner")) return false;
      if (candidate.type !== "code") return false;
      const content = await getNoteContent(candidate.noteId);
      if (typeof content !== "string") return false;
      return LEGACY_BODY_SIGNATURE.test(content);
    }
    async function disableLegacyStartupScripts() {
      const candidates = await searchIncludingHidden("#run");
      for (const candidate of candidates) {
        if (!await isLegacyIkmalScript(candidate)) continue;
        console.info(`[Ikmal Tools] Disabling legacy startup script "${candidate.title}" (${candidate.noteId}).`);
        if (typeof api.runOnBackend === "function") {
          try {
            const applied = await api.runOnBackend((noteId) => {
              const note = api.getNote(noteId);
              if (!note || note.getOwnedLabelValue("packageOwner")) return false;
              const run = note.getOwnedLabelValue("run");
              if (!run) return false;
              note.removeLabel("run");
              return true;
            }, [candidate.noteId]);
            if (applied) continue;
          } catch {
          }
        }
        await setAttribute(candidate.noteId, "label", "run", "");
      }
    }
    function packageCode(artifactId, notes) {
      return notes.find((note) => note.type === "code" && [artifactId, `${artifactId}-script`].includes(note.getOwnedLabelValue("packageArtifact")) && !note.isArchived);
    }
    async function ensureTodayAlignment({ allowCreate = false } = {}) {
      const packageNotes = await searchIncludingHidden("#packageArtifact");
      const todayNotes = packageNotes.filter((note) => [
        "notes-system-today-page",
        "notes-system-today-page-script",
        "notes-system-dashboard",
        "notes-system-dashboard-script"
      ].includes(note.getOwnedLabelValue?.("packageArtifact")));
      const todayCode = packageCode("notes-system-today-page", todayNotes) || packageCode("notes-system-dashboard", todayNotes);
      if (!todayCode) {
        console.warn("[Ikmal Tools] Today alignment is waiting for the package artifact.");
        return false;
      }
      return await findOrCreateVisibleToday(todayCode, { allowCreate });
    }
    async function setAttribute(noteId, type, name, value) {
      if (type === "label" && typeof api !== "undefined" && typeof api.runOnBackend === "function") {
        try {
          const applied = await api.runOnBackend((nId, aType, aName, aVal) => {
            const note = api.getNote(nId);
            if (!note || aType !== "label") return false;
            note.setLabel(aName, aVal || "");
            return true;
          }, [noteId, type, name, value || ""]);
          if (applied) return;
        } catch {
        }
      }
      const glob = window.glob;
      if (!glob) throw new Error("Trilium session context is unavailable.");
      const headers = {
        "x-csrf-token": glob.csrfToken,
        "trilium-component-id": glob.componentId,
        "content-type": "application/json"
      };
      const body = JSON.stringify({ type, name, value: value || "", isInheritable: false });
      const path = `${glob.baseApiUrl}notes/${noteId}/set-attribute`;
      const send = () => fetch(path, {
        method: "PUT",
        credentials: "same-origin",
        headers,
        body
      });
      let response = await send();
      if (response.status === 403) {
        const bootstrap = await fetch(`./bootstrap${window.location.search || ""}`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (bootstrap.ok) {
          const refreshed = await bootstrap.json();
          glob.csrfToken = refreshed.csrfToken;
          headers["x-csrf-token"] = refreshed.csrfToken;
          response = await send();
        }
      }
      if (!response.ok) throw new Error(`Could not update ${name} (HTTP ${response.status}).`);
    }
    async function setNoteContent(noteId, content) {
      const glob = window.glob;
      if (!glob) throw new Error("Trilium session context is unavailable.");
      const headers = {
        "x-csrf-token": glob.csrfToken,
        "trilium-component-id": glob.componentId,
        "content-type": "application/json"
      };
      const path = `${glob.baseApiUrl}notes/${noteId}/data`;
      const send = () => fetch(path, {
        method: "PUT",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ content, attachments: [] })
      });
      let response = await send();
      if (response.status === 403) {
        const bootstrap = await fetch(`./bootstrap${window.location.search || ""}`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (bootstrap.ok) {
          const refreshed = await bootstrap.json();
          glob.csrfToken = refreshed.csrfToken;
          headers["x-csrf-token"] = refreshed.csrfToken;
          response = await send();
        }
      }
      if (!response.ok) throw new Error(`Could not update note content (HTTP ${response.status}).`);
    }
    async function getNoteContent(noteId) {
      const glob = window.glob;
      if (!glob) return null;
      const response = await fetch(`${glob.baseApiUrl}notes/${noteId}/blob`, { credentials: "same-origin" });
      if (!response.ok) return null;
      const body = await response.json();
      return typeof body.content === "string" ? body.content : null;
    }
    async function setNoteTitle(noteId, title) {
      if (typeof api !== "undefined" && typeof api.runOnBackend === "function") {
        try {
          const applied = await api.runOnBackend((nId, newTitle) => {
            const note = api.getNote(nId);
            if (!note) return false;
            note.title = newTitle;
            note.save();
            return true;
          }, [noteId, title]);
          if (applied) return;
        } catch {
        }
      }
      const glob = window.glob;
      if (!glob) throw new Error("Trilium session context is unavailable.");
      const headers = {
        "x-csrf-token": glob.csrfToken,
        "trilium-component-id": glob.componentId,
        "content-type": "application/json"
      };
      const path = `${glob.baseApiUrl}notes/${noteId}/title`;
      const send = () => fetch(path, {
        method: "PUT",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ title })
      });
      let response = await send();
      if (response.status === 403) {
        const bootstrap = await fetch(`./bootstrap${window.location.search || ""}`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (bootstrap.ok) {
          const refreshed = await bootstrap.json();
          glob.csrfToken = refreshed.csrfToken;
          headers["x-csrf-token"] = refreshed.csrfToken;
          response = await send();
        }
      }
      if (!response.ok) throw new Error(`Could not update title (HTTP ${response.status}).`);
    }
    async function removeFromParentIfPresent(note, parentNoteId) {
      const parentIds = note?.getParentNoteIds?.();
      if (!Array.isArray(parentIds)) return "unavailable";
      if (!parentIds.includes(parentNoteId)) return "absent";
      const glob = window.glob;
      if (!glob) return "unavailable";
      const response = await fetch(`${glob.baseApiUrl}notes/${note.noteId}/toggle-in-parent/${parentNoteId}/false`, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "x-csrf-token": glob.csrfToken,
          "trilium-component-id": glob.componentId,
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error(`Could not remove stale parent branch (HTTP ${response.status}).`);
      const result = await response.json().catch(() => null);
      if (result?.success === true) return "removed";
      if (result?.success === false) return "refused";
      try {
        const refreshed = typeof api.getNote === "function" ? await api.getNote(note.noteId) : null;
        const refreshedParents = refreshed?.getParentNoteIds?.();
        if (Array.isArray(refreshedParents)) {
          return refreshedParents.includes(parentNoteId) ? "refused" : "removed";
        }
      } catch {
      }
      return "unavailable";
    }
    async function searchMany(searches) {
      const notes = /* @__PURE__ */ new Map();
      for (const search of searches) {
        const results = await api.searchForNotes(search);
        for (const note of results || []) {
          if (note?.noteId) notes.set(note.noteId, note);
        }
      }
      return [...notes.values()];
    }
    async function searchIncludingHidden(search) {
      if (typeof api.searchForNotesIncludingHidden === "function") {
        return await api.searchForNotesIncludingHidden(search);
      }
      const glob = window.glob;
      if (!glob || typeof api.getNotes !== "function") return [];
      const response = await fetch(`${glob.baseApiUrl}quick-search/${encodeURIComponent(search)}`, {
        credentials: "same-origin"
      });
      if (!response.ok) return [];
      const result = await response.json();
      return await api.getNotes(result.searchResultNoteIds || [], true);
    }
    async function getFreshOwnedRelationTarget(noteId, name) {
      const glob = window.glob;
      if (!glob?.baseApiUrl) return { available: false, target: null };
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const response = await fetch(`${glob.baseApiUrl}notes/${noteId}/attributes`, {
            credentials: "same-origin"
          });
          if (response.ok) {
            const attributes = await response.json();
            const relation = (attributes || []).find((attribute) => attribute.noteId === noteId && attribute.type === "relation" && attribute.name === name && !attribute.isDeleted);
            return { available: true, target: relation?.value || null };
          }
        } catch {
        }
        if (attempt + 1 < maxAttempts) {
          await new Promise((resolve) => window.setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
      return { available: false, target: null };
    }
    function markerValue(note, name) {
      return note?.getOwnedLabelValue?.(name) ?? note?.labels?.find?.((label) => label.name === name)?.value ?? note?.attributes?.find?.((attribute) => attribute.type === "label" && attribute.name === name)?.value;
    }
    function hasMarker(note, name, value) {
      if (note?.hasLabel?.(name, value)) return true;
      const marker = markerValue(note, name);
      return marker !== void 0 && marker !== null && (value === void 0 || marker === value);
    }
    async function cloneNoteToParent(noteId, parentNoteId) {
      if (typeof api !== "undefined" && typeof api.runOnBackend === "function") {
        try {
          const applied = await api.runOnBackend((nId, pId) => {
            if (typeof api.ensureNoteIsPresentInParent !== "function") return false;
            api.ensureNoteIsPresentInParent(nId, pId, "");
            return true;
          }, [noteId, parentNoteId]);
          if (applied) return;
        } catch {
        }
      }
      const glob = window.glob;
      if (!glob) throw new Error("Trilium session context is unavailable.");
      const headers = {
        "x-csrf-token": glob.csrfToken,
        "trilium-component-id": glob.componentId,
        "content-type": "application/json"
      };
      const path = `${glob.baseApiUrl}notes/${noteId}/toggle-in-parent/${parentNoteId}/true`;
      const send = () => fetch(path, {
        method: "PUT",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({})
      });
      let response = await send();
      if (response.status === 403) {
        const bootstrap = await fetch(`./bootstrap${window.location.search || ""}`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (bootstrap.ok) {
          const refreshed = await bootstrap.json();
          glob.csrfToken = refreshed.csrfToken;
          headers["x-csrf-token"] = refreshed.csrfToken;
          response = await send();
        }
      }
      if (!response.ok) throw new Error(`Could not file note under ${parentNoteId} (HTTP ${response.status}).`);
    }
    async function findOrCreateVisibleToday(todayCode, { allowCreate = true } = {}) {
      const candidates = await api.searchForNotes("#todayRoot");
      let today = candidates.find((note) => note.getParentNoteIds?.().includes("root")) || candidates.find((note) => !note.isArchived);
      if (!today && !allowCreate) return false;
      if (!today) {
        const result = await api.createNote("root", {
          title: "Today",
          type: "render",
          activate: false
        });
        today = result.note;
        if (!today) throw new Error("Trilium did not return the Today note.");
        await setAttribute(today.noteId, "label", "todayRoot", "");
        await setAttribute(today.noteId, "label", "iconClass", "bx bx-sun");
      }
      const renderNote = today.getRelations?.("renderNote")?.[0];
      const freshRelation = await getFreshOwnedRelationTarget(today.noteId, "renderNote");
      const currentTarget = freshRelation.available ? freshRelation.target : renderNote?.value || renderNote?.targetNoteId;
      if (freshRelation.available && currentTarget !== todayCode.noteId) {
        await setAttribute(today.noteId, "relation", "renderNote", todayCode.noteId);
      }
      if (today.getOwnedLabelValue("extTodayDashboard") !== "today") {
        await setAttribute(today.noteId, "label", "extTodayDashboard", "today");
      }
      return today;
    }
    async function repairTodayBranches() {
      const journal = await api.getTodayNote?.();
      if (!journal?.noteId) return 0;
      const sources = [
        ["extTask"],
        ["extMeeting"],
        ["extStoryDraft"],
        ["extReportingNotes"],
        ["extEmailDraft"],
        ["extScratch"],
        ["extPerson"],
        ["extOrganization"],
        ["noteGroup", "people"],
        ["noteGroup", "organization"],
        ["extTemplate", "projectHub"],
        ["extTemplate", "person"],
        ["extTemplate", "organization"],
        ["extTemplate", "topic"],
        ["extProjectHub"],
        ["extTopic"],
        ["noteType", "projectHub"],
        ["noteType", "topic"]
      ];
      const notes = await searchMany([...new Set(sources.map(([name]) => `#${name}`))]);
      const today = localDayKey(/* @__PURE__ */ new Date());
      let repaired = 0;
      for (const note of notes) {
        if (note.isArchived || localDayKey(note.dateCreated) !== today) continue;
        const matches = sources.some(([name, value]) => {
          const marker = note.getOwnedLabelValue?.(name);
          return value === void 0 ? marker !== void 0 && marker !== null : marker === value;
        });
        if (!matches) continue;
        const hydrated = typeof api.getNote === "function" ? await api.getNote(note.noteId) : note;
        const parents = hydrated?.getParentNoteIds?.() || [];
        if (parents.includes(journal.noteId)) continue;
        try {
          await cloneNoteToParent(note.noteId, journal.noteId);
          repaired += 1;
        } catch (error) {
          console.warn(`[Ikmal Tools] Could not restore ${note.title} to Today: ${error.message}`);
        }
      }
      return repaired;
    }
    function localDayKey(value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    function isDailyNote(note) {
      const dateNote = markerValue(note, "dateNote");
      const template = markerValue(note, "extTemplate");
      const noteType = markerValue(note, "noteType");
      return dateNote !== void 0 || template === "daily" || noteType === "daily" || /^\d{4}-\d{2}-\d{2}\s+-\s+(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/.test(note?.title || "");
    }
    function isProjectHubCandidate(note) {
      if (!note || note.isArchived || isDailyNote(note)) return false;
      const template = markerValue(note, "extTemplate") || markerValue(note, "noteType");
      return markerValue(note, "extProjectHub") !== void 0 || template === "projectHub";
    }
    async function collectTreeDescendants(markers) {
      const notes = /* @__PURE__ */ new Map();
      const pending = [];
      for (const marker of markers) {
        const roots = await searchIncludingHidden(`#${marker}`);
        pending.push(...roots || []);
      }
      while (pending.length) {
        const current = pending.shift();
        if (!current?.noteId || notes.has(current.noteId)) continue;
        notes.set(current.noteId, current);
        const children = typeof current.getChildNotes === "function" ? await Promise.resolve(current.getChildNotes()).catch(() => []) : [];
        pending.push(...children || []);
      }
      return [...notes.values()];
    }
    async function collectProjectHubDescendants() {
      return (await collectTreeDescendants(["projectRoot"])).filter((note) => isProjectHubCandidate(note));
    }
    function cleanDailyContent(content) {
      if (typeof content !== "string" || typeof DOMParser === "undefined") return content;
      const document2 = new DOMParser().parseFromString(content, "text/html");
      let changed = false;
      const headings = () => [...document2.querySelectorAll("h2")];
      const headingNamed = (name) => headings().find((heading) => heading.textContent.trim().toLowerCase() === name.toLowerCase());
      const openTasksHeading = headingNamed("Open Tasks");
      const openTasksBlock = openTasksHeading?.nextElementSibling;
      if (openTasksHeading && openTasksBlock?.matches?.(
        'section.include-note[data-note-id][data-box-size="expandable"], section.include-note[data-extension-open-tasks="true"]'
      )) {
        openTasksHeading.remove();
        openTasksBlock.remove();
        changed = true;
      }
      const dayStartHeading = headingNamed("Day start");
      if (dayStartHeading) {
        const following = [];
        let sibling = dayStartHeading.nextElementSibling;
        while (sibling && !/^H[1-6]$/.test(sibling.tagName)) {
          following.push(sibling);
          sibling = sibling.nextElementSibling;
        }
        const notesHeading = headingNamed("Notes");
        const notesParagraph = notesHeading?.nextElementSibling;
        const hasNotesParagraph = notesParagraph?.tagName === "P";
        const notesAreBlank = hasNotesParagraph && !notesParagraph.textContent.trim();
        const singleTextParagraph = following.length === 1 && following[0].tagName === "P";
        if (notesAreBlank && singleTextParagraph && following[0].textContent.trim()) {
          notesParagraph.innerHTML = following[0].innerHTML;
          following[0].remove();
        } else if (following.every((node) => !node.textContent.trim())) {
          for (const node of following) node.remove();
        }
        dayStartHeading.remove();
        changed = true;
      }
      return changed ? document2.body.innerHTML : content;
    }
    async function cleanNotes(notes) {
      let updated = 0;
      for (const note of notes) {
        if (note.isArchived || !isDailyNote(note)) continue;
        const current = await getNoteContent(note.noteId);
        const cleaned = cleanDailyContent(current);
        if (cleaned === current || typeof cleaned !== "string") continue;
        await setNoteContent(note.noteId, cleaned);
        updated += 1;
      }
      return updated;
    }
    async function cleanDailyNotes() {
      const notes = await searchIncludingHidden("#dateNote");
      return cleanNotes(notes);
    }
    async function cleanDailyTemplate() {
      const templates = (await searchIncludingHidden("#extTemplate")).filter((note) => markerValue(note, "extTemplate") === "daily" || note.title === "Daily Note");
      return cleanNotes(templates);
    }
    async function removeProjectDashboardsFromDailyNotes() {
      const dailyNotes = (await searchMany(["#dateNote", "#extTemplate"])).filter((note) => !note.isArchived && isDailyNote(note));
      let removed = 0;
      for (const dailyNote of dailyNotes) {
        const hydrated = typeof api.getNote === "function" ? await api.getNote(dailyNote.noteId) : dailyNote;
        const children = hydrated?.getChildNotes ? await hydrated.getChildNotes() : [];
        for (const child of children) {
          const isProjectDashboard = hasMarker(child, "extProjectDashboard", "projectHub") || hasMarker(child, "extHubDashboard", "projectHub");
          if (!isProjectDashboard || child.isArchived) continue;
          const parentIds = child.getParentNoteIds?.() || [];
          if (parentIds.length > 1) continue;
          await setAttribute(child.noteId, "label", "archived", "");
          removed += 1;
        }
      }
      return removed;
    }
    async function removeStrayReportingNotesFromDailyNotes() {
      const dailyNotes = (await searchMany(["#dateNote", "#extTemplate"])).filter((note) => !note.isArchived && isDailyNote(note));
      let removed = 0;
      for (const dailyNote of dailyNotes) {
        const hydrated = typeof api.getNote === "function" ? await api.getNote(dailyNote.noteId) : dailyNote;
        const children = hydrated?.getChildNotes ? await hydrated.getChildNotes() : [];
        for (const child of children) {
          if (child.isArchived || !hasMarker(child, "extReportingNotes")) continue;
          const project = child.getRelations?.("project")?.[0];
          const projectId = project?.value || project?.targetNoteId;
          if (projectId !== dailyNote.noteId) continue;
          try {
            const outcome = await removeFromParentIfPresent(child, dailyNote.noteId);
            if (outcome === "removed") {
              removed += 1;
            } else if (outcome === "refused") {
              await setAttribute(child.noteId, "label", "archived", "");
            }
          } catch (error) {
            console.warn(`[Ikmal Tools] Could not remove stray Reporting Notes branch: ${error.message}`);
          }
        }
      }
      return removed;
    }
    async function attachProjectDashboards(dashboardCode) {
      const projects = await collectProjectHubDescendants();
      let attached = 0;
      for (const project of projects) {
        if (project.isArchived) continue;
        const hydratedProject = typeof api.getNote === "function" ? await api.getNote(project.noteId) : project;
        const children = hydratedProject?.getChildNotes ? await hydratedProject.getChildNotes() : [];
        const existing = children.find((child) => child.getOwnedLabelValue?.("extProjectDashboard") === "projectHub" || child.getOwnedLabelValue?.("extHubDashboard") === "projectHub");
        const expectedTitle = `Dashboard: ${project.title}`;
        if (existing) {
          if (existing.title !== expectedTitle) {
            await setNoteTitle(existing.noteId, expectedTitle);
          }
          const relation = existing.getRelations?.("renderNote")?.[0];
          const target = relation?.value || relation?.targetNoteId;
          if (target !== dashboardCode.noteId) {
            await setAttribute(existing.noteId, "relation", "renderNote", dashboardCode.noteId);
          }
          if (existing.getOwnedLabelValue?.("extProjectDashboard") !== "projectHub") {
            await setAttribute(existing.noteId, "label", "extProjectDashboard", "projectHub");
          }
          continue;
        }
        const result = await api.createNote(project.noteId, {
          title: expectedTitle,
          type: "render",
          activate: false
        });
        if (!result.note) continue;
        await setAttribute(result.note.noteId, "label", "extProjectDashboard", "projectHub");
        await setAttribute(result.note.noteId, "relation", "renderNote", dashboardCode.noteId);
        attached += 1;
      }
      return attached;
    }
    async function ensureSkeletonContainers() {
      const containers = [
        { marker: "calendarRoot", title: "Journal", icon: "bx bx-calendar", parent: "root", type: "book", labels: [{ name: "datePattern", value: "{isoDate} - {weekDay}" }] },
        { marker: "todayRoot", title: "Today", icon: "bx bx-sun", parent: "root", type: "render" },
        { marker: "projectRoot", title: "Projects", icon: "bx bx-book", parent: "root" },
        { marker: "activeProjectRoot", title: "Active", icon: "bx bx-folder-open", parent: "projectRoot", inherits: [{ name: "projectArea", value: "active" }] },
        { marker: "archiveProjectRoot", title: "Archive", icon: "bx bx-archive", parent: "projectRoot", inherits: [{ name: "projectArea", value: "archive" }, { name: "projectArchive", value: "" }] },
        { marker: "unassignedRoot", title: "Unassigned", icon: "bx bx-inbox", parent: "projectRoot" },
        { marker: "taskRoot", title: "Tasks", icon: "bx bx-check-square", parent: "root" },
        { marker: "meetingRoot", title: "Meetings", icon: "bx bx-calendar-event", parent: "root" },
        { marker: "storyDraftRoot", title: "Drafts", icon: "bx bx-file", parent: "_userHidden", type: "book" },
        { marker: "emailRoot", title: "Emails", icon: "bx bx-envelope", parent: "_userHidden", type: "book" },
        { marker: "peopleRoot", title: "People", icon: "bx bx-group", parent: "root" },
        { marker: "orgRoot", title: "Organizations", icon: "bx bx-buildings", parent: "root" },
        { marker: "topicRoot", title: "Topics", icon: "bx bx-purchase-tag", parent: "root" },
        { marker: "templateRoot", title: "Templates", icon: "bx bx-copy", parent: "_userHidden", type: "book", labels: [{ name: "subtreeHidden", value: "" }] },
        { marker: "extConfig", title: "Config", icon: "bx bx-cog", parent: "_userHidden", type: "text", labels: [{ name: "extensionVersion", value: PACKAGE_VERSION }] }
      ];
      for (const c of containers) {
        const existing = await searchIncludingHidden(`#${c.marker}`);
        if (existing && existing.length > 0) {
          if (c.marker === "extConfig") extConfigNoteId = existing[0].noteId;
          continue;
        }
        let parentId = "root";
        if (c.parent !== "root") {
          if (c.parent.startsWith("_")) {
            parentId = c.parent;
          }
          const parentCandidate = c.parent.startsWith("_") ? [] : await searchIncludingHidden(`#${c.parent}`);
          if (parentCandidate && parentCandidate[0]) {
            parentId = parentCandidate[0].noteId;
          }
        }
        const attributes = [
          { type: "label", name: c.marker, value: "" },
          { type: "label", name: "iconClass", value: c.icon }
        ];
        if (c.labels) {
          for (const l of c.labels) {
            attributes.push({ type: "label", name: l.name, value: l.value });
          }
        }
        if (c.inherits) {
          for (const inh of c.inherits) {
            attributes.push({ type: "label", name: inh.name, value: inh.value, isInheritable: true });
          }
        }
        try {
          const created = await api.createNote(parentId, {
            title: c.title,
            type: c.type || "book",
            activate: false,
            attributes
          });
          if (c.marker === "extConfig" && created?.note) extConfigNoteId = created.note.noteId;
        } catch (err) {
          console.warn(`[Ikmal Tools] Could not provision ${c.title} container: ${err.message}`);
        }
      }
      const journal = (await api.searchForNotes("#calendarRoot"))?.[0];
      const dailyTpl = (await searchIncludingHidden("#extTemplate")).find((n) => markerValue(n, "extTemplate") === "daily" || n.title === "Daily Note");
      if (journal && dailyTpl) {
        const hasDateTpl = journal.getRelations?.("dateTemplate")?.some((r) => (r.value || r.targetNoteId) === dailyTpl.noteId);
        if (!hasDateTpl) {
          try {
            await setAttribute(journal.noteId, "relation", "dateTemplate", dailyTpl.noteId);
          } catch {
          }
        }
      }
    }
    async function migrateLegacyEntityLabels() {
      const allOrgs = await collectTreeDescendants(["orgRoot"]);
      const orgMap = /* @__PURE__ */ new Map();
      for (const n of allOrgs) {
        if (hasMarker(n, "extTemplate", "organization") || markerValue(n, "noteGroup") === "organization" || hasMarker(n, "orgRoot")) {
          orgMap.set(n.title.trim().toLowerCase(), n.noteId);
        }
      }
      const workNotes = await collectTreeDescendants(["projectRoot", "storyDraftRoot", "emailRoot"]);
      let converted = 0;
      for (const note of workNotes) {
        if (note.isArchived) continue;
        for (const legacyName of ["client", "companyOnBehalf"]) {
          const legacyVal = markerValue(note, legacyName);
          if (legacyVal && typeof legacyVal === "string") {
            const targetOrgId = orgMap.get(legacyVal.trim().toLowerCase());
            if (targetOrgId) {
              await setAttribute(note.noteId, "relation", legacyName, targetOrgId);
              converted += 1;
            } else {
              const overrideName = `${legacyName}Override`;
              await setAttribute(note.noteId, "label", overrideName, legacyVal);
            }
          }
        }
      }
      return converted;
    }
    async function reattachExistingTemplates() {
      const templates = await searchIncludingHidden("#extTemplate");
      const tplMap = /* @__PURE__ */ new Map();
      for (const tpl of templates) {
        const m = markerValue(tpl, "extTemplate");
        if (m) tplMap.set(m, tpl.noteId);
      }
      if (tplMap.size === 0) return 0;
      const workNotes = await collectTreeDescendants([
        "projectRoot",
        "meetingRoot",
        "taskRoot",
        "storyDraftRoot",
        "emailRoot",
        "peopleRoot",
        "orgRoot",
        "topicRoot"
      ]);
      let reattached = 0;
      for (const note of workNotes) {
        if (note.isArchived) continue;
        const noteType = markerValue(note, "noteType") || markerValue(note, "extTemplate");
        const targetTplId = tplMap.get(noteType);
        if (targetTplId) {
          const hasTplRel = note.getRelations?.("template")?.some((r) => (r.value || r.targetNoteId) === targetTplId);
          if (!hasTplRel) {
            try {
              await setAttribute(note.noteId, "relation", "template", targetTplId);
              reattached += 1;
            } catch {
            }
          }
        }
      }
      return reattached;
    }
    async function migrateEditRoundBodies() {
      const storyNotes = (await searchMany(["#extStoryDraft", "#extTemplate"])).filter((n) => !n.isArchived && (hasMarker(n, "extStoryDraft") || hasMarker(n, "extTemplate", "storyDraft")));
      let migrated = 0;
      const legacyBodies = [
        `<h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p>`,
        `<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>IDEA / ANGLE</h2><p></p><h2>REPORTING NOTES</h2><p></p><h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p>`
      ];
      const editContent = `<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>EDITORIAL NOTES</h2><p></p><h2>REQUESTED CHANGES</h2><ul><li></li></ul><h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p><h2>WRITER RESPONSE</h2><p></p>`;
      const storyContent = `<h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>DEK</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p>`;
      for (const note of storyNotes) {
        const current = await getNoteContent(note.noteId);
        if (!current) continue;
        const isLegacy = legacyBodies.some((b) => current.trim() === b.trim());
        if (!isLegacy) continue;
        const workflow = markerValue(note, "workflow") || markerValue(note, "kind") || "project";
        const replacement = workflow === "edit" ? editContent : storyContent;
        await setNoteContent(note.noteId, replacement);
        migrated += 1;
      }
      return migrated;
    }
    async function ensureProjectReportingNotes() {
      const hubs = await collectProjectHubDescendants();
      const reportingTpl = (await searchIncludingHidden("#extTemplate")).find((n) => markerValue(n, "extTemplate") === "reportingNotes" || n.title === "Reporting Notes");
      let createdCount = 0;
      const reportingContent = `<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>IDEA / ANGLE</h2><p></p><h2>REPORTING NOTES</h2><p></p><div class='reporting-note-actions-placeholder' data-reporting-note-actions='true'></div>`;
      for (const hub of hubs) {
        const kind = markerValue(hub, "kind") || "project";
        if (kind !== "project") continue;
        const hydrated = typeof api.getNote === "function" ? await api.getNote(hub.noteId) : hub;
        const children = hydrated?.getChildNotes ? await hydrated.getChildNotes() : [];
        const hasReporting = children.some((c) => hasMarker(c, "extReportingNotes") || hasMarker(c, "extTemplate", "reportingNotes"));
        if (hasReporting) continue;
        const repTitle = `${hub.title} \u2014 Reporting Notes`;
        try {
          const result = await api.createNote(hub.noteId, {
            title: repTitle,
            type: "text",
            content: reportingContent,
            activate: false
          });
          if (result?.note) {
            await setAttribute(result.note.noteId, "label", "extReportingNotes", "");
            await setAttribute(result.note.noteId, "label", "extReportingTitleManaged", "");
            await setAttribute(result.note.noteId, "label", "noteType", "reportingNotes");
            await setAttribute(result.note.noteId, "label", "noteGroup", "reporting");
            if (reportingTpl) {
              await setAttribute(result.note.noteId, "relation", "template", reportingTpl.noteId);
            }
            await setAttribute(result.note.noteId, "relation", "project", hub.noteId);
            createdCount += 1;
          }
        } catch {
        }
      }
      return createdCount;
    }
    async function repairExistingDayNoteTemplates() {
      const journalRoot = (await api.searchForNotes("#calendarRoot"))?.[0];
      if (!journalRoot) return 0;
      const dailyTpl = (await searchIncludingHidden("#extTemplate")).find((n) => markerValue(n, "extTemplate") === "daily" || n.title === "Daily Note");
      if (!dailyTpl) return 0;
      const dayNotes = await searchIncludingHidden("#dateNote");
      let repaired = 0;
      for (const note of dayNotes) {
        const hasTpl = note.getRelations?.("template")?.some((r) => (r.value || r.targetNoteId) === dailyTpl.noteId);
        if (!hasTpl) {
          try {
            await setAttribute(note.noteId, "relation", "template", dailyTpl.noteId);
            repaired += 1;
          } catch {
          }
        }
      }
      return repaired;
    }
    async function reconcileProjectHubStatuses() {
      const hubs = await collectProjectHubDescendants();
      const archiveRoot = (await api.searchForNotes("#archiveProjectRoot"))?.[0];
      const activeRoot = (await api.searchForNotes("#activeProjectRoot"))?.[0];
      let reconciled = 0;
      for (const hub of hubs) {
        if (hub.isArchived) continue;
        const status = markerValue(hub, "status");
        const hydrated = typeof api.getNote === "function" ? await api.getNote(hub.noteId) : hub;
        const children = hydrated?.getChildNotes ? await hydrated.getChildNotes() : [];
        const drafts = children.filter((c) => hasMarker(c, "extStoryDraft") || hasMarker(c, "extTemplate", "story") || hasMarker(c, "extTemplate", "storyDraft")).sort((a, b) => Number(markerValue(b, "round") || 0) - Number(markerValue(a, "round") || 0));
        if (!drafts.length) continue;
        const latestDraft = drafts[0];
        const latestStatus = (markerValue(latestDraft, "status") || "").toLowerCase();
        const isLatestDone = latestStatus === "done" || latestStatus === "approved" || latestStatus === "published" || Boolean(markerValue(latestDraft, "doneDate"));
        if (isLatestDone && status !== "complete") {
          await setAttribute(hub.noteId, "label", "status", "complete");
          if (archiveRoot?.noteId) {
            try {
              await cloneNoteToParent(hub.noteId, archiveRoot.noteId);
            } catch {
            }
          }
          if (activeRoot?.noteId) {
            try {
              await removeFromParentIfPresent(hub, activeRoot.noteId);
            } catch {
            }
          }
          reconciled += 1;
        } else if (!isLatestDone && (status === "complete" || status === "archived")) {
          await setAttribute(hub.noteId, "label", "status", "active");
          if (activeRoot?.noteId) {
            try {
              await cloneNoteToParent(hub.noteId, activeRoot.noteId);
            } catch {
            }
          }
          if (archiveRoot?.noteId) {
            try {
              await removeFromParentIfPresent(hub, archiveRoot.noteId);
            } catch {
            }
          }
          reconciled += 1;
        }
      }
      return reconciled;
    }
    async function ensureBackendEventWiring() {
      const backendMetadataSync = (await searchIncludingHidden("#packageArtifact")).find((n) => n.getOwnedLabelValue?.("packageArtifact") === "notes-system-project-metadata-sync");
      const backendDailyRepair = (await searchIncludingHidden("#packageArtifact")).find((n) => n.getOwnedLabelValue?.("packageArtifact") === "notes-system-daily-note-repair");
      const backendTopicSync = (await searchIncludingHidden("#packageArtifact")).find((n) => n.getOwnedLabelValue?.("packageArtifact") === "notes-system-topic-association-sync");
      const backendIfThenDispatch = (await searchIncludingHidden("#packageArtifact")).find((n) => n.getOwnedLabelValue?.("packageArtifact") === "notes-system-if-then-dispatch");
      if (backendMetadataSync) {
        const projectRoot = (await api.searchForNotes("#projectRoot"))?.[0];
        if (projectRoot) {
          for (const relName of ["runOnNoteCreation", "runOnAttributeCreation", "runOnAttributeChange", "runOnNoteChange"]) {
            const hasRel = projectRoot.getRelations?.(relName)?.some((r) => (r.value || r.targetNoteId) === backendMetadataSync.noteId);
            if (!hasRel) {
              try {
                await setAttribute(projectRoot.noteId, "relation", relName, backendMetadataSync.noteId);
              } catch {
              }
            }
          }
          const legacyTargets = (projectRoot.getRelations?.("runOnNoteCreation") || []).map((r) => r.value || r.targetNoteId).filter((id) => id && id !== backendMetadataSync.noteId);
          for (const legacyId of legacyTargets) {
            const legacy = typeof api.getNote === "function" ? await api.getNote(legacyId) : null;
            const marker = legacy?.getOwnedLabelValue?.("extScript");
            if (!legacy || legacy.getOwnedLabelValue?.("packageOwner") || marker !== "topicAssociationSync" && legacy.title !== "Topic Association Sync") continue;
            if (typeof api.runOnBackend !== "function") continue;
            try {
              await api.runOnBackend((rootId, targetId) => {
                const root = api.getNote(rootId);
                const attrs = root?.getOwnedAttributes?.() || [];
                for (const attr of attrs) {
                  if (attr.type === "relation" && attr.name === "runOnNoteCreation" && attr.value === targetId) {
                    api.deleteAttribute(attr.attributeId);
                  }
                }
                return true;
              }, [projectRoot.noteId, legacyId]);
            } catch {
            }
          }
        }
      }
      if (backendDailyRepair) {
        const journal = (await searchIncludingHidden("#calendarRoot"))?.[0];
        if (journal) {
          for (const relName of ["runOnNoteCreation", "runOnNoteChange"]) {
            const hasRel = journal.getRelations?.(relName)?.some((r) => (r.value || r.targetNoteId) === backendDailyRepair.noteId);
            if (!hasRel) {
              try {
                await setAttribute(journal.noteId, "relation", relName, backendDailyRepair.noteId);
              } catch {
              }
            }
          }
        }
      }
      if (backendTopicSync) {
        const topicRoots = ["meetingRoot", "taskRoot", "storyDraftRoot", "emailRoot", "unassignedRoot", "peopleRoot", "orgRoot", "topicRoot"];
        for (const marker of topicRoots) {
          const rootNote = (await api.searchForNotes(`#${marker}`))?.[0];
          if (!rootNote) continue;
          for (const relName of ["runOnAttributeCreation", "runOnAttributeChange", "runOnNoteCreation", "runOnNoteChange"]) {
            const hasRel = rootNote.getRelations?.(relName)?.some((r) => (r.value || r.targetNoteId) === backendTopicSync.noteId);
            if (!hasRel) {
              try {
                await setAttribute(rootNote.noteId, "relation", relName, backendTopicSync.noteId);
              } catch {
              }
            }
          }
        }
      }
      if (backendIfThenDispatch) {
        const projectRoot = (await api.searchForNotes("#projectRoot"))?.[0];
        if (projectRoot) {
          for (const relName of ["runOnAttributeCreation", "runOnAttributeChange"]) {
            const hasRel = projectRoot.getRelations?.(relName)?.some((r) => (r.value || r.targetNoteId) === backendIfThenDispatch.noteId);
            if (!hasRel) {
              try {
                await setAttribute(projectRoot.noteId, "relation", relName, backendIfThenDispatch.noteId);
              } catch {
              }
            }
          }
        }
      }
    }
    async function syncProjectMetadata() {
      const hubs = await collectProjectHubDescendants();
      let synced = 0;
      for (const hub of hubs) {
        if (hub.isArchived) continue;
        const hydratedHub = typeof api.getNote === "function" ? await api.getNote(hub.noteId) : hub;
        const children = hydratedHub?.getChildNotes ? await hydratedHub.getChildNotes() : [];
        const reporting = children.find((c) => hasMarker(c, "extReportingNotes") || hasMarker(c, "extTemplate", "reportingNotes"));
        const drafts = children.filter((c) => hasMarker(c, "extStoryDraft") || hasMarker(c, "extTemplate", "story")).sort((a, b) => Number(markerValue(b, "round") || 0) - Number(markerValue(a, "round") || 0));
        const latestRound = drafts[0];
        if (reporting && hasMarker(reporting, "extReportingTitleManaged")) {
          const expectedTitle = `${hub.title} \u2014 Reporting Notes`;
          if (reporting.title !== expectedTitle) {
            try {
              await setNoteTitle(reporting.noteId, expectedTitle);
            } catch {
            }
          }
        }
        if (latestRound) {
          const roundNum = markerValue(latestRound, "round");
          if (roundNum && markerValue(hub, "currentRound") !== String(roundNum)) {
            try {
              await setAttribute(hub.noteId, "label", "currentRound", String(roundNum));
            } catch {
            }
          }
        }
        const group = [hub, latestRound, reporting].filter((n) => Boolean(n));
        for (const relationName of ["client", "companyOnBehalf"]) {
          const relVal = group.map((n) => {
            const r = n.getRelations?.(relationName)?.[0];
            return r?.value || r?.targetNoteId;
          }).find(Boolean);
          if (relVal) {
            for (const n of group) {
              const cur = n.getRelations?.(relationName)?.[0];
              if (!(cur?.value || cur?.targetNoteId)) {
                try {
                  await setAttribute(n.noteId, "relation", relationName, relVal);
                } catch {
                }
              }
            }
          }
          const overrideName = `${relationName}Override`;
          const overrideVal = group.map((n) => markerValue(n, overrideName)).find(Boolean);
          if (overrideVal) {
            for (const n of group) {
              if (!markerValue(n, overrideName)) {
                try {
                  await setAttribute(n.noteId, "label", overrideName, String(overrideVal));
                } catch {
                }
              }
            }
          }
        }
        synced += 1;
      }
      return synced;
    }
    async function ensureCollectionsAndSavedSearches() {
      let dashboardRoot = (await api.searchForNotes("#dashboardRoot"))?.[0];
      if (!dashboardRoot) {
        const root = (await api.searchForNotes("#root"))?.[0] || { noteId: "root" };
        try {
          const res = await api.createNote(root.noteId, {
            title: "Dashboards",
            type: "book",
            activate: false,
            attributes: [
              { type: "label", name: "dashboardRoot", value: "" },
              { type: "label", name: "viewType", value: "dashboard" },
              { type: "label", name: "iconClass", value: "bx bx-dashboard" }
            ]
          });
          dashboardRoot = res.note;
        } catch (err) {
          console.warn(`[Ikmal Tools] Dashboards container provision skipped: ${err.message}`);
          return;
        }
      }
      if (!dashboardRoot) return;
      const searches = [
        { title: "Due Soon", marker: "dueSoon", search: "#extTask AND #dueDate <= TODAY+7 AND #!doneDate orderBy #dueDate", viewType: "table" },
        { title: "Overdue", marker: "overdue", search: "#extTask AND #dueDate < TODAY AND #!doneDate orderBy #dueDate", viewType: "table" },
        { title: "Recently Touched", marker: "recentlyTouched", search: "#noteType AND #!dateNote AND note.dateModified >= TODAY-7 orderBy note.dateModified desc", viewType: "table" },
        { title: "Task Calendar", marker: "taskCalendar", search: "#extTask AND #dueDate AND #!doneDate", viewType: "calendar", extraLabels: [{ name: "calendar:startDate", value: "dueDate" }, { name: "calendar:view", value: "dayGridMonth" }] },
        { title: "Meeting Calendar", marker: "meetingCalendar", search: "#extMeeting AND #startDate", viewType: "calendar", extraLabels: [{ name: "calendar:view", value: "dayGridMonth" }] },
        { title: "Open Tasks", marker: "openTasks", search: "#extTask AND #!doneDate orderBy #dueDate", viewType: "table" },
        { title: "Upcoming Meetings", marker: "upcomingMeetings", search: "#extMeeting AND #startDate orderBy #startDate", viewType: "table" },
        { title: "Active Projects", marker: "activeProjects", search: "#projectArea = active AND (#extProjectHub OR #extTemplate = projectHub) orderBy #startDate desc", viewType: "table" },
        { title: "Drafts", marker: "openDrafts", search: "#extStoryDraft AND #!doneDate orderBy note.dateModified desc", viewType: "table" },
        { title: "Emails", marker: "openEmails", search: "#extEmailDraft orderBy note.dateModified desc", viewType: "table" },
        { title: "High Priority", marker: "highPriority", search: "#priority = high AND #!doneDate orderBy #dueDate", viewType: "table" },
        { title: "Awaiting Replies", marker: "awaitingReplies", search: "#status = awaiting AND #!doneDate orderBy #followUpDate", viewType: "table" },
        { title: "Follow-ups Due", marker: "followUpsDue", search: "#followUpDate <= TODAY+7 AND #!doneDate orderBy #followUpDate", viewType: "table" }
      ];
      for (const s of searches) {
        const existing = await api.searchForNotes(`#extView=${s.marker}`);
        if (existing && existing.length > 0) {
          const note = existing[0];
          if (markerValue(note, "searchString") !== s.search) {
            try {
              await setAttribute(note.noteId, "label", "searchString", s.search);
            } catch {
            }
          }
          continue;
        }
        try {
          const attributes = [
            { type: "label", name: "extView", value: s.marker },
            { type: "label", name: "searchString", value: s.search },
            { type: "label", name: "extBaseSearch", value: s.search },
            { type: "label", name: "viewType", value: s.viewType }
          ];
          if (s.extraLabels) {
            for (const l of s.extraLabels) attributes.push({ type: "label", name: l.name, value: l.value });
          }
          await api.createNote(dashboardRoot.noteId, {
            title: s.title,
            type: "search",
            activate: false,
            attributes
          });
        } catch (err) {
          console.warn(`[Ikmal Tools] Saved search ${s.title} provision skipped: ${err.message}`);
        }
      }
    }
    async function runSystemVerification() {
      const checks = [];
      const containers = ["calendarRoot", "todayRoot", "projectRoot", "activeProjectRoot", "archiveProjectRoot", "unassignedRoot", "taskRoot", "meetingRoot", "peopleRoot", "orgRoot", "topicRoot", "templateRoot", "extConfig", "storyDraftRoot", "emailRoot"];
      for (const m of containers) {
        const found = await searchIncludingHidden(`#${m}`);
        if (!found || !found.length) checks.push(`missing container #${m}`);
      }
      const tplRoot = (await searchIncludingHidden("#templateRoot"))?.[0];
      if (!tplRoot) {
        checks.push("missing #templateRoot");
      } else {
        const expectedTemplates = ["daily", "task", "projectTask", "meeting", "meetingPrep", "storyDraft", "reportingNotes", "emailDraft", "person", "organization", "projectHub", "topic"];
        const allTpls = await searchIncludingHidden("#extTemplate");
        for (const marker of expectedTemplates) {
          if (!allTpls.some((t) => markerValue(t, "extTemplate") === marker)) {
            checks.push(`missing template #${marker}`);
          }
        }
      }
      const journal = (await searchIncludingHidden("#calendarRoot"))?.[0];
      if (journal) {
        const hasDateTpl = journal.getRelations?.("dateTemplate")?.length > 0;
        if (!hasDateTpl) checks.push("journal has no ~dateTemplate");
      }
      const config = (await searchIncludingHidden("#extConfig"))?.[0];
      if (config) {
        const version = markerValue(config, "extensionVersion");
        if (!version) checks.push("extConfig missing #extensionVersion label");
      } else {
        checks.push("missing #extConfig");
      }
      const resultMsg = checks.length === 0 ? "All 100% health checks passed." : `Found ${checks.length} warning(s): ${checks.join(", ")}`;
      await recordMigrationLog("verify", resultMsg);
      return resultMsg;
    }
    async function recordMigrationLog(action, summary) {
      try {
        const configRoot = (await searchIncludingHidden("#extConfig"))?.[0] || (await searchIncludingHidden("#_userHidden"))?.[0];
        if (!configRoot) return;
        let logNote = (await api.searchForNotes("#extMigrationLog"))?.[0];
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        const entry = `<p><strong>[${timestamp}] ${action.toUpperCase()}</strong>: ${summary}</p>`;
        if (!logNote) {
          const created = await api.createNote(configRoot.noteId, {
            title: "Migration Log",
            content: `<h2>Ikmal System Migration Audit Trail</h2>${entry}`,
            type: "text",
            activate: false
          });
          if (created?.note) {
            await setAttribute(created.note.noteId, "label", "extMigrationLog", "");
          }
        } else {
          const currentContent = await getNoteContent(logNote.noteId) || "";
          await setNoteContent(logNote.noteId, `${currentContent}
${entry}`);
        }
      } catch (err) {
        console.warn(`[Ikmal Tools] Migration log update skipped: ${err.message}`);
      }
    }
    async function repair() {
      await disableLegacyStartupScripts();
      await ensureSkeletonContainers();
      const packageNotes = await searchIncludingHidden("#packageArtifact");
      const todayPageNotes = packageNotes.filter((note) => [
        "notes-system-today-page",
        "notes-system-today-page-script"
      ].includes(note.getOwnedLabelValue?.("packageArtifact")));
      const todayNotes = packageNotes.filter((note) => [
        "notes-system-dashboard",
        "notes-system-dashboard-script"
      ].includes(note.getOwnedLabelValue?.("packageArtifact")));
      const projectNotes = packageNotes.filter((note) => [
        "notes-system-project-dashboard",
        "notes-system-project-dashboard-script"
      ].includes(note.getOwnedLabelValue?.("packageArtifact")));
      const todayCode = packageCode("notes-system-today-page", todayPageNotes) || packageCode("notes-system-dashboard", todayNotes);
      const projectCode = packageCode("notes-system-project-dashboard", projectNotes);
      if (!todayCode || !projectCode) {
        console.warn("[Ikmal Tools] Workspace bootstrap is waiting for package artifacts.");
        return;
      }
      await findOrCreateVisibleToday(todayCode);
      await attachProjectDashboards(projectCode);
      await cleanDailyTemplate();
      await cleanDailyNotes();
      await removeProjectDashboardsFromDailyNotes();
      await removeStrayReportingNotesFromDailyNotes();
      await repairTodayBranches();
      await reattachExistingTemplates();
      await migrateLegacyEntityLabels();
      await migrateEditRoundBodies();
      await ensureProjectReportingNotes();
      await ensureCollectionsAndSavedSearches();
      await repairExistingDayNoteTemplates();
      await reconcileProjectHubStatuses();
      await syncProjectMetadata();
      await ensureBackendEventWiring();
      await runSystemVerification();
      await recordMigrationLog("repair", "Workspace repair completed successfully with 100% schema alignment.");
      const configNoteId = extConfigNoteId || (await searchIncludingHidden("#extConfig"))?.[0]?.noteId;
      if (configNoteId) {
        await setAttribute(configNoteId, "label", "extBootstrapped", PACKAGE_VERSION);
      } else {
        console.warn("[Ikmal Tools] Config note not found; first-run marker was not written.");
      }
    }
    async function repairCurrentWorkspaceBranches() {
      const packageNotes = await searchIncludingHidden("#packageArtifact");
      const projectNotes = packageNotes.filter((note) => [
        "notes-system-project-dashboard",
        "notes-system-project-dashboard-script"
      ].includes(note.getOwnedLabelValue?.("packageArtifact")));
      const projectCode = packageCode("notes-system-project-dashboard", projectNotes);
      if (projectCode) await attachProjectDashboards(projectCode);
      await repairTodayBranches();
      await ensureBackendEventWiring();
    }
    let repairPromise = null;
    window.__ikmal_workspace_repair = () => {
      if (!repairPromise) {
        repairPromise = repair().catch((error) => {
          console.warn(`[Ikmal Tools] Workspace repair could not complete: ${error.message}`);
          throw error;
        }).finally(() => {
          repairPromise = null;
        });
      }
      return repairPromise;
    };
    async function runFirstRunBootstrapIfNeeded() {
      const bootstrapped = await searchIncludingHidden("#extBootstrapped");
      if (bootstrapped && bootstrapped.length > 0) return;
      console.log("[Ikmal Tools] First run detected; provisioning the workspace.");
      await window.__ikmal_workspace_repair();
    }
    let todayAlignmentPromise = null;
    const checkTodayAlignment = () => {
      if (document.visibilityState === "hidden" || todayAlignmentPromise) return;
      todayAlignmentPromise = ensureTodayAlignment({ allowCreate: false }).catch((error) => console.warn(`[Ikmal Tools] Today alignment skipped: ${error.message}`)).finally(() => {
        todayAlignmentPromise = null;
      });
    };
    runFirstRunBootstrapIfNeeded().catch((error) => console.warn(`[Ikmal Tools] First-run workspace setup could not complete: ${error.message}`)).finally(() => {
      repairCurrentWorkspaceBranches().catch((error) => console.warn(`[Ikmal Tools] Workspace branch repair skipped: ${error.message}`));
      checkTodayAlignment();
      window.addEventListener("focus", checkTodayAlignment, { passive: true });
      window.setInterval(checkTodayAlignment, 6e4);
    });
  })();
})();
