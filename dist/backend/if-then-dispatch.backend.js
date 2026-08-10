"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/engine/ifThenRuleEngine.ts
  var BUILTIN_IF_THEN_RULES = [
    // 1. Global System Rules
    {
      id: "rule_project_autoclone",
      name: "Global -> Auto-Clone to Parent Container",
      description: "When a note is created with a ~project relation, automatically clone it under the target Project Hub container note.",
      enabled: true,
      isBuiltin: true,
      trigger: {
        type: "onNoteCreated"
      },
      conditions: [
        { field: "project", operator: "isSet", value: true }
      ],
      actions: [
        { type: "cloneToContainer", params: { relationName: "project" } }
      ]
    },
    {
      id: "rule_derived_topic_sync",
      name: "Global -> Sync Derived Topics",
      description: "When a note is created or linked to a project/client, automatically recalculate and set derived topics.",
      enabled: true,
      isBuiltin: true,
      trigger: {
        type: "onNoteCreated"
      },
      conditions: [],
      actions: [
        { type: "syncDerivedTopics", params: {} }
      ]
    },
    // 2. Category-Wide Rules (Work, Drafts, People)
    {
      id: "rule_work_category_done_date",
      name: "Work Category -> Record Completion Date",
      description: "Applies to ALL notes in the Work category. When status is marked done, automatically sets #doneDate.",
      enabled: true,
      isBuiltin: true,
      trigger: {
        type: "onAttributeChanged",
        targetCategory: "work",
        attributeName: "status"
      },
      conditions: [
        { field: "status", operator: "equals", value: "done" }
      ],
      actions: [
        { type: "setLabel", params: { labelName: "doneDate", labelValue: "{TODAY}" } }
      ]
    },
    {
      id: "rule_drafts_category_editorial_round",
      name: "Drafts Category -> Auto-Sync Review Round",
      description: "Applies to ALL notes in the Drafts category (story, edit, emailDraft, scratch). Syncs editorial review round.",
      enabled: true,
      isBuiltin: true,
      trigger: {
        type: "onNoteCreated",
        targetCategory: "drafts"
      },
      conditions: [],
      actions: [
        // `round` is a numeric workflow key used for ordering and for
        // calculating the next round. A display phrase here silently made
        // Number(#round) become NaN, so keep review state in its own label.
        { type: "setLabel", params: { labelName: "reviewState", labelValue: "review" } }
      ]
    },
    {
      id: "rule_people_category_followup",
      name: "People Category -> Auto-Tag Contact Follow-up",
      description: "Applies to ALL notes in People category (person, organization). Auto-tags contact entries when followUpDate is set.",
      enabled: true,
      isBuiltin: true,
      trigger: {
        type: "onAttributeChanged",
        targetCategory: "people",
        attributeName: "followUpDate"
      },
      conditions: [],
      actions: [
        { type: "setLabel", params: { labelName: "followUpNeeded", labelValue: "true" } }
      ]
    },
    // 3. Template-Specific Rules
    {
      id: "rule_task_done_date",
      name: "Task Template -> High Priority Highlight",
      description: "When a Task priority is set to high, highlight it with color.",
      enabled: true,
      isBuiltin: true,
      trigger: {
        type: "onAttributeChanged",
        targetTemplateId: "task",
        attributeName: "priority"
      },
      conditions: [
        { field: "priority", operator: "equals", value: "high" }
      ],
      actions: [
        { type: "setLabel", params: { labelName: "color", labelValue: "#e74c3c" } }
      ]
    }
  ];
  var IfThenRuleEngine = class {
    constructor(initialRules = BUILTIN_IF_THEN_RULES) {
      __publicField(this, "rules", /* @__PURE__ */ new Map());
      for (const rule of initialRules) {
        this.rules.set(rule.id, rule);
      }
    }
    registerRule(rule) {
      this.rules.set(rule.id, rule);
    }
    getRule(ruleId) {
      return this.rules.get(ruleId);
    }
    getAllRules() {
      return Array.from(this.rules.values());
    }
    toggleRule(ruleId, enabled) {
      const rule = this.rules.get(ruleId);
      if (rule) {
        rule.enabled = enabled;
      }
    }
    deleteRule(ruleId) {
      return this.rules.delete(ruleId);
    }
    /**
     * Every enabled rule whose trigger and conditions match, each with its actions
     * resolved. Callers need to know which rule fired — to report it and to avoid
     * re-running it — so this returns rule results rather than a flat action list.
     */
    evaluateEvent(eventType, context, changedAttribute) {
      const results = [];
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;
        if (rule.trigger.type !== eventType) continue;
        if (rule.trigger.targetTemplateId && rule.trigger.targetTemplateId !== context.templateId) {
          continue;
        }
        if (rule.trigger.targetCategory && rule.trigger.targetCategory !== context.category) {
          continue;
        }
        if (rule.trigger.targetContainerMarker && rule.trigger.targetContainerMarker !== context.containerMarker) {
          continue;
        }
        if (eventType === "onAttributeChanged" && rule.trigger.attributeName && rule.trigger.attributeName !== changedAttribute) {
          continue;
        }
        if (this.checkConditions(rule.conditions, context)) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            matched: true,
            executedActions: rule.actions.map((action) => this.processActionTemplates(action, context))
          });
        }
      }
      return results;
    }
    /** Substitutes the placeholders an action's params may carry. */
    processActionTemplates(action, context) {
      const copy = JSON.parse(JSON.stringify(action));
      const now = /* @__PURE__ */ new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      for (const key of Object.keys(copy.params)) {
        const value = copy.params[key];
        if (typeof value === "string") {
          copy.params[key] = value.replace("{TODAY}", today).replace("{NOTE_TITLE}", context.title).replace("{NOTE_ID}", context.noteId);
        }
      }
      return copy;
    }
    checkConditions(conditions, context) {
      for (const cond of conditions) {
        const val = context.attributes[cond.field] ?? context.relations[cond.field] ?? {
          title: context.title,
          templateId: context.templateId,
          category: context.category,
          containerMarker: context.containerMarker
        }[cond.field];
        switch (cond.operator) {
          case "equals":
            if (val !== cond.value) return false;
            break;
          case "notEquals":
            if (val === cond.value) return false;
            break;
          case "contains":
            if (typeof val === "string") {
              if (!val.includes(String(cond.value))) return false;
            } else if (Array.isArray(val)) {
              if (!val.includes(cond.value)) return false;
            } else {
              return false;
            }
            break;
          case "isEmpty":
            if (!(val === void 0 || val === null || val === "")) return false;
            break;
          case "greaterThan":
            if (Number.isNaN(Number(val)) || Number(val) <= Number(cond.value)) return false;
            break;
          case "lessThan":
            if (Number.isNaN(Number(val)) || Number(val) >= Number(cond.value)) return false;
            break;
          case "isSet":
            if (cond.value && (val === void 0 || val === null || val === "")) return false;
            if (!cond.value && val !== void 0 && val !== null && val !== "") return false;
            break;
        }
      }
      return true;
    }
  };

  // src/engine/yamlParser.ts
  var YamlParser = class {
    /**
     * Converts a JavaScript object into a clean, human-readable YAML string.
     */
    static stringify(obj, indent = 0) {
      const spacing = " ".repeat(indent);
      if (obj === null || obj === void 0) return "null";
      if (typeof obj === "boolean") return String(obj);
      if (typeof obj === "number") return String(obj);
      if (typeof obj === "string") {
        if (obj.includes("\n")) {
          return "|\n" + obj.split("\n").map((l) => spacing + "  " + l).join("\n");
        }
        if (obj === "" || /[#:[\]{},"']/.test(obj) || obj.trim() !== obj) {
          return `"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0) return "[]";
        return obj.map((item) => {
          if (typeof item === "object" && item !== null) {
            const itemYaml = this.stringify(item, indent + 2);
            const lines = itemYaml.trim().split("\n");
            return `${spacing}- ${lines[0].trim()}
${lines.slice(1).map((l) => spacing + "  " + l).join("\n")}`.trimEnd();
          } else {
            return `${spacing}- ${this.stringify(item, 0)}`;
          }
        }).join("\n");
      }
      if (typeof obj === "object") {
        const keys = Object.keys(obj);
        if (keys.length === 0) return "{}";
        return keys.map((key) => {
          const val = obj[key];
          if (val !== null && typeof val === "object") {
            const nested = this.stringify(val, indent + 2);
            return nested === "[]" || nested === "{}" ? `${spacing}${key}: ${nested}` : `${spacing}${key}:
${nested}`;
          }
          return `${spacing}${key}: ${this.stringify(val, indent + 2)}`;
        }).join("\n");
      }
      return String(obj);
    }
    /**
     * Parses YAML or JSON/JSONC text into a JavaScript object.
     */
    static parse(text) {
      const cleaned = text.trim();
      if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
        const jsonWithoutComments = cleaned.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
        return JSON.parse(jsonWithoutComments);
      }
      const lines = cleaned.split("\n");
      const [value] = this.parseBlock(lines, 0, 0);
      return value;
    }
    /**
     * Parses the block starting at `start` whose entries are indented by at least
     * `indent`, returning the value and the line after the block.
     */
    static parseBlock(lines, start, indent) {
      let i = this.skipBlank(lines, start);
      if (i >= lines.length) return [null, i];
      return this.indentOf(lines[i]) >= indent && lines[i].trim().startsWith("- ") ? this.parseList(lines, i, this.indentOf(lines[i])) : this.parseMap(lines, i, this.indentOf(lines[i]));
    }
    static parseMap(lines, start, indent) {
      const result = {};
      let i = start;
      while (i < lines.length) {
        const next = this.skipBlank(lines, i);
        if (next >= lines.length) {
          i = next;
          break;
        }
        const line = lines[next];
        const lineIndent = this.indentOf(line);
        if (lineIndent < indent) break;
        const trimmed = line.trim();
        const separator = this.findKeySeparator(trimmed);
        if (separator < 0) break;
        const key = this.unquote(trimmed.slice(0, separator).trim());
        const inline = trimmed.slice(separator + 1).trim();
        i = next + 1;
        if (inline === "|" || inline === "|-") {
          const [text, after] = this.parseBlockScalar(lines, i, indent);
          result[key] = inline === "|" ? text : text.replace(/\n+$/, "");
          i = after;
        } else if (inline === "") {
          const child = this.skipBlank(lines, i);
          if (child < lines.length && this.indentOf(lines[child]) > indent) {
            const [value, after] = this.parseBlock(lines, child, this.indentOf(lines[child]));
            result[key] = value;
            i = after;
          } else {
            result[key] = null;
          }
        } else if (inline === "[]") {
          result[key] = [];
        } else if (inline === "{}") {
          result[key] = {};
        } else {
          result[key] = this.parseScalar(inline);
        }
      }
      return [result, i];
    }
    static parseList(lines, start, indent) {
      const result = [];
      let i = start;
      while (i < lines.length) {
        const next = this.skipBlank(lines, i);
        if (next >= lines.length) {
          i = next;
          break;
        }
        const line = lines[next];
        if (this.indentOf(line) !== indent || !line.trim().startsWith("- ")) break;
        const first = line.trim().slice(2).trim();
        i = next + 1;
        if (this.findKeySeparator(first) < 0) {
          result.push(this.parseScalar(first));
          continue;
        }
        const itemIndent = this.indentOf(line) + 2;
        const [head] = this.parseMap([" ".repeat(itemIndent) + first], 0, itemIndent);
        const rest = this.skipBlank(lines, i);
        if (rest < lines.length && this.indentOf(lines[rest]) >= itemIndent && !lines[rest].trim().startsWith("- ")) {
          const [tail, after] = this.parseMap(lines, rest, itemIndent);
          Object.assign(head, tail);
          i = after;
        }
        result.push(head);
      }
      return [result, i];
    }
    /** Collects the lines of a `|` block, which run until the indentation drops back. */
    static parseBlockScalar(lines, start, indent) {
      const collected = [];
      let i = start;
      let contentIndent = -1;
      while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === "") {
          collected.push("");
          i++;
          continue;
        }
        if (this.indentOf(line) <= indent) break;
        if (contentIndent < 0) contentIndent = this.indentOf(line);
        collected.push(line.slice(contentIndent));
        i++;
      }
      while (collected.length && collected[collected.length - 1] === "") collected.pop();
      return [collected.join("\n"), i];
    }
    /**
     * Index of the `:` that ends the key, or -1 when the text is not a mapping.
     * Skips colons inside quotes so a quoted key or URL does not split early.
     */
    static findKeySeparator(text) {
      let quote = null;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
          if (ch === "\\") i++;
          else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === ":" && (i + 1 === text.length || text[i + 1] === " ")) {
          return i;
        }
      }
      return -1;
    }
    static parseScalar(raw) {
      const text = raw.startsWith('"') || raw.startsWith("'") ? raw : raw.split(" #")[0].trim();
      if (text === "" || text === "null" || text === "~") return null;
      if (text === "true") return true;
      if (text === "false") return false;
      if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
      return this.unquote(text);
    }
    static unquote(text) {
      if (text.length >= 2 && (text.startsWith('"') && text.endsWith('"') || text.startsWith("'") && text.endsWith("'"))) {
        return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
      return text;
    }
    static indentOf(line) {
      return line.length - line.trimStart().length;
    }
    /** Index of the next line that carries content, skipping blanks and comments. */
    static skipBlank(lines, from) {
      let i = from;
      while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
      return i;
    }
  };

  // src/backend/if-then-dispatch.backend.ts
  var PACKAGE_ID = "iansherr/ikmal_tools_trilium";
  var YAML_SPEC_LABEL = "packageData:yamlSpecification";
  var SCHEDULE_INTERVAL_MS = 5 * 60 * 1e3;
  var SCHEDULE_TIMER_KEY = "__ikmal_if_then_schedule_timer";
  var DISPATCH_GUARD_KEY = "__ikmal_if_then_dispatch_guard";
  var BUILTIN_TEMPLATE_METADATA = [
    { id: "task", marker: "extTask", category: "work" },
    { id: "projectTask", marker: "extTask", category: "work" },
    { id: "meeting", marker: "extMeeting", category: "work" },
    { id: "meetingPrep", marker: "extMeeting", category: "work" },
    { id: "story", marker: "extStoryDraft", category: "drafts" },
    { id: "edit", marker: "extStoryDraft", category: "drafts" },
    { id: "scratch", marker: "extScratch", category: "drafts" },
    { id: "projectHub", marker: "extProjectHub", category: "work" },
    { id: "reportingNotes", marker: "extReportingNotes", category: "work" },
    { id: "person", marker: "extPerson", category: "people" },
    { id: "organization", marker: "extOrganization", category: "people" },
    { id: "topic", marker: "extTopic", category: "system" },
    { id: "emailDraft", marker: "extEmailDraft", category: "drafts" }
  ];
  function log(message) {
    if (typeof api?.log === "function") api.log(`[Ikmal If/Then] ${message}`);
  }
  function ownedValue(note, name) {
    if (!note) return void 0;
    const value = note.getOwnedLabelValue?.(name);
    if (value !== void 0 && value !== null) return String(value);
    return void 0;
  }
  function readYamlSpecification() {
    const manifests = api.getNotesWithLabel?.("packageOwner", PACKAGE_ID) || [];
    const manifest = manifests.find((note) => ownedValue(note, "packageArtifact") === "manifest");
    const raw = ownedValue(manifest, YAML_SPEC_LABEL);
    if (!raw) {
      return { templates: BUILTIN_TEMPLATE_METADATA, rules: new IfThenRuleEngine().getAllRules() };
    }
    try {
      const yaml = JSON.parse(raw);
      const spec = YamlParser.parse(typeof yaml === "string" ? yaml : raw);
      if (!spec || !Array.isArray(spec.ifThenRules)) {
        return { templates: BUILTIN_TEMPLATE_METADATA, rules: new IfThenRuleEngine().getAllRules() };
      }
      const ruleEngine = new IfThenRuleEngine();
      const savedRules = spec.ifThenRules.filter((rule) => rule?.id).map((rule) => ({
        id: String(rule.id),
        name: String(rule.name || rule.id),
        description: String(rule.description || ""),
        enabled: rule.enabled !== false,
        isBuiltin: Boolean(rule.isBuiltin),
        trigger: {
          type: rule.trigger?.type || "onNoteCreated",
          ...rule.trigger?.targetCategory ? { targetCategory: String(rule.trigger.targetCategory) } : {},
          ...rule.trigger?.targetTemplateId ? { targetTemplateId: String(rule.trigger.targetTemplateId) } : {},
          ...rule.trigger?.targetContainerMarker ? { targetContainerMarker: String(rule.trigger.targetContainerMarker) } : {},
          ...rule.trigger?.attributeName ? { attributeName: String(rule.trigger.attributeName) } : {}
        },
        conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
        actions: Array.isArray(rule.actions) ? rule.actions : []
      }));
      savedRules.forEach((rule) => ruleEngine.registerRule(rule));
      return {
        templates: Array.isArray(spec.templates) && spec.templates.length ? spec.templates : BUILTIN_TEMPLATE_METADATA,
        rules: ruleEngine.getAllRules()
      };
    } catch (error) {
      log(`saved YAML could not be loaded: ${error?.message || error}`);
      return { templates: BUILTIN_TEMPLATE_METADATA, rules: new IfThenRuleEngine().getAllRules() };
    }
  }
  function getTemplateNoteId(note) {
    const relation = note?.getRelations?.("template")?.[0];
    return relation?.value || relation?.targetNoteId || null;
  }
  function templateInfo(note, model) {
    const marker = ownedValue(note, "extTemplate");
    const byId = model.templates.find((template) => template?.id === marker);
    if (byId) return { id: String(byId.id), category: byId.category, marker: byId.marker };
    const markerMap = /* @__PURE__ */ new Map();
    model.templates.forEach((template) => {
      if (template?.marker && template?.id) markerMap.set(String(template.marker), template);
    });
    const ownedAttributes = note?.getOwnedAttributes?.() || [];
    const markerAttribute = ownedAttributes.find((attribute) => attribute.type === "label" && markerMap.has(attribute.name));
    if (markerAttribute) {
      const template = markerMap.get(markerAttribute.name);
      return { id: String(template.id), category: template.category, marker: template.marker };
    }
    const templateNoteId = getTemplateNoteId(note);
    if (templateNoteId) {
      const templateNote = api.getNote(templateNoteId);
      const templateMarker = ownedValue(templateNote, "extTemplate");
      const template = model.templates.find((candidate) => candidate?.marker === templateMarker || candidate?.id === templateMarker);
      if (template) return { id: String(template.id), category: template.category, marker: template.marker };
    }
    return { id: marker || "", marker: marker || void 0 };
  }
  function containerMarker(note) {
    const parentIds = note?.getParentNoteIds?.() || [];
    for (const parentId of parentIds) {
      const parent = api.getNote(parentId);
      const attributes = parent?.getOwnedAttributes?.() || [];
      const root = attributes.find((attribute) => attribute.type === "label" && /Root$/.test(attribute.name));
      if (root) return root.name;
    }
    return void 0;
  }
  function buildContext(note, model) {
    const info = templateInfo(note, model);
    const attributes = {};
    const relations = {};
    for (const attribute of note?.getOwnedAttributes?.() || []) {
      if (!attribute?.name) continue;
      if (attribute.type === "relation") {
        const current = relations[attribute.name];
        const value = attribute.value || attribute.targetNoteId;
        if (!value) continue;
        relations[attribute.name] = current ? [...Array.isArray(current) ? current : [current], String(value)] : String(value);
      } else {
        attributes[attribute.name] = attribute.value ?? "";
      }
    }
    return {
      noteId: note.noteId,
      title: note.title || "",
      templateId: info.id,
      category: info.category,
      containerMarker: containerMarker(note),
      attributes,
      relations
    };
  }
  function findContainer(marker) {
    if (!marker) return null;
    return api.getNoteWithLabel?.(marker) || null;
  }
  function relationValues(note, name) {
    return (note?.getRelations?.(name) || []).map((relation) => relation.value || relation.targetNoteId).filter(Boolean).map(String);
  }
  function guardKey(noteId, eventType, changedAttribute) {
    return `${noteId}:${eventType}:${changedAttribute || ""}`;
  }
  function isGuarded(key) {
    const root = globalThis;
    const guards = root[DISPATCH_GUARD_KEY] || /* @__PURE__ */ new Map();
    root[DISPATCH_GUARD_KEY] = guards;
    const now = Date.now();
    for (const [guardKeyValue, timestamp] of guards) {
      if (now - timestamp > 5e3) guards.delete(guardKeyValue);
    }
    if (guards.has(key)) return true;
    guards.set(key, now);
    return false;
  }
  function ensurePresent(note, parent) {
    if (!note || !parent || note.noteId === parent.noteId) return;
    if (!(note.getParentNoteIds?.() || []).includes(parent.noteId)) {
      api.cloneNote(note.noteId, parent.noteId);
    }
  }
  function ensureAbsent(note, parent) {
    if (!note || !parent || !(note.getParentNoteIds?.() || []).includes(parent.noteId)) return;
    api.removeNoteFromParent(note.noteId, parent.noteId);
  }
  function executeAction(note, action, context) {
    const params = action.params || {};
    switch (action.type) {
      case "setLabel": {
        if (!params.labelName) return;
        const value = params.labelValue || "";
        if (ownedValue(note, params.labelName) !== value) note.setLabel(params.labelName, value);
        return;
      }
      case "removeLabel":
        if (params.labelName && ownedValue(note, params.labelName) !== void 0) note.removeLabel(params.labelName);
        return;
      case "setRelation":
        if (params.relationName && params.targetNoteId) {
          const current = relationValues(note, params.relationName);
          if (!current.includes(String(params.targetNoteId))) note.setRelation(params.relationName, String(params.targetNoteId));
        }
        return;
      case "setTaskStatus":
        if (params.status && ownedValue(note, "status") !== String(params.status)) note.setLabel("status", String(params.status));
        return;
      case "cloneToContainer": {
        const targets = params.relationName ? relationValues(note, params.relationName).map((id) => api.getNote(id)).filter(Boolean) : [findContainer(params.containerMarker)];
        targets.filter(Boolean).forEach((target) => ensurePresent(note, target));
        return;
      }
      case "archiveNote": {
        const archive = findContainer(params.containerMarker || "archiveProjectRoot");
        const active = findContainer("activeProjectRoot");
        const project = findContainer("projectRoot");
        if (archive) ensurePresent(note, archive);
        if (active) ensureAbsent(note, active);
        if (project) ensureAbsent(note, project);
        if (ownedValue(note, "status") !== "complete") note.setLabel("status", "complete");
        return;
      }
      case "prependContent": {
        if (!params.content || typeof note.setContent !== "function") return;
        const current = typeof note.getContent === "function" ? note.getContent() : "";
        const prefix = String(params.content);
        if (!String(current || "").startsWith(prefix)) note.setContent(`${prefix}
${current || ""}`);
        return;
      }
      case "syncDerivedTopics":
        return;
      case "createLinkedNote": {
        if (!params.templateId || typeof api.createTextNote !== "function") return;
        const parent = findContainer(params.containerMarker) || api.getNote(context.noteId);
        if (!parent) return;
        const title = String(params.title || `${context.title} \u2014 Linked Note`);
        const created = api.createTextNote(parent.noteId, title, String(params.content || ""))?.note;
        if (created && params.relationName) note.setRelation(params.relationName, created.noteId);
        return;
      }
      case "runScript":
        log(`rule action runScript was intentionally skipped for ${note.noteId}; arbitrary script execution is not enabled`);
        return;
      default:
        return;
    }
  }
  function dispatch(note, eventType, changedAttribute, model) {
    if (!note || note.isInHiddenSubtree?.()) return 0;
    const runtimeModel = model || readYamlSpecification();
    if (!runtimeModel) return 0;
    const key = guardKey(note.noteId, eventType, changedAttribute);
    if (isGuarded(key)) return 0;
    const context = buildContext(note, runtimeModel);
    const engine = new IfThenRuleEngine(runtimeModel.rules);
    const results = engine.evaluateEvent(eventType, context, changedAttribute);
    const matched = results.filter((result) => result.matched);
    if (!matched.length) return 0;
    const apply = () => matched.forEach((result) => result.executedActions.forEach((action) => executeAction(note, action, context)));
    if (typeof api.transactional === "function") api.transactional(apply);
    else apply();
    return matched.length;
  }
  function dispatchAttributeChange() {
    const origin2 = api.originEntity;
    if (!origin2?.noteId || !origin2.attributeId) return;
    const note = api.getNote(origin2.noteId);
    const count = dispatch(note, "onAttributeChanged", origin2.name);
    if (count) log(`applied ${count} attribute-change rule(s) to ${origin2.noteId} for ${origin2.name}`);
  }
  function dispatchScheduled() {
    const model = readYamlSpecification();
    if (!model) return;
    const markers = model.templates.map((template) => template?.marker).filter(Boolean);
    const notes = /* @__PURE__ */ new Map();
    markers.forEach((marker) => (api.getNotesWithLabel?.(marker) || []).forEach((note) => notes.set(note.noteId, note)));
    let count = 0;
    notes.forEach((note) => {
      count += dispatch(note, "onScheduledCheck", void 0, model);
    });
    if (count) log(`applied ${count} scheduled rule(s)`);
  }
  var origin = api.originEntity;
  if (origin?.attributeId) {
    dispatchAttributeChange();
  } else if (typeof setInterval === "function") {
    const root = globalThis;
    if (!root[SCHEDULE_TIMER_KEY]) {
      root[SCHEDULE_TIMER_KEY] = true;
      dispatchScheduled();
      setInterval(dispatchScheduled, SCHEDULE_INTERVAL_MS);
    }
  }
})();
