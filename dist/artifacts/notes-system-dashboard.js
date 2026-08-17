"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/engine/templateEngine.ts
  var BUILTIN_TEMPLATES = [
    {
      id: "task",
      marker: "extTask",
      title: "Task",
      icon: "check-square",
      category: "work",
      rootContainerMarker: "taskRoot",
      titlePattern: "{title}",
      defaultContent: "<p>Task description and notes...</p>",
      projectScoped: false,
      isBuiltin: true,
      attributes: [
        { name: "priority", type: "label", dataType: "select", options: ["high", "medium", "low"], defaultValue: "medium", isPromoted: true, label: "Priority" },
        { name: "status", type: "label", dataType: "select", options: ["todo", "in_progress", "done", "cancelled"], defaultValue: "todo", isPromoted: true, label: "Status" },
        { name: "dueDate", type: "label", dataType: "date", isPromoted: true, label: "Due Date" },
        { name: "doneDate", type: "label", dataType: "date", isPromoted: true, label: "Done Date" },
        { name: "duration", type: "label", dataType: "string", isPromoted: true, label: "Duration" },
        { name: "complexity", type: "label", dataType: "select", options: ["simple", "multi"], isPromoted: true, label: "Complexity" }
      ],
      relationships: [
        {
          id: "rel_task_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "canvas",
      marker: "extCanvas",
      title: "Diagram & Whiteboard",
      icon: "palette",
      category: "creative",
      rootContainerMarker: "canvasRoot",
      titlePattern: "{title} (Diagram)",
      defaultContent: "",
      noteType: "canvas",
      projectScoped: false,
      isBuiltin: true,
      attributes: [
        { name: "diagramType", type: "label", dataType: "select", options: ["mindmap", "flowchart", "architecture", "sketch"], defaultValue: "mindmap", isPromoted: true, label: "Diagram Type" },
        { name: "status", type: "label", dataType: "select", options: ["draft", "final", "archived"], defaultValue: "draft", isPromoted: true, label: "Status" }
      ],
      relationships: [
        {
          id: "rel_canvas_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "projectTask",
      marker: "extTask",
      title: "Project Task",
      icon: "list-check",
      category: "work",
      rootContainerMarker: "taskRoot",
      titlePattern: "{title}",
      defaultContent: "<p>Project task details and sub-action items...</p>",
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "priority", type: "label", dataType: "select", options: ["high", "medium", "low"], defaultValue: "medium", isPromoted: true, label: "Priority" },
        { name: "status", type: "label", dataType: "select", options: ["todo", "in_progress", "done"], defaultValue: "todo", isPromoted: true, label: "Status" },
        { name: "dueDate", type: "label", dataType: "date", isPromoted: true, label: "Due Date" }
      ],
      relationships: [
        {
          id: "rel_projtask_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "meeting",
      marker: "extMeeting",
      title: "Meeting",
      icon: "calendar-event",
      category: "work",
      rootContainerMarker: "meetingRoot",
      titlePattern: "Meeting: {title}",
      defaultContent: "<h2>AGENDA</h2><ul><li></li></ul><h2>NOTES</h2><p></p><h2>ACTION ITEMS</h2><ul><li>[ ] </li></ul>",
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "startDate", type: "label", dataType: "date", isPromoted: true, label: "Start Date" },
        { name: "startTime", type: "label", dataType: "string", isPromoted: true, label: "Start Time" },
        { name: "attendee", type: "relation", dataType: "relation", targetTemplateId: "person", isPromoted: true, label: "Attendees" },
        { name: "client", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "Client" },
        { name: "companyOnBehalf", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "On Behalf Of" }
      ],
      relationships: [
        {
          id: "rel_meeting_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "meetingPrep",
      marker: "extMeeting",
      title: "Meeting Prep",
      icon: "calendar-edit",
      category: "work",
      rootContainerMarker: "meetingRoot",
      titlePattern: "Meeting Prep: {title}",
      defaultContent: "<h2>BACKGROUND</h2><p></p><h2>TALKING POINTS</h2><ul><li></li></ul><h2>QUESTIONS TO ASK</h2><ul><li></li></ul>",
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "attendee", type: "relation", dataType: "relation", targetTemplateId: "person", isPromoted: true, label: "Attendees" },
        { name: "client", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "Client" }
      ],
      relationships: [
        {
          id: "rel_meetingprep_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "story",
      marker: "extStoryDraft",
      title: "Story Project",
      icon: "news",
      category: "drafts",
      rootContainerMarker: "storyDraftRoot",
      titlePattern: "{title}",
      defaultContent: "<h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>DEK</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p>",
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "status", type: "label", dataType: "select", options: ["drafting", "review", "published"], defaultValue: "drafting", isPromoted: true, label: "Status" },
        { name: "workflow", type: "label", dataType: "string", defaultValue: "project", isPromoted: true, label: "Workflow" },
        { name: "kind", type: "label", dataType: "string", defaultValue: "project", isPromoted: true, label: "Kind" },
        { name: "client", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "Client Organization" },
        { name: "writer", type: "relation", dataType: "relation", targetTemplateId: "person", isPromoted: true, label: "Writer / Reporter" }
      ],
      relationships: [
        {
          id: "rel_story_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "edit",
      marker: "extStoryDraft",
      title: "Edit Package",
      icon: "edit",
      category: "drafts",
      rootContainerMarker: "storyDraftRoot",
      titlePattern: "Edit: {title}",
      defaultContent: "<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>EDITORIAL NOTES</h2><p></p><h2>REQUESTED CHANGES</h2><ul><li></li></ul><h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p><h2>WRITER RESPONSE</h2><p></p>",
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "status", type: "label", dataType: "select", options: ["editing", "approved", "returned"], defaultValue: "editing", isPromoted: true, label: "Status" },
        { name: "workflow", type: "label", dataType: "string", defaultValue: "edit", isPromoted: true, label: "Workflow" },
        { name: "round", type: "label", dataType: "string", defaultValue: "Round 1 Edit", isPromoted: true, label: "Round" },
        { name: "writer", type: "relation", dataType: "relation", targetTemplateId: "person", isPromoted: true, label: "Writer / Reporter" }
      ],
      relationships: [
        {
          id: "rel_edit_story",
          name: "Parent Story Project",
          relationName: "storyDraft",
          targetTemplateId: "story",
          targetTemplateName: "Story Project",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "scratch",
      marker: "extScratch",
      title: "Scratch Note",
      icon: "file-blank",
      category: "drafts",
      rootContainerMarker: "unassignedRoot",
      titlePattern: "{title}",
      defaultContent: "<p>Quick scratchpad notes...</p>",
      projectScoped: false,
      isBuiltin: true,
      attributes: [
        { name: "project", type: "relation", dataType: "relation", targetTemplateId: "projectHub", isPromoted: true, label: "Optional Project" }
      ],
      relationships: [
        {
          id: "rel_scratch_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "projectHub",
      marker: "extProjectHub",
      title: "Project Hub",
      icon: "book",
      category: "work",
      rootContainerMarker: "projectRoot",
      titlePattern: "{title}",
      defaultContent: '<h2>OVERVIEW</h2><p></p><h2>GOALS</h2><ul><li></li></ul><div class="project-hub-dashboard-placeholder" data-project-hub-dashboard="true"></div>',
      isBuiltin: true,
      attributes: [
        { name: "status", type: "label", dataType: "select", options: ["active", "archived", "on_hold"], defaultValue: "active", isPromoted: true, label: "Status" },
        { name: "kind", type: "label", dataType: "select", options: ["project", "edit", "client", "internal"], isPromoted: true, label: "Kind" },
        { name: "client", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "Client Organization" },
        { name: "companyOnBehalf", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "On Behalf Of" }
      ],
      relationships: [
        {
          id: "rel_project_client",
          name: "Client Organization",
          relationName: "client",
          targetTemplateId: "organization",
          targetTemplateName: "Organization",
          isMulti: false,
          autoCloneToParent: false,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "reportingNotes",
      marker: "extReportingNotes",
      title: "Reporting Notes",
      icon: "file-find",
      category: "work",
      rootContainerMarker: "reportingRoot",
      titlePattern: "{title} (Reporting & Notes)",
      defaultContent: '<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>IDEA / ANGLE</h2><p></p><h2>REPORTING NOTES</h2><p></p><div class="reporting-note-actions-placeholder" data-reporting-note-actions="true"></div>',
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "status", type: "label", dataType: "select", options: ["active", "archived"], defaultValue: "active", isPromoted: true, label: "Status" }
      ],
      relationships: [
        {
          id: "rel_reporting_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    },
    {
      id: "person",
      marker: "extPerson",
      title: "Person",
      icon: "user",
      category: "people",
      rootContainerMarker: "peopleRoot",
      titlePattern: "{title}",
      defaultContent: "<h2>CONTACT INFO</h2><p></p><h2>NOTES</h2><p></p>",
      isBuiltin: true,
      attributes: [
        { name: "jobTitle", type: "label", dataType: "string", isPromoted: true, label: "Job Focus" },
        { name: "email", type: "label", dataType: "string", isPromoted: true, label: "Email" },
        { name: "phone", type: "label", dataType: "string", isPromoted: true, label: "Phone" },
        { name: "employer", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "Employer", inverseRelationName: "staff" },
        { name: "organization", type: "relation", dataType: "relation", targetTemplateId: "organization", isPromoted: true, label: "Organization" }
      ],
      relationships: [
        {
          id: "rel_person_org",
          name: "Organization",
          relationName: "organization",
          targetTemplateId: "organization",
          targetTemplateName: "Organization",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        },
        {
          id: "rel_person_employer",
          name: "Employer",
          relationName: "employer",
          targetTemplateId: "organization",
          targetTemplateName: "Organization",
          isMulti: true,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent",
          inverseRelationName: "staff"
        }
      ]
    },
    {
      id: "organization",
      marker: "extOrganization",
      title: "Organization",
      icon: "buildings",
      category: "people",
      rootContainerMarker: "orgRoot",
      titlePattern: "{title}",
      defaultContent: "<h2>ABOUT</h2><p></p><h2>KEY CONTACTS</h2><ul><li></li></ul>",
      isBuiltin: true,
      attributes: [
        { name: "location", type: "label", dataType: "string", isPromoted: true, label: "Location" },
        { name: "ticker", type: "label", dataType: "string", isPromoted: true, label: "Ticker" },
        { name: "website", type: "label", dataType: "string", isPromoted: true, label: "Website" },
        { name: "staff", type: "relation", dataType: "relation", targetTemplateId: "person", isPromoted: true, label: "People / Staff", inverseRelationName: "employer" }
      ],
      relationships: [
        {
          id: "rel_org_person",
          name: "Key Contact Person",
          relationName: "keyContact",
          targetTemplateId: "person",
          targetTemplateName: "Person",
          isMulti: true,
          autoCloneToParent: false,
          inheritTopics: true,
          direction: "child"
        },
        {
          id: "rel_org_staff",
          name: "People / Staff",
          relationName: "staff",
          targetTemplateId: "person",
          targetTemplateName: "Person",
          isMulti: true,
          autoCloneToParent: false,
          inheritTopics: true,
          direction: "child",
          inverseRelationName: "employer"
        }
      ]
    },
    {
      id: "topic",
      marker: "extTopic",
      title: "Topic",
      icon: "purchase-tag",
      category: "system",
      rootContainerMarker: "topicRoot",
      titlePattern: "{title}",
      defaultContent: "<h2>DESCRIPTION</h2><p></p>",
      noJournalClone: true,
      isBuiltin: true,
      attributes: [
        { name: "aliasOf", type: "relation", dataType: "relation", targetTemplateId: "topic", isPromoted: true, label: "Alias Of" }
      ],
      relationships: []
    },
    {
      id: "emailDraft",
      marker: "extEmailDraft",
      title: "Email Draft",
      icon: "envelope",
      category: "drafts",
      rootContainerMarker: "emailRoot",
      titlePattern: "Email: {title}",
      defaultContent: "<h2>RECIPIENTS</h2><p></p><h2>SUBJECT</h2><p></p><h2>BODY</h2><p></p>",
      projectScoped: true,
      isBuiltin: true,
      attributes: [
        { name: "status", type: "label", dataType: "select", options: ["draft", "sent", "awaiting_reply"], isPromoted: true, label: "Status" },
        { name: "waitingOn", type: "label", dataType: "string", isPromoted: true, label: "Waiting On" },
        { name: "followUpDate", type: "label", dataType: "date", isPromoted: true, label: "Follow-up Date" }
      ],
      relationships: [
        {
          id: "rel_email_project",
          name: "Project Hub",
          relationName: "project",
          targetTemplateId: "projectHub",
          targetTemplateName: "Project Hub",
          isMulti: false,
          autoCloneToParent: true,
          inheritTopics: true,
          direction: "parent"
        }
      ]
    }
  ];
  var BUILTIN_CATEGORIES = [
    { id: "work", title: "Work & Project Scoped", description: "Tasks, meetings, project hubs, and reporting notes scoped to project trees", icon: "book", defaultRootMarker: "projectRoot", autoJournalClone: true, inheritParentTopics: true, projectScopedDefault: true, isBuiltin: true },
    { id: "drafts", title: "Draft & Editorial", description: "Story projects, edit packages, email drafts, and quick scratch notes", icon: "edit", defaultRootMarker: "storyDraftRoot", autoJournalClone: true, inheritParentTopics: true, projectScopedDefault: true, isBuiltin: true },
    { id: "people", title: "People & Client Entities", description: "Persons, contacts, and client organization directories", icon: "user", defaultRootMarker: "peopleRoot", autoJournalClone: false, inheritParentTopics: true, projectScopedDefault: false, isBuiltin: true },
    { id: "system", title: "System & Topic Index", description: "Topic tags, index containers, and directory roots", icon: "purchase-tag", defaultRootMarker: "topicRoot", autoJournalClone: false, inheritParentTopics: false, projectScopedDefault: false, isBuiltin: true },
    { id: "custom", title: "Custom / Flexible", description: "User-defined custom note schemas", icon: "layer", defaultRootMarker: "unassignedRoot", autoJournalClone: true, inheritParentTopics: true, projectScopedDefault: false, isBuiltin: true }
  ];
  var TemplateEngine = class {
    constructor(initialTemplates = BUILTIN_TEMPLATES, initialCategories = BUILTIN_CATEGORIES) {
      __publicField(this, "templates", /* @__PURE__ */ new Map());
      __publicField(this, "categories", /* @__PURE__ */ new Map());
      for (const tpl of initialTemplates) {
        this.templates.set(tpl.id, JSON.parse(JSON.stringify(tpl)));
      }
      for (const cat of initialCategories) {
        this.categories.set(cat.id, JSON.parse(JSON.stringify(cat)));
      }
    }
    getAllCategories() {
      return Array.from(this.categories.values());
    }
    getCategory(id) {
      return this.categories.get(id);
    }
    registerCategory(cat) {
      this.categories.set(cat.id, JSON.parse(JSON.stringify(cat)));
    }
    deleteCategory(id) {
      const cat = this.categories.get(id);
      if (!cat) return false;
      if (cat.isBuiltin) {
        throw new Error(`Cannot delete built-in category '${id}'`);
      }
      return this.categories.delete(id);
    }
    getAllTemplates() {
      return Array.from(this.templates.values());
    }
    getTemplate(id) {
      return this.templates.get(id);
    }
    getTemplateByMarker(marker) {
      for (const tpl of this.templates.values()) {
        if (tpl.marker === marker) return tpl;
      }
      return void 0;
    }
    registerTemplate(template) {
      this.templates.set(template.id, JSON.parse(JSON.stringify(template)));
    }
    updateTemplate(id, updates) {
      const existing = this.templates.get(id);
      if (!existing) {
        throw new Error(`Template with id '${id}' not found`);
      }
      const updated = { ...existing, ...updates, id };
      this.templates.set(id, updated);
      return updated;
    }
    deleteTemplate(id) {
      const tpl = this.templates.get(id);
      if (!tpl) return false;
      if (tpl.isBuiltin) {
        throw new Error(`Cannot delete built-in template '${id}'`);
      }
      return this.templates.delete(id);
    }
    formatTitle(templateId, rawTitle, dateObj = /* @__PURE__ */ new Date()) {
      const template = this.getTemplate(templateId);
      const pattern = template ? template.titlePattern : "{title}";
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      let formatted = pattern.replace("{title}", rawTitle || "Untitled").replace("YYYY-MM-DD", dateStr).replace("{date}", dateStr);
      return formatted.trim();
    }
    addPromotedAttribute(templateId, attribute) {
      const template = this.getTemplate(templateId);
      if (!template) throw new Error(`Template '${templateId}' not found`);
      const index = template.attributes.findIndex((a) => a.name === attribute.name);
      if (index >= 0) {
        template.attributes[index] = attribute;
      } else {
        template.attributes.push(attribute);
      }
      this.registerTemplate(template);
      return template;
    }
    addRelationship(templateId, relationship) {
      const template = this.getTemplate(templateId);
      if (!template) throw new Error(`Template '${templateId}' not found`);
      const index = template.relationships.findIndex((r) => r.id === relationship.id || r.relationName === relationship.relationName);
      if (index >= 0) {
        template.relationships[index] = relationship;
      } else {
        template.relationships.push(relationship);
      }
      this.registerTemplate(template);
      return template;
    }
  };

  // src/engine/relationshipEngine.ts
  var RelationshipEngine = class {
    constructor(templateEngine) {
      this.templateEngine = templateEngine;
    }
    /**
     * Given a source template and relation values, computes where the note should be cloned,
     * what labels/relations should be attached, and what topics should be inherited.
     */
    resolveCreationRelations(templateId, relationValues) {
      const template = this.templateEngine.getTemplate(templateId);
      const autoCloneContainers = [];
      const inheritedTopicSources = [];
      const relationLabels = [];
      if (!template) {
        return { autoCloneContainers, inheritedTopicSources, relationLabels };
      }
      for (const relDef of template.relationships) {
        const val = relationValues[relDef.relationName];
        if (!val) continue;
        const targetNoteIds = Array.isArray(val) ? val : [val];
        for (const targetId of targetNoteIds) {
          if (!targetId) continue;
          relationLabels.push({ name: relDef.relationName, value: targetId });
          if (relDef.autoCloneToParent) {
            autoCloneContainers.push(targetId);
          }
          if (relDef.inheritTopics) {
            inheritedTopicSources.push(targetId);
          }
        }
      }
      return { autoCloneContainers, inheritedTopicSources, relationLabels };
    }
    /**
     * Calculates derived topics for a note based on its explicit topics and
     * the topics assigned to its relational parent notes (e.g. Project, Client, Org).
     */
    computeDerivedTopics(explicitTopicIds, parentTopicMap) {
      const explicitSet = new Set(explicitTopicIds);
      const derivedSet = /* @__PURE__ */ new Set();
      for (const parentId of Object.keys(parentTopicMap)) {
        const parentTopics = parentTopicMap[parentId] || [];
        for (const topicId of parentTopics) {
          if (!explicitSet.has(topicId)) {
            derivedSet.add(topicId);
          }
        }
      }
      const derivedTopics = Array.from(derivedSet);
      const allTopics = Array.from(/* @__PURE__ */ new Set([...explicitTopicIds, ...derivedTopics]));
      return {
        noteId: "",
        explicitTopics: explicitTopicIds,
        derivedTopics,
        allTopics
      };
    }
  };

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

  // src/engine/todayEngine.ts
  var DEFAULT_WEATHER = {
    label: "",
    latitude: 0,
    longitude: 0,
    units: "metric"
  };
  var DEFAULT_TODAY_WIDGETS = [
    {
      id: "weather",
      title: "Weather",
      marker: "weather",
      visible: false,
      order: 0,
      colSpan: 1,
      columns: [],
      emptyMessage: "Set a location to show the local forecast."
    },
    {
      id: "openTasks",
      title: "Open Tasks",
      marker: "openTasks",
      visible: true,
      order: 1,
      colSpan: 2,
      columns: [["Due", "dueDate"], ["Priority", "priority"], ["Project", "project"]],
      emptyMessage: "No open tasks. All caught up!",
      actionType: "task",
      actionLabel: "New Task"
    },
    {
      id: "overdue",
      title: "Overdue Work",
      marker: "overdue",
      visible: true,
      order: 2,
      colSpan: 1,
      columns: [["Due", "dueDate"], ["Priority", "priority"], ["Project", "project"]],
      emptyMessage: "No overdue tasks.",
      actionType: "task",
      actionLabel: "New Task"
    },
    {
      id: "dueSoon",
      title: "Due Soon",
      marker: "dueSoon",
      visible: true,
      order: 3,
      colSpan: 1,
      columns: [["Due", "dueDate"], ["Priority", "priority"], ["Project", "project"]],
      emptyMessage: "No tasks due soon.",
      actionType: "task",
      actionLabel: "New Task"
    },
    {
      id: "activeProjects",
      title: "Active Projects",
      marker: "activeProjects",
      visible: true,
      order: 4,
      colSpan: 1,
      columns: [["Kind", "kind"], ["Status", "status"]],
      emptyMessage: "No active projects.",
      actionType: "projectHub",
      actionLabel: "New Project"
    },
    {
      id: "highPriority",
      title: "High Priority",
      marker: "highPriority",
      visible: true,
      order: 5,
      colSpan: 1,
      columns: [["Priority", "priority"], ["Due", "dueDate"], ["Project", "project"]],
      emptyMessage: "No unfinished high-priority work.",
      actionType: "task",
      actionLabel: "New Task"
    },
    {
      id: "followUpsDue",
      title: "Follow-ups & Replies",
      marker: "followUpsDue",
      visible: true,
      order: 6,
      colSpan: 1,
      columns: [["Follow-up", "followUpDate"], ["Waiting on", "waitingOn"]],
      emptyMessage: "No follow-ups due soon.",
      actionType: "email",
      actionLabel: "New Email"
    },
    {
      id: "openDrafts",
      title: "Stories & Drafts",
      marker: "openDrafts",
      visible: true,
      order: 7,
      colSpan: 1,
      columns: [["Status", "status"], ["Round", "round"], ["Project", "project"]],
      emptyMessage: "No open drafts.",
      actionType: "story",
      actionLabel: "New Story"
    },
    {
      id: "recentlyTouched",
      title: "Recently Touched",
      marker: "recentlyTouched",
      visible: true,
      order: 8,
      colSpan: 2,
      columns: [["Kind", "kind"], ["Status", "status"], ["Project", "project"]],
      emptyMessage: "Nothing touched in the last seven days."
    },
    {
      id: "activityHeatmap",
      title: "Activity",
      marker: "activityHeatmap",
      visible: false,
      order: 9,
      colSpan: 3,
      columns: [],
      emptyMessage: "No notes created yet."
    },
    {
      id: "onThisDay",
      title: "On This Day",
      marker: "onThisDay",
      visible: false,
      order: 10,
      colSpan: 1,
      columns: [],
      emptyMessage: "Nothing from this day in previous years."
    },
    {
      id: "writingGoal",
      title: "Writing Goal",
      marker: "writingGoal",
      visible: false,
      order: 11,
      colSpan: 1,
      columns: [],
      emptyMessage: "Set a daily word goal under Layout to track progress."
    },
    {
      id: "moonPhase",
      title: "Moon & Daylight",
      marker: "moonPhase",
      visible: false,
      order: 12,
      colSpan: 1,
      columns: [],
      emptyMessage: "Set a location under Weather to show sunrise, sunset, and daylight."
    },
    {
      id: "staleNotes",
      title: "Needs Attention",
      marker: "staleNotes",
      visible: false,
      order: 13,
      colSpan: 1,
      columns: [],
      emptyMessage: "Nothing has gone stale."
    }
  ];
  var TodayEngine = class {
    constructor(initialLayout) {
      __publicField(this, "layout");
      const base = initialLayout ?? {
        journalWidthPercent: 65,
        showQuickCaptureBar: true,
        widgets: JSON.parse(JSON.stringify(DEFAULT_TODAY_WIDGETS))
      };
      this.layout = {
        ...base,
        columns: base.columns ?? "auto",
        density: base.density ?? "comfortable",
        weather: { ...DEFAULT_WEATHER, ...base.weather ?? {} },
        writingGoalWords: base.writingGoalWords ?? 500,
        staleThresholdDays: base.staleThresholdDays ?? 14
      };
    }
    getLayout() {
      return JSON.parse(JSON.stringify(this.layout));
    }
    getVisibleWidgets() {
      return this.layout.widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);
    }
    toggleWidgetVisibility(widgetId, visible) {
      const widget = this.layout.widgets.find((w) => w.id === widgetId);
      if (widget) {
        widget.visible = visible !== void 0 ? visible : !widget.visible;
      }
      return this.getLayout();
    }
    reorderWidgets(orderedIds) {
      orderedIds.forEach((id, index) => {
        const widget = this.layout.widgets.find((w) => w.id === id);
        if (widget) {
          widget.order = index + 1;
        }
      });
      return this.getLayout();
    }
    setColumns(columns) {
      this.layout.columns = columns;
      return this.getLayout();
    }
    setDensity(density) {
      this.layout.density = density;
      return this.getLayout();
    }
    setWeather(updates) {
      this.layout.weather = { ...DEFAULT_WEATHER, ...this.layout.weather, ...updates };
      return this.getLayout();
    }
    setQuickCaptureBar(visible) {
      this.layout.showQuickCaptureBar = visible;
      return this.getLayout();
    }
    setJournalWidth(percent) {
      this.layout.journalWidthPercent = Math.min(85, Math.max(35, percent));
      return this.getLayout();
    }
    setWritingGoalWords(words) {
      this.layout.writingGoalWords = Math.max(0, Math.round(words) || 0);
      return this.getLayout();
    }
    setStaleThresholdDays(days) {
      this.layout.staleThresholdDays = Math.max(1, Math.round(days) || 1);
      return this.getLayout();
    }
    updateWidget(widgetId, updates) {
      const widget = this.layout.widgets.find((w) => w.id === widgetId);
      if (widget) {
        Object.assign(widget, updates);
      }
      return this.getLayout();
    }
  };

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

  // src/engine/noteCreationEngine.ts
  var EDIT_ROUND_CONTENT = "<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>EDITORIAL NOTES</h2><p></p><h2>REQUESTED CHANGES</h2><ul><li></li></ul><h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p><h2>WRITER RESPONSE</h2><p></p>";
  var STORY_DRAFT_CONTENT = "<h2>HED</h2><ul><li></li><li></li><li></li></ul><h2>DEK</h2><ul><li></li><li></li><li></li></ul><h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p><h2>STORYBODY</h2><p></p><p>--ENDIT--</p>";
  var REPORTING_NOTES_CONTENT = "<h2>LINKS</h2><ul><li></li></ul><h2>OPEN QUESTIONS</h2><ul><li></li></ul><h2>IDEA / ANGLE</h2><p></p><h2>REPORTING NOTES</h2><p></p><div class='reporting-note-actions-placeholder' data-reporting-note-actions='true'></div>";
  var NoteCreationEngine = class {
    constructor(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine = new SettingsEngine()) {
      this.templateEngine = templateEngine;
      this.relationshipEngine = relationshipEngine;
      this.ifThenRuleEngine = ifThenRuleEngine;
      this.settingsEngine = settingsEngine;
    }
    planNoteCreation(request) {
      const isStoryOrEdit = request.type === "story" || request.type === "edit";
      const relValues = request.relations || {};
      const hasExistingProject = Boolean(relValues.project || request.targetContainerId);
      let templateId = request.type;
      let rootContainerMarker = "";
      if (isStoryOrEdit && !hasExistingProject) {
        templateId = "projectHub";
        rootContainerMarker = "activeProjectRoot";
      } else if (isStoryOrEdit) {
        templateId = "story";
      }
      const template = this.templateEngine.getTemplate(templateId);
      if (!template) {
        throw new Error(`Unknown note template type: '${request.type}'`);
      }
      const mode = request.mode || (request.type === "edit" ? "edit" : "project");
      const date = request.date || /* @__PURE__ */ new Date();
      const formattedTitle = this.templateEngine.formatTitle(template.id, request.title, date);
      const labelsToCreate = [];
      const relationsToCreate = [];
      const childNotesToCreate = [];
      const attrValues = request.attributes || {};
      for (const attrDef of template.attributes) {
        const userVal = attrValues[attrDef.name] ?? attrDef.defaultValue;
        if (userVal !== void 0 && userVal !== null && userVal !== "") {
          if (attrDef.type === "label") {
            labelsToCreate.push({ name: attrDef.name, value: String(userVal) });
          } else if (attrDef.type === "relation") {
            const targets = Array.isArray(userVal) ? userVal : [userVal];
            for (const t of targets) {
              relationsToCreate.push({ name: attrDef.name, value: String(t) });
            }
          }
        }
      }
      labelsToCreate.push({ name: template.marker, value: "" });
      if (isStoryOrEdit && !hasExistingProject) {
        labelsToCreate.push({ name: "kind", value: mode });
        labelsToCreate.push({ name: "status", value: "active" });
        labelsToCreate.push({ name: "extHubIcon", value: mode });
        labelsToCreate.push({ name: "iconClass", value: mode === "edit" ? "bx bx-edit-alt" : "bx bx-book" });
        const draftTitle = `${request.title} \u2014 ${mode === "edit" ? "Round" : "Draft"} 1`;
        childNotesToCreate.push({
          title: draftTitle,
          templateId: "story",
          content: mode === "edit" ? EDIT_ROUND_CONTENT : STORY_DRAFT_CONTENT,
          labels: [
            { name: "extStoryDraft", value: "" },
            { name: "round", value: "1" },
            { name: "status", value: mode === "edit" ? "editing" : "drafting" },
            { name: "workflow", value: mode },
            { name: "kind", value: mode }
          ]
        });
        if (mode === "project") {
          childNotesToCreate.push({
            title: `${request.title} \u2014 Reporting Notes`,
            templateId: "reportingNotes",
            content: REPORTING_NOTES_CONTENT,
            labels: [
              { name: "extReportingNotes", value: "" },
              { name: "extReportingTitleManaged", value: "" },
              { name: "status", value: "active" }
            ]
          });
        }
      } else if (isStoryOrEdit) {
        labelsToCreate.push({ name: "workflow", value: mode });
        labelsToCreate.push({ name: "status", value: mode === "edit" ? "editing" : "drafting" });
        labelsToCreate.push({ name: "kind", value: mode });
      }
      const resolved = this.relationshipEngine.resolveCreationRelations(template.id, relValues);
      const autoCloneContainers = resolved.autoCloneContainers;
      const autoCloneContainerMarkers = [];
      const inheritedTopicSources = this.settingsEngine.get("enableDerivedTopics") ? resolved.inheritedTopicSources : [];
      for (const relLabel of resolved.relationLabels) {
        relationsToCreate.push(relLabel);
      }
      const noteContext = {
        noteId: "PREVIEW_ID",
        title: formattedTitle,
        templateId: template.id,
        category: template.category,
        containerMarker: rootContainerMarker || template.rootContainerMarker,
        attributes: { ...attrValues, ...Object.fromEntries(labelsToCreate.map((l) => [l.name, l.value])) },
        relations: relValues
      };
      const executedIfThenRules = [];
      let content = template.defaultContent;
      if (template.id === "story" && (mode === "edit" || attrValues.workflow === "edit" || attrValues.kind === "edit")) {
        content = EDIT_ROUND_CONTENT;
      }
      if (this.settingsEngine.get("autoRunIfThenRulesOnCreation")) {
        const ruleResults = this.ifThenRuleEngine.evaluateEvent("onNoteCreated", noteContext);
        for (const res of ruleResults) {
          if (res.matched) {
            executedIfThenRules.push({ ruleId: res.ruleId, ruleName: res.ruleName });
            for (const action of res.executedActions) {
              if (action.type === "setLabel" && action.params.labelName) {
                labelsToCreate.push({
                  name: action.params.labelName,
                  value: action.params.labelValue || ""
                });
              } else if (action.type === "removeLabel" && action.params.labelName) {
                const idx = labelsToCreate.findIndex((l) => l.name === action.params.labelName);
                if (idx !== -1) labelsToCreate.splice(idx, 1);
              } else if (action.type === "setRelation" && action.params.relationName && action.params.targetNoteId) {
                relationsToCreate.push({
                  name: action.params.relationName,
                  value: action.params.targetNoteId
                });
              } else if (action.type === "cloneToContainer") {
                const relationValue = action.params.relationName ? relValues[action.params.relationName] : void 0;
                for (const targetId of Array.isArray(relationValue) ? relationValue : [relationValue]) {
                  if (targetId && !autoCloneContainers.includes(String(targetId))) {
                    autoCloneContainers.push(String(targetId));
                  }
                }
                if (action.params.containerMarker && !autoCloneContainerMarkers.includes(action.params.containerMarker)) {
                  autoCloneContainerMarkers.push(action.params.containerMarker);
                }
              } else if (action.type === "archiveNote") {
                labelsToCreate.push({ name: "archived", value: "" });
                if (action.params.containerMarker && !autoCloneContainerMarkers.includes(action.params.containerMarker)) {
                  autoCloneContainerMarkers.push(action.params.containerMarker);
                }
              } else if (action.type === "setTaskStatus" && action.params.status) {
                labelsToCreate.push({ name: "status", value: action.params.status });
              } else if (action.type === "prependContent" && action.params.content) {
                content = `${action.params.content}
${content}`;
              }
            }
          }
        }
        for (const child of childNotesToCreate) {
          const childTemplate = this.templateEngine.getTemplate(child.templateId);
          if (!childTemplate) continue;
          const childContext = {
            noteId: "PREVIEW_CHILD_ID",
            title: child.title,
            templateId: childTemplate.id,
            category: childTemplate.category,
            containerMarker: childTemplate.rootContainerMarker,
            attributes: Object.fromEntries(child.labels.map((label) => [label.name, label.value])),
            relations: {}
          };
          const childResults = this.ifThenRuleEngine.evaluateEvent("onNoteCreated", childContext);
          for (const res of childResults) {
            if (!res.matched) continue;
            executedIfThenRules.push({ ruleId: res.ruleId, ruleName: res.ruleName });
            for (const action of res.executedActions) {
              if (action.type === "setLabel" && action.params.labelName) {
                const existing = child.labels.find((label) => label.name === action.params.labelName);
                if (existing) existing.value = action.params.labelValue || "";
                else child.labels.push({ name: action.params.labelName, value: action.params.labelValue || "" });
              } else if (action.type === "removeLabel" && action.params.labelName) {
                const index = child.labels.findIndex((label) => label.name === action.params.labelName);
                if (index !== -1) child.labels.splice(index, 1);
              } else if (action.type === "setTaskStatus" && action.params.status) {
                const existing = child.labels.find((label) => label.name === "status");
                if (existing) existing.value = action.params.status;
                else child.labels.push({ name: "status", value: action.params.status });
              } else if (action.type === "archiveNote") {
                if (!child.labels.some((label) => label.name === "archived")) {
                  child.labels.push({ name: "archived", value: "" });
                }
              } else if (action.type === "prependContent" && action.params.content) {
                child.content = `${action.params.content}
${child.content || ""}`;
              }
            }
          }
        }
      }
      const category = this.templateEngine.getCategory(template.category);
      const journalClone = this.settingsEngine.get("autoJournalClone") && !template.noJournalClone && template.id !== "projectHub" && category?.autoJournalClone !== false;
      return {
        templateId: template.id,
        mode: isStoryOrEdit ? mode : void 0,
        formattedTitle,
        rootContainerMarker: rootContainerMarker || template.rootContainerMarker,
        targetContainerId: request.targetContainerId,
        content,
        labelsToCreate,
        relationsToCreate,
        autoCloneContainers,
        autoCloneContainerMarkers,
        inheritedTopicSources,
        executedIfThenRules,
        childNotesToCreate: childNotesToCreate.length > 0 ? childNotesToCreate : void 0,
        journalClone,
        noteType: template.noteType
      };
    }
  };

  // src/engine/triliumApiBridge.ts
  var TriliumApiBridge = class {
    static getGlob() {
      return globalThis.glob || (typeof window !== "undefined" ? window.glob : null);
    }
    static getFrontendApi(explicitApi) {
      return explicitApi || globalThis.api || (typeof window !== "undefined" ? window.api : null);
    }
    static async authenticatedFetch(pathRelative, options = {}) {
      const glob = this.getGlob();
      if (!glob) {
        throw new Error("Trilium session context is unavailable.");
      }
      const headers = {
        "x-csrf-token": glob.csrfToken || "",
        "trilium-component-id": glob.componentId || "",
        "content-type": "application/json",
        ...options.headers || {}
      };
      const fetchFn = globalThis.fetch || (typeof window !== "undefined" ? window.fetch : null);
      if (!fetchFn) {
        throw new Error("Global fetch API is unavailable.");
      }
      const fullPath = `${glob.baseApiUrl}${pathRelative}`;
      const send = () => fetchFn(fullPath, {
        credentials: "same-origin",
        ...options,
        headers: { ...headers }
      });
      let response = await send();
      if (response.status === 403) {
        const locSearch = globalThis.location?.search || (typeof window !== "undefined" ? window.location?.search : "") || "";
        const bootstrapUrl = `./bootstrap${locSearch}`;
        const bootstrapResp = await fetchFn(bootstrapUrl, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
        if (bootstrapResp && bootstrapResp.ok) {
          const refreshed = await bootstrapResp.json().catch(() => null);
          if (refreshed?.csrfToken) {
            glob.csrfToken = refreshed.csrfToken;
            headers["x-csrf-token"] = refreshed.csrfToken;
            response = await send();
          }
        }
      }
      return response;
    }
    /**
     * Ensures a child note is attached/cloned under a parent note.
     */
    static async ensureNotePresentInParent(childNoteId, parentNoteId, explicitApi) {
      if (!childNoteId || !parentNoteId) return;
      const frontendApi = this.getFrontendApi(explicitApi);
      if (frontendApi && typeof frontendApi.runOnBackend === "function") {
        try {
          const applied = await frontendApi.runOnBackend((cId, pId) => {
            if (typeof api === "undefined" || typeof api.ensureNoteIsPresentInParent !== "function") {
              return false;
            }
            api.ensureNoteIsPresentInParent(cId, pId, "");
            return true;
          }, [childNoteId, parentNoteId]);
          if (applied) return;
        } catch (err) {
        }
      }
      const response = await this.authenticatedFetch(`notes/${childNoteId}/toggle-in-parent/${parentNoteId}/true`, {
        method: "PUT",
        body: JSON.stringify({})
      });
      if (!response.ok) {
        throw new Error(`Failed to clone note ${childNoteId} under ${parentNoteId} (HTTP ${response.status})`);
      }
      const result = await response.json().catch(() => null);
      if (result?.success === false) {
        throw new Error(`Trilium refused to clone note ${childNoteId} under ${parentNoteId}`);
      }
    }
    /**
     * Ensures a child note is removed/unlinked from a parent note.
     */
    static async ensureNoteAbsentFromParent(childNoteId, parentNoteId, explicitApi) {
      if (!childNoteId || !parentNoteId) return;
      const frontendApi = this.getFrontendApi(explicitApi);
      if (frontendApi && typeof frontendApi.runOnBackend === "function") {
        try {
          const applied = await frontendApi.runOnBackend((cId, pId) => {
            if (typeof api === "undefined" || typeof api.ensureNoteIsAbsentFromParent !== "function") {
              return false;
            }
            api.ensureNoteIsAbsentFromParent(cId, pId);
            return true;
          }, [childNoteId, parentNoteId]);
          if (applied) return;
        } catch (err) {
        }
      }
      const response = await this.authenticatedFetch(`notes/${childNoteId}/toggle-in-parent/${parentNoteId}/false`, {
        method: "PUT",
        body: JSON.stringify({})
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to remove note ${childNoteId} from ${parentNoteId} (HTTP ${response.status})`);
      }
      if (response.ok) {
        const result = await response.json().catch(() => null);
        if (result?.success === false) {
          throw new Error(`Trilium refused to remove note ${childNoteId} from ${parentNoteId}`);
        }
      }
    }
    /**
     * Sets or updates a note attribute (label or relation).
     */
    static async setNoteAttribute(noteId, type, name, value, targetNoteId, explicitApi) {
      if (!noteId || !name) return;
      const frontendApi = this.getFrontendApi(explicitApi);
      if (frontendApi && typeof frontendApi.runOnBackend === "function") {
        try {
          const applied = await frontendApi.runOnBackend(
            (nId, aType, aName, aVal, tId) => {
              if (typeof api === "undefined") return false;
              const note = api.getNote?.(nId);
              if (!note) return false;
              if (aType === "label") {
                note.setLabel(aName, aVal || "");
                return true;
              }
              if (aType === "relation" && tId) {
                note.setRelation(aName, tId);
                return true;
              }
              return false;
            },
            [noteId, type, name, value || "", targetNoteId || ""]
          );
          if (applied) return;
        } catch (err) {
        }
      }
      const payload = { type, name, isInheritable: false };
      if (type === "label") payload.value = value || "";
      if (type === "relation") payload.value = targetNoteId || value || "";
      const response = await this.authenticatedFetch(`notes/${noteId}/set-attribute`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Failed to set attribute '${name}' on note ${noteId} (HTTP ${response.status})`);
      }
      const result = await response.json().catch(() => null);
      if (result?.success === false) {
        throw new Error(`Trilium refused to set attribute '${name}' on note ${noteId}`);
      }
    }
    /**
     * Sets a note title.
     */
    static async setNoteTitle(noteId, title, explicitApi) {
      if (!noteId) return;
      const frontendApi = this.getFrontendApi(explicitApi);
      if (frontendApi && typeof frontendApi.runOnBackend === "function") {
        try {
          const applied = await frontendApi.runOnBackend((nId, newTitle) => {
            if (typeof api === "undefined") return false;
            const note = api.getNote?.(nId);
            if (!note) return false;
            note.title = newTitle;
            note.save();
            return true;
          }, [noteId, title]);
          if (applied) return;
        } catch (err) {
        }
      }
      const response = await this.authenticatedFetch(`notes/${noteId}/title`, {
        method: "PUT",
        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        throw new Error(`Failed to set title on note ${noteId} (HTTP ${response.status})`);
      }
      const result = await response.json().catch(() => null);
      if (result?.success === false) {
        throw new Error(`Trilium refused to set the title on note ${noteId}`);
      }
    }
  };

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
  async function writeLabel(note, name, value, explicitApi) {
    return TriliumApiBridge.setNoteAttribute(note.noteId, "label", name, value, void 0, explicitApi);
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
  var YAML_SPEC_LABEL = "packageData:yamlSpecification";
  async function loadYamlSpecification(explicitApi) {
    const note = await findManifestNote(explicitApi);
    const raw = note ? note.getOwnedLabelValue(YAML_SPEC_LABEL) : memoryStore.get(YAML_SPEC_LABEL) ?? null;
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  async function saveYamlSpecification(yamlSpec, explicitApi) {
    const serialized = JSON.stringify(yamlSpec);
    const note = await findManifestNote(explicitApi);
    if (note) {
      await writeLabel(note, YAML_SPEC_LABEL, serialized, explicitApi);
    } else {
      memoryStore.set(YAML_SPEC_LABEL, serialized);
    }
  }
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
  async function saveAutomationSetting(key, value, explicitApi) {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const note = await findManifestNote(explicitApi);
    if (note) {
      await writeLabel(note, settingLabelName(key), serialized, explicitApi);
    } else {
      memoryStore.set(key, serialized);
    }
  }

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

  // src/engine/yamlSpec.ts
  var SPEC_VERSION = "1.1.0";
  var PACKAGE_ID2 = "iansherr/ikmal_tools_trilium";
  var HEADER = `# ==============================================================================
# Trilium Notes System \u2014 package specification
#
# Everything the package can be configured with: the Today Homepage layout, the
# template categories, every template (schema, promoted attributes, parent links
# and content skeleton) and the automation rules.
#
# Editing and saving this replaces the live configuration. Auto-filing and topic
# inheritance are not listed separately \u2014 they are derived from each template's
# parentLinks below.
# ==============================================================================
`;
  var DEFAULT_STARTER_YAML_SPEC = `${HEADER}
version: ${SPEC_VERSION}
packageId: ${PACKAGE_ID2}
homepage:
  columns: auto
  density: comfortable
categories: []
templates: []
ifThenRules: []
`;
  function dumpYamlSpec(todayLayout, templateEngine, _relationshipEngine, ifThenRuleEngine) {
    const spec = {
      version: SPEC_VERSION,
      packageId: PACKAGE_ID2,
      homepage: dumpHomepage(todayLayout),
      categories: templateEngine.getAllCategories().map(dumpCategory),
      templates: templateEngine.getAllTemplates().map(dumpTemplate),
      ifThenRules: ifThenRuleEngine.getAllRules().map(dumpRule)
    };
    return `${HEADER}
${YamlParser.stringify(spec)}
`;
  }
  function dumpHomepage(layout) {
    return {
      journalWidthPercent: layout.journalWidthPercent,
      showQuickCaptureBar: layout.showQuickCaptureBar,
      columns: layout.columns ?? "auto",
      density: layout.density ?? "comfortable",
      weather: {
        label: layout.weather?.label ?? "",
        latitude: layout.weather?.latitude ?? 0,
        longitude: layout.weather?.longitude ?? 0,
        units: layout.weather?.units ?? "metric"
      },
      writingGoalWords: layout.writingGoalWords ?? 500,
      staleThresholdDays: layout.staleThresholdDays ?? 14,
      widgets: [...layout.widgets].sort((a, b) => a.order - b.order).map((w) => ({
        id: w.id,
        title: w.title,
        marker: w.marker,
        visible: w.visible,
        order: w.order,
        colSpan: w.colSpan
      }))
    };
  }
  function dumpCategory(cat) {
    return {
      id: cat.id,
      title: cat.title,
      description: cat.description,
      icon: cat.icon,
      defaultRootMarker: cat.defaultRootMarker ?? "",
      autoJournalClone: cat.autoJournalClone !== false,
      inheritParentTopics: cat.inheritParentTopics !== false,
      projectScopedDefault: Boolean(cat.projectScopedDefault),
      isBuiltin: Boolean(cat.isBuiltin)
    };
  }
  function dumpTemplate(tpl) {
    return {
      id: tpl.id,
      marker: tpl.marker,
      title: tpl.title,
      icon: tpl.icon,
      category: tpl.category,
      rootContainerMarker: tpl.rootContainerMarker,
      titlePattern: tpl.titlePattern,
      projectScoped: Boolean(tpl.projectScoped),
      noJournalClone: Boolean(tpl.noJournalClone),
      isBuiltin: Boolean(tpl.isBuiltin),
      attributes: (tpl.attributes ?? []).map((a) => ({
        name: a.name,
        type: a.type,
        dataType: a.dataType,
        label: a.label ?? "",
        defaultValue: a.defaultValue ?? "",
        options: a.options ?? [],
        isPromoted: a.isPromoted !== false
      })),
      parentLinks: (tpl.relationships ?? []).map((r) => ({
        relationName: r.relationName,
        targetTemplateId: r.targetTemplateId,
        targetTemplateName: r.targetTemplateName,
        isMulti: Boolean(r.isMulti),
        autoCloneToParent: r.autoCloneToParent !== false,
        inheritTopics: r.inheritTopics !== false,
        direction: r.direction
      })),
      defaultContent: tpl.defaultContent ?? ""
    };
  }
  function dumpRule(rule) {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      isBuiltin: Boolean(rule.isBuiltin),
      trigger: {
        type: rule.trigger.type,
        targetCategory: rule.trigger.targetCategory ?? "",
        targetTemplateId: rule.trigger.targetTemplateId ?? "",
        targetContainerMarker: rule.trigger.targetContainerMarker ?? "",
        attributeName: rule.trigger.attributeName ?? ""
      },
      conditions: (rule.conditions ?? []).map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value
      })),
      actions: (rule.actions ?? []).map((a) => ({
        type: a.type,
        params: a.params ?? {}
      }))
    };
  }
  function parseAndApplyYamlSpec(yamlString, todayEngine, templateEngine, ifThenRuleEngine) {
    if (!yamlString || !yamlString.trim()) {
      return { success: false, message: "Specification is empty." };
    }
    let spec;
    try {
      spec = YamlParser.parse(yamlString);
    } catch (err) {
      return { success: false, message: `Could not parse the specification: ${err.message}` };
    }
    if (!spec || typeof spec !== "object") {
      return { success: false, message: "Specification did not parse to a mapping." };
    }
    const applied = [];
    try {
      const widgets = applyHomepage(spec.homepage, todayEngine);
      if (widgets !== null) applied.push(`homepage layout (${widgets} widgets)`);
      const categories = applyCategories(spec.categories, templateEngine);
      if (categories !== null) applied.push(`${categories} categories`);
      const templates = applyTemplates(spec.templates, templateEngine);
      if (templates !== null) applied.push(`${templates} templates`);
      const rules = applyRules(spec.ifThenRules, ifThenRuleEngine);
      if (rules !== null) applied.push(`${rules} automation rules`);
    } catch (err) {
      return { success: false, message: `Could not apply the specification: ${err.message}` };
    }
    if (!applied.length) {
      return { success: false, message: "Nothing recognisable to apply \u2014 expected homepage, categories, templates or ifThenRules." };
    }
    return { success: true, message: `Applied ${applied.join(", ")}.` };
  }
  function applyHomepage(homepage, todayEngine) {
    if (!homepage || typeof homepage !== "object") return null;
    if (typeof homepage.journalWidthPercent === "number") {
      todayEngine.setJournalWidth(homepage.journalWidthPercent);
    }
    if (typeof homepage.showQuickCaptureBar === "boolean") {
      todayEngine.setQuickCaptureBar(homepage.showQuickCaptureBar);
    }
    if (homepage.columns === "auto" || [1, 2, 3].includes(homepage.columns)) {
      todayEngine.setColumns(homepage.columns);
    }
    if (homepage.density === "comfortable" || homepage.density === "compact") {
      todayEngine.setDensity(homepage.density);
    }
    if (homepage.weather && typeof homepage.weather === "object") {
      const { label, latitude, longitude, units } = homepage.weather;
      todayEngine.setWeather({
        label: typeof label === "string" ? label : "",
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0,
        units: units === "imperial" ? "imperial" : "metric"
      });
    }
    if (typeof homepage.writingGoalWords === "number") {
      todayEngine.setWritingGoalWords(homepage.writingGoalWords);
    }
    if (typeof homepage.staleThresholdDays === "number") {
      todayEngine.setStaleThresholdDays(homepage.staleThresholdDays);
    }
    const widgets = Array.isArray(homepage.widgets) ? homepage.widgets : [];
    for (const widget of widgets) {
      if (!widget?.id) continue;
      const updates = {};
      if (typeof widget.title === "string") updates.title = widget.title;
      if (typeof widget.marker === "string") updates.marker = widget.marker;
      if (typeof widget.visible === "boolean") updates.visible = widget.visible;
      if ([1, 2, 3].includes(widget.colSpan)) updates.colSpan = widget.colSpan;
      todayEngine.updateWidget(widget.id, updates);
    }
    const ordered = widgets.filter((w) => w?.id).map((w) => String(w.id));
    if (ordered.length) todayEngine.reorderWidgets(ordered);
    return widgets.length;
  }
  function applyCategories(categories, templateEngine) {
    if (!Array.isArray(categories)) return null;
    let count = 0;
    for (const cat of categories) {
      if (!cat?.id) continue;
      const existing = templateEngine.getCategory(cat.id);
      templateEngine.registerCategory({
        id: String(cat.id),
        title: cat.title ?? existing?.title ?? cat.id,
        description: cat.description ?? existing?.description ?? "",
        icon: cat.icon ?? existing?.icon ?? "layer",
        defaultRootMarker: cat.defaultRootMarker || existing?.defaultRootMarker || "projectRoot",
        autoJournalClone: cat.autoJournalClone !== false,
        inheritParentTopics: cat.inheritParentTopics !== false,
        projectScopedDefault: Boolean(cat.projectScopedDefault),
        isBuiltin: Boolean(cat.isBuiltin ?? existing?.isBuiltin)
      });
      count++;
    }
    return count;
  }
  function applyTemplates(templates, templateEngine) {
    if (!Array.isArray(templates)) return null;
    let count = 0;
    for (const tpl of templates) {
      if (!tpl?.id) continue;
      const existing = templateEngine.getTemplate(tpl.id);
      const definition = {
        id: String(tpl.id),
        marker: tpl.marker ?? existing?.marker ?? `ext${tpl.id}`,
        title: tpl.title ?? existing?.title ?? String(tpl.id),
        icon: tpl.icon ?? existing?.icon ?? "file-blank",
        category: tpl.category ?? existing?.category ?? "work",
        rootContainerMarker: tpl.rootContainerMarker ?? existing?.rootContainerMarker ?? "projectRoot",
        titlePattern: tpl.titlePattern ?? existing?.titlePattern ?? "{title}",
        defaultContent: tpl.defaultContent ?? existing?.defaultContent ?? "",
        projectScoped: Boolean(tpl.projectScoped),
        noJournalClone: Boolean(tpl.noJournalClone),
        isBuiltin: Boolean(tpl.isBuiltin ?? existing?.isBuiltin),
        attributes: Array.isArray(tpl.attributes) ? tpl.attributes.filter((a) => a?.name).map((a) => ({
          name: String(a.name),
          type: a.type === "relation" ? "relation" : "label",
          dataType: a.dataType ?? "string",
          ...a.label ? { label: String(a.label) } : {},
          ...a.defaultValue !== "" && a.defaultValue != null ? { defaultValue: a.defaultValue } : {},
          ...Array.isArray(a.options) && a.options.length ? { options: a.options.map(String) } : {},
          isPromoted: a.isPromoted !== false
        })) : existing?.attributes ?? [],
        relationships: Array.isArray(tpl.parentLinks) ? tpl.parentLinks.filter((r) => r?.relationName).map((r) => ({
          id: `rel_${tpl.id}_${r.relationName}`,
          name: `${r.relationName} link`,
          relationName: String(r.relationName),
          targetTemplateId: String(r.targetTemplateId ?? ""),
          targetTemplateName: String(r.targetTemplateName ?? r.targetTemplateId ?? ""),
          isMulti: Boolean(r.isMulti),
          autoCloneToParent: r.autoCloneToParent !== false,
          inheritTopics: r.inheritTopics !== false,
          direction: r.direction === "child" || r.direction === "peer" ? r.direction : "parent"
        })) : existing?.relationships ?? []
      };
      templateEngine.registerTemplate(definition);
      count++;
    }
    return count;
  }
  function applyRules(rules, ifThenRuleEngine) {
    if (!Array.isArray(rules)) return null;
    let count = 0;
    for (const rule of rules) {
      if (!rule?.id) continue;
      const trigger = rule.trigger ?? {};
      ifThenRuleEngine.registerRule({
        id: String(rule.id),
        name: rule.name ?? String(rule.id),
        description: rule.description ?? "",
        enabled: rule.enabled !== false,
        isBuiltin: Boolean(rule.isBuiltin),
        trigger: {
          type: trigger.type ?? "onNoteCreated",
          ...trigger.targetCategory ? { targetCategory: String(trigger.targetCategory) } : {},
          ...trigger.targetTemplateId ? { targetTemplateId: String(trigger.targetTemplateId) } : {},
          ...trigger.targetContainerMarker ? { targetContainerMarker: String(trigger.targetContainerMarker) } : {},
          ...trigger.attributeName ? { attributeName: String(trigger.attributeName) } : {}
        },
        conditions: Array.isArray(rule.conditions) ? rule.conditions.filter((c) => c?.field).map((c) => ({
          field: String(c.field),
          operator: c.operator ?? "isSet",
          value: c.value
        })) : [],
        actions: Array.isArray(rule.actions) ? rule.actions.filter((a) => a?.type).map((a) => ({
          type: a.type,
          params: a.params && typeof a.params === "object" ? a.params : {}
        })) : []
      });
      count++;
    }
    return count;
  }
  function exportTemplateToYaml(tpl) {
    const dumped = dumpTemplate(tpl);
    return `# Trilium Template Definition: ${tpl.title} (#${tpl.marker})
${YamlParser.stringify({ template: dumped })}
`;
  }
  function importTemplateFromYaml(yamlString) {
    if (!yamlString || !yamlString.trim()) {
      throw new Error("YAML template string is empty.");
    }
    const parsed = YamlParser.parse(yamlString);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("YAML did not parse into a valid mapping.");
    }
    const tplObj = parsed.template ?? parsed;
    if (!tplObj.id && !tplObj.title) {
      throw new Error("Template definition must specify at least an id or title.");
    }
    const id = String(tplObj.id || tplObj.title.toLowerCase().replace(/\s+/g, "-"));
    return {
      id,
      marker: String(tplObj.marker || `ext${id.charAt(0).toUpperCase()}${id.slice(1)}`),
      title: String(tplObj.title || id),
      icon: String(tplObj.icon || "file-blank"),
      category: String(tplObj.category || "work"),
      rootContainerMarker: String(tplObj.rootContainerMarker || "projectRoot"),
      titlePattern: String(tplObj.titlePattern || "{title}"),
      defaultContent: String(tplObj.defaultContent || ""),
      projectScoped: Boolean(tplObj.projectScoped),
      noJournalClone: Boolean(tplObj.noJournalClone),
      isBuiltin: Boolean(tplObj.isBuiltin),
      attributes: Array.isArray(tplObj.attributes) ? tplObj.attributes.filter((a) => a?.name).map((a) => ({
        name: String(a.name),
        type: a.type === "relation" ? "relation" : "label",
        dataType: a.dataType ?? "string",
        ...a.label ? { label: String(a.label) } : {},
        ...a.defaultValue !== "" && a.defaultValue != null ? { defaultValue: a.defaultValue } : {},
        ...Array.isArray(a.options) && a.options.length ? { options: a.options.map(String) } : {},
        isPromoted: a.isPromoted !== false
      })) : [],
      relationships: Array.isArray(tplObj.parentLinks ?? tplObj.relationships) ? (tplObj.parentLinks ?? tplObj.relationships).filter((r) => r?.relationName).map((r) => ({
        id: `rel_${id}_${r.relationName}`,
        name: `${r.relationName} link`,
        relationName: String(r.relationName),
        targetTemplateId: String(r.targetTemplateId ?? ""),
        targetTemplateName: String(r.targetTemplateName ?? r.targetTemplateId ?? ""),
        isMulti: Boolean(r.isMulti),
        autoCloneToParent: r.autoCloneToParent !== false,
        inheritTopics: r.inheritTopics !== false,
        direction: r.direction === "child" || r.direction === "peer" ? r.direction : "parent"
      })) : []
    };
  }

  // src/engine/weatherEngine.ts
  var API_URL = "https://api.open-meteo.com/v1/forecast";
  var WMO_CODES = {
    0: { icon: "sun", label: "Clear" },
    1: { icon: "sun", label: "Mainly clear" },
    2: { icon: "cloud", label: "Partly cloudy" },
    3: { icon: "cloud", label: "Overcast" },
    45: { icon: "water", label: "Fog" },
    48: { icon: "water", label: "Freezing fog" },
    51: { icon: "cloud-drizzle", label: "Light drizzle" },
    53: { icon: "cloud-drizzle", label: "Drizzle" },
    55: { icon: "cloud-drizzle", label: "Heavy drizzle" },
    56: { icon: "cloud-drizzle", label: "Freezing drizzle" },
    57: { icon: "cloud-drizzle", label: "Freezing drizzle" },
    61: { icon: "cloud-light-rain", label: "Light rain" },
    63: { icon: "cloud-rain", label: "Rain" },
    65: { icon: "cloud-rain", label: "Heavy rain" },
    66: { icon: "cloud-rain", label: "Freezing rain" },
    67: { icon: "cloud-rain", label: "Freezing rain" },
    71: { icon: "cloud-snow", label: "Light snow" },
    73: { icon: "cloud-snow", label: "Snow" },
    75: { icon: "cloud-snow", label: "Heavy snow" },
    77: { icon: "cloud-snow", label: "Snow grains" },
    80: { icon: "cloud-light-rain", label: "Light showers" },
    81: { icon: "cloud-rain", label: "Showers" },
    82: { icon: "cloud-rain", label: "Heavy showers" },
    85: { icon: "cloud-snow", label: "Snow showers" },
    86: { icon: "cloud-snow", label: "Heavy snow showers" },
    95: { icon: "cloud-lightning", label: "Thunderstorm" },
    96: { icon: "cloud-lightning", label: "Thunderstorm with hail" },
    99: { icon: "cloud-lightning", label: "Thunderstorm with hail" }
  };
  function describeWeatherCode(code, isDay = true) {
    const condition = WMO_CODES[code] ?? { icon: "cloud", label: "Unknown" };
    if (!isDay && condition.icon === "sun") {
      return { icon: "moon", label: condition.label };
    }
    return condition;
  }
  function buildWeatherUrl({ latitude, longitude, units }) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,is_day,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration",
      timezone: "auto",
      forecast_days: "3"
    });
    if (units === "imperial") {
      params.set("temperature_unit", "fahrenheit");
      params.set("wind_speed_unit", "mph");
    }
    return `${API_URL}?${params.toString()}`;
  }
  function hasLocation(weather) {
    if (!weather) return false;
    const { latitude, longitude } = weather;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    if (latitude === 0 && longitude === 0) return false;
    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  }
  function parseWeatherResponse(data) {
    const current = data?.current ?? {};
    const daily = data?.daily ?? {};
    const units = data?.current_units ?? {};
    const isDay = current.is_day !== 0;
    const days = (daily.time ?? []).map((date, i) => ({
      date,
      high: Math.round(daily.temperature_2m_max?.[i]),
      low: Math.round(daily.temperature_2m_min?.[i]),
      // Daily codes summarise the whole day, so they always read as daytime.
      condition: describeWeatherCode(daily.weather_code?.[i], true)
    }));
    return {
      temperature: Math.round(current.temperature_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      isDay,
      condition: describeWeatherCode(current.weather_code, isDay),
      days,
      temperatureUnit: units.temperature_2m ?? "\xB0",
      windUnit: units.wind_speed_10m ?? "",
      sunrise: daily.sunrise?.[0] ?? null,
      sunset: daily.sunset?.[0] ?? null,
      daylightSeconds: typeof daily.daylight_duration?.[0] === "number" ? Math.round(daily.daylight_duration[0]) : null
    };
  }
  async function fetchWeather(weather, signal) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timedOut = false;
    const timeoutId = controller ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 5e3) : null;
    const forwardAbort = () => controller?.abort();
    if (signal && controller) {
      signal.addEventListener("abort", forwardAbort);
    }
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener("abort", forwardAbort);
    };
    try {
      const response = await fetch(buildWeatherUrl(weather), {
        signal: controller?.signal || signal
      });
      cleanup();
      if (!response.ok) {
        throw new Error(`Weather service returned ${response.status}`);
      }
      return parseWeatherResponse(await response.json());
    } catch (err) {
      cleanup();
      if (timedOut && err?.name === "AbortError") {
        throw new Error("Weather request timed out after 5 seconds");
      }
      throw err;
    }
  }

  // src/engine/noteInsightsEngine.ts
  function toLocalIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function buildActivityHeatmap(createdTimestamps, today = /* @__PURE__ */ new Date(), weeks = 12) {
    const counts = /* @__PURE__ */ new Map();
    for (const ts of createdTimestamps) {
      if (!Number.isFinite(ts)) continue;
      const key = toLocalIsoDate(new Date(ts));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
    const start = new Date(endOfWeek);
    start.setDate(start.getDate() - (weeks * 7 - 1));
    const result = [];
    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const key = toLocalIsoDate(cursor);
        days.push({ date: key, count: counts.get(key) ?? 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push({ days });
    }
    return result;
  }
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
  function computeWritingGoalProgress(current, goal) {
    const safeGoal = Math.max(0, Math.floor(goal) || 0);
    const safeCurrent = Math.max(0, Math.floor(current) || 0);
    const percent = safeGoal === 0 ? 0 : Math.min(100, Math.round(safeCurrent / safeGoal * 100));
    return {
      current: safeCurrent,
      goal: safeGoal,
      percent,
      remaining: Math.max(0, safeGoal - safeCurrent),
      metGoal: safeGoal > 0 && safeCurrent >= safeGoal
    };
  }
  function countWords(htmlOrText) {
    const text = htmlOrText.replace(/<[^>]*>/g, " ");
    const words = text.split(/\s+/).filter(Boolean);
    return words.length;
  }
  var SYNODIC_MONTH_DAYS = 29.530588853;
  var KNOWN_NEW_MOON_MS = Date.UTC(2e3, 0, 6, 18, 14);
  var MOON_PHASE_NAMES = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent"
  ];
  function computeMoonPhase(date = /* @__PURE__ */ new Date()) {
    const diffDays = (date.getTime() - KNOWN_NEW_MOON_MS) / (24 * 60 * 60 * 1e3);
    const fraction = (diffDays % SYNODIC_MONTH_DAYS + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS / SYNODIC_MONTH_DAYS;
    const illumination = (1 - Math.cos(fraction * 2 * Math.PI)) / 2;
    const bucket = Math.floor(fraction * 8 + 0.5) % 8;
    const name = MOON_PHASE_NAMES[bucket];
    return { fraction, illumination, name, icon: "moon" };
  }
  var QUOTE_BANK = [
    { text: "The unexamined life is not worth living.", author: "Socrates" },
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
    { text: "Well begun is half done.", author: "Aristotle" },
    { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
    { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
    { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
    { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
    { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "Do the difficult things while they are easy and do the great things while they are small.", author: "Lao Tzu" },
    { text: "Nothing great was ever achieved without enthusiasm.", author: "Ralph Waldo Emerson" },
    { text: "Write it on your heart that every day is the best day in the year.", author: "Ralph Waldo Emerson" },
    { text: "Go confidently in the direction of your dreams. Live the life you have imagined.", author: "Henry David Thoreau" },
    { text: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "The two most important days in your life are the day you are born and the day you find out why.", author: "Mark Twain" },
    { text: "What we think, we become.", author: "Buddha" }
  ];
  function pickDailyQuote(date = /* @__PURE__ */ new Date()) {
    const dayOfYear = Math.floor(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / (24 * 60 * 60 * 1e3)
    );
    return QUOTE_BANK[dayOfYear % QUOTE_BANK.length];
  }

  // src/components/nativeUi.ts
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function pageHeader({ icon, title, subtitle, actions }) {
    const header = document.createElement("div");
    header.className = "ns-page-header";
    const inner = document.createElement("div");
    inner.className = "ns-page-header-inner";
    inner.innerHTML = `
        <span class="ns-page-header-icon bx ${escapeHtml(icon)}" aria-hidden="true"></span>
        <div class="ns-page-header-titles">
            <h2 class="ns-page-header-title">${escapeHtml(title)}</h2>
            ${subtitle ? `<p class="ns-page-header-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
    `;
    if (actions?.length) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "ns-page-header-actions";
      actions.forEach((a) => actionsEl.appendChild(a));
      inner.appendChild(actionsEl);
    }
    header.appendChild(inner);
    return header;
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
  function row(control, { label, description, htmlFor, compact, stacked }) {
    const rowEl = document.createElement("div");
    rowEl.className = `ns-row${compact ? " ns-row-compact" : ""}${stacked ? " ns-row-stacked" : ""}`;
    rowEl.innerHTML = `
        <div class="ns-row-label">
            <label${htmlFor ? ` for="${escapeHtml(htmlFor)}"` : ""}>${escapeHtml(label)}</label>
            ${description ? `<small class="ns-row-desc">${escapeHtml(description)}</small>` : ""}
        </div>
    `;
    const input = document.createElement("div");
    input.className = "ns-row-input";
    if (typeof control === "string") {
      input.innerHTML = control;
    } else {
      input.appendChild(control);
    }
    rowEl.appendChild(input);
    return rowEl;
  }
  function toggle(id, checked, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = `ns-switch${checked ? " is-on" : " is-off"}`;
    wrapper.innerHTML = `
        <label class="ns-switch-control">
            <div class="ns-switch-button${checked ? " on" : ""}">
                <input type="checkbox" id="${escapeHtml(id)}" role="switch" aria-checked="${checked}" aria-label="Toggle setting"${checked ? " checked" : ""}>
            </div>
        </label>
        <span class="ns-switch-state" aria-live="polite">${checked ? "ON" : "OFF"}</span>
    `;
    const input = wrapper.querySelector("input");
    const track = wrapper.querySelector(".ns-switch-button");
    const state = wrapper.querySelector(".ns-switch-state");
    input.addEventListener("change", () => {
      track.classList.toggle("on", input.checked);
      wrapper.classList.toggle("is-on", input.checked);
      wrapper.classList.toggle("is-off", !input.checked);
      input.setAttribute("aria-checked", String(input.checked));
      state.textContent = input.checked ? "ON" : "OFF";
      onChange?.(input.checked);
    });
    return wrapper;
  }
  function switchRow({ id, checked, onChange, ...rest }) {
    return row(toggle(id, checked, onChange), { ...rest, htmlFor: id, compact: true });
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
  function bindAsyncClick(button2, onClick) {
    button2.addEventListener("click", () => {
      try {
        Promise.resolve(onClick()).catch((error) => {
          console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
        });
      } catch (error) {
        console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
      }
    });
  }
  function button({ text, icon, kind = "secondary", size = "small", title, className, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    const sizeClass = size === "small" ? " btn-sm" : size === "micro" ? " btn-micro" : "";
    btn.className = `btn btn-${kind}${sizeClass}${className ? ` ${className}` : ""}`;
    if (title) btn.title = title;
    btn.innerHTML = `${icon ? `<span class="bx ${escapeHtml(icon)}"></span> ` : ""}${escapeHtml(text)}`;
    if (onClick) bindAsyncClick(btn, onClick);
    return btn;
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
  function openModal({ title, icon, body, confirmText, confirmKind = "primary", cancelText = "Cancel" }, onConfirm) {
    const backdrop = document.createElement("div");
    backdrop.className = "ns-modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "ns-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
        <div class="ns-modal-header">
            <h5 class="ns-modal-title">${icon ? `<span class="bx ${escapeHtml(icon)}"></span> ` : ""}${escapeHtml(title)}</h5>
            <button type="button" class="btn-close ns-close" aria-label="Close"></button>
        </div>
        <div class="ns-modal-body">${body}</div>
        <div class="ns-modal-footer">
            <button type="button" class="btn btn-sm btn-secondary ns-close">${escapeHtml(cancelText)}</button>
            <button type="button" class="btn btn-sm btn-${confirmKind} ns-confirm">${escapeHtml(confirmText)}</button>
        </div>
    `;
    const close = () => {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
    };
    function onKeyDown(e) {
      if (e.key === "Escape") close();
    }
    modal.querySelectorAll(".ns-close").forEach((btn) => btn.addEventListener("click", close));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener("keydown", onKeyDown);
    modal.querySelector(".ns-confirm").addEventListener("click", () => {
      if (onConfirm(modal) !== false) close();
    });
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    modal.querySelector("input, select, textarea")?.focus();
    return modal;
  }
  function fuzzyScore(query, text) {
    if (!query) return 0;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx !== -1) return idx;
    let cursor = 0;
    let gaps = 0;
    for (const ch of q) {
      const found = t.indexOf(ch, cursor);
      if (found === -1) return null;
      gaps += found - cursor;
      cursor = found + 1;
    }
    return 1e3 + gaps;
  }
  function searchableSelect({
    id,
    options,
    value,
    isMulti,
    placeholder,
    onChange
  }) {
    const wrapper = document.createElement("div");
    wrapper.className = "ns-combobox";
    let selectedValues = isMulti ? Array.isArray(value) ? [...value] : value ? [value] : [] : [];
    let selectedValue = isMulti ? "" : typeof value === "string" ? value : Array.isArray(value) && value.length > 0 ? value[0] : "";
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "ns-combobox-tags";
    if (!isMulti) tagsContainer.style.display = "none";
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.className = "form-control form-control-sm";
    input.autocomplete = "off";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-autocomplete", "list");
    if (placeholder) input.placeholder = placeholder;
    const panel = document.createElement("div");
    panel.className = "ns-combobox-panel";
    panel.setAttribute("role", "listbox");
    panel.hidden = true;
    wrapper.append(tagsContainer, input, panel);
    let visible = [];
    let highlighted = -1;
    const labelFor = (v) => options.find((o) => o.value === v)?.label ?? v;
    function renderTags() {
      if (!isMulti) return;
      tagsContainer.innerHTML = "";
      for (const val of selectedValues) {
        const tag = document.createElement("span");
        tag.className = "ns-combobox-tag";
        tag.innerHTML = `<span>${escapeHtml(labelFor(val))}</span><i class="bx bx-x ns-remove-tag" data-val="${escapeHtml(val)}"></i>`;
        tag.querySelector(".ns-remove-tag")?.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeValue(val);
        });
        tagsContainer.appendChild(tag);
      }
    }
    function removeValue(val) {
      selectedValues = selectedValues.filter((v) => v !== val);
      renderTags();
      onChange?.([...selectedValues]);
    }
    function highlight(index) {
      highlighted = index;
      Array.from(panel.children).forEach((el, i) => el.classList.toggle("active", i === index));
    }
    function closePanel() {
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      highlighted = -1;
    }
    function selectOption(option) {
      if (isMulti) {
        if (!selectedValues.includes(option.value)) {
          selectedValues.push(option.value);
          renderTags();
          onChange?.([...selectedValues]);
        }
        input.value = "";
        closePanel();
      } else {
        selectedValue = option.value;
        input.value = option.label;
        closePanel();
        onChange?.(option.value);
      }
    }
    function renderPanel(query) {
      visible = options.map((o) => ({ o, score: fuzzyScore(query, o.label) })).filter((x) => x.score !== null).sort((a, b) => a.score - b.score).map((x) => x.o);
      panel.innerHTML = "";
      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "ns-combobox-empty";
        empty.textContent = "No matches.";
        panel.appendChild(empty);
      } else {
        for (const option of visible) {
          const item = document.createElement("div");
          const isSelected = isMulti ? selectedValues.includes(option.value) : selectedValue === option.value;
          item.className = `ns-combobox-option${isSelected ? " is-selected" : ""}`;
          item.setAttribute("role", "option");
          const iconHtml = option.icon ? `<i class="bx ${escapeHtml(option.icon)} text-primary me-1"></i>` : "";
          item.innerHTML = `<span>${iconHtml}${escapeHtml(option.label)}${isSelected ? ' <i class="bx bx-check text-success ms-1"></i>' : ""}</span>${option.description ? `<span class="ns-meta">${escapeHtml(option.description)}</span>` : ""}`;
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectOption(option);
          });
          panel.appendChild(item);
        }
      }
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      highlighted = -1;
    }
    input.addEventListener("focus", () => {
      input.select();
      renderPanel("");
    });
    input.addEventListener("input", () => renderPanel(input.value));
    input.addEventListener("blur", () => {
      if (isMulti) {
        input.value = "";
      } else {
        input.value = labelFor(selectedValue);
      }
      closePanel();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (isMulti) {
          input.value = "";
        } else {
          input.value = labelFor(selectedValue);
        }
        closePanel();
        input.blur();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (panel.hidden) {
          renderPanel(input.value);
          return;
        }
        const delta = e.key === "ArrowDown" ? 1 : -1;
        highlight(Math.max(0, Math.min(visible.length - 1, highlighted + delta)));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const option = highlighted >= 0 ? visible[highlighted] : visible[0];
        if (option) selectOption(option);
      }
    });
    if (isMulti) {
      renderTags();
      input.value = "";
    } else {
      input.value = labelFor(selectedValue);
    }
    return {
      el: wrapper,
      getValue: () => isMulti ? [...selectedValues] : selectedValue,
      setValue: (v) => {
        if (isMulti) {
          selectedValues = Array.isArray(v) ? [...v] : v ? [v] : [];
          renderTags();
          input.value = "";
        } else {
          selectedValue = typeof v === "string" ? v : v[0] ?? "";
          input.value = labelFor(selectedValue);
        }
      },
      setOptions: (newOptions) => {
        options = [...newOptions];
        if (!isMulti) input.value = labelFor(selectedValue);
      }
    };
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

  // src/engine/todayRollover.ts
  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function localTimezoneKey(date) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
    return `${timezone}|offset=${date.getTimezoneOffset()}`;
  }
  function snapshotTodayClock(date, monotonicMs) {
    return {
      dateKey: localDateKey(date),
      timezoneKey: localTimezoneKey(date),
      wallClockMs: date.getTime(),
      monotonicMs
    };
  }
  function nextLocalMidnight(date) {
    const next = new Date(date.getTime());
    next.setHours(24, 0, 0, 0);
    return next;
  }
  function detectTodayClockChange(previous, current, driftToleranceMs = 5 * 60 * 1e3) {
    if (previous.dateKey !== current.dateKey) return "date-change";
    if (previous.timezoneKey !== current.timezoneKey) return "timezone-change";
    const wallDelta = current.wallClockMs - previous.wallClockMs;
    const monotonicDelta = current.monotonicMs - previous.monotonicMs;
    if (Math.abs(wallDelta - monotonicDelta) > driftToleranceMs) return "clock-change";
    return null;
  }
  function startTodayRolloverMonitor(onRollover, options = {}) {
    const now = options.now || (() => /* @__PURE__ */ new Date());
    const monotonicNow = options.monotonicNow || (() => globalThis.performance?.now?.() ?? Date.now());
    const setTimeoutFn = options.setTimeout || ((handler, timeout) => globalThis.setTimeout(handler, timeout));
    const clearTimeoutFn = options.clearTimeout || ((timer2) => globalThis.clearTimeout(timer2));
    const checkIntervalMs = Math.max(6e4, options.checkIntervalMs || 60 * 60 * 1e3);
    let previous = snapshotTodayClock(now(), monotonicNow());
    let timer = null;
    let stopped = false;
    const check = () => {
      if (stopped) return;
      if (options.shouldContinue && !options.shouldContinue()) {
        stop();
        return;
      }
      const currentDate = now();
      const current = snapshotTodayClock(currentDate, monotonicNow());
      const reason = detectTodayClockChange(previous, current);
      previous = current;
      if (reason) onRollover(reason);
      schedule(currentDate);
    };
    const schedule = (currentDate) => {
      if (stopped) return;
      const untilMidnight = Math.max(1e3, nextLocalMidnight(currentDate).getTime() - currentDate.getTime() + 250);
      const delay = Math.min(untilMidnight, checkIntervalMs);
      timer = setTimeoutFn(check, delay);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearTimeoutFn(timer);
      timer = null;
    };
    schedule(now());
    return stop;
  }

  // src/components/TodayHomepage.tsx
  var SAMPLE_TASKS = [
    { id: "t1", title: "Review quarterly goals & roadmap", priority: "high", status: "todo", project: "Trilium Extension" },
    { id: "t2", title: "Publish LanguageTool plugin update", priority: "medium", status: "in_progress", project: "LanguageTool Plugin" },
    { id: "t3", title: "Setup ETAPI automated test suite", priority: "high", status: "done", project: "Trilium Extension" }
  ];
  var SAMPLE_ACTIVE_PROJECTS = [
    { id: "sample_project_1", title: "Trilium Extension", kind: "project", status: "active", startDate: Date.now() }
  ];
  var KANBAN_COLUMNS = [
    { id: "todo", title: "To do" },
    { id: "in_progress", title: "In progress" },
    { id: "done", title: "Completed" }
  ];
  var activeTodayRenderers = /* @__PURE__ */ new WeakMap();
  var TODAY_QUICK_CAPTURE_ACTIONS = [
    { type: "projectHub", label: "New Project", icon: "book", title: "Create a new Project Hub" },
    { type: "scratch", label: "New Scratch", icon: "file-blank", title: "Create a scratch note" },
    { type: "meeting", label: "New Meeting", icon: "calendar-event", title: "Create a new Meeting" },
    { type: "task", label: "New Task", icon: "check-square", title: "Create a new Task" },
    { type: "story", label: "New Story", icon: "news", title: "Create a new Story draft" },
    { type: "edit", label: "New Edit", icon: "edit-alt", title: "Create a new Edit round" },
    { type: "email", label: "New Email", icon: "envelope", title: "Create a new Email draft" },
    { type: "person", label: "New Person", icon: "user", title: "Create a new Person" },
    { type: "organization", label: "New Org", icon: "buildings", title: "Create a new Organization" },
    { type: "topic", label: "New Topic", icon: "purchase-tag", title: "Create a new Topic" }
  ];
  function renderTodayHomepage(container, todayEngine, templateEngine, onQuickCapture, settingsEngine, options = {}) {
    activeTodayRenderers.get(container)?.();
    let mode = "preview";
    const showEditor = options.showEditor !== false;
    const showJournalCard = options.showJournalCard === true;
    const showOpenTasks = options.showOpenTasks !== false;
    let journalContext = null;
    let journalOpenPromise = null;
    let splitWidthTimers = [];
    let weatherCache = null;
    let weatherError = "";
    let weatherPending = false;
    let weatherRequestKey = "";
    let noteSummaryCache = null;
    let noteSummaryPending = false;
    let taskCache = null;
    let taskPending = false;
    let activeProjectCache = null;
    let activeProjectPending = false;
    let wordsTodayCache = null;
    let wordsTodayPending = false;
    let dataGeneration = 0;
    let disposed = false;
    let stopTodayRolloverMonitor = null;
    function resetDateSensitiveState() {
      dataGeneration += 1;
      noteSummaryPending = false;
      taskPending = false;
      activeProjectPending = false;
      wordsTodayPending = false;
      noteSummaryCache = null;
      taskCache = null;
      activeProjectCache = null;
      wordsTodayCache = null;
    }
    function refresh() {
      if (disposed) return;
      container.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.className = "today-homepage-wrapper";
      if (todayEngine.getLayout().density === "compact") {
        wrapper.classList.add("ns-compact");
      }
      if (options.showHeader !== false) {
        wrapper.appendChild(pageHeader({
          icon: "bx-home-alt",
          title: options.title || "Today Homepage",
          subtitle: options.subtitle || "Daily dashboard with quick capture, live kanban, and a component grid.",
          actions: showEditor ? [modeSwitcher()] : void 0
        }));
      }
      if (mode === "edit") {
        renderEditor(wrapper);
      } else {
        renderDashboard(wrapper);
      }
      container.appendChild(wrapper);
    }
    function modeSwitcher() {
      const group = document.createElement("div");
      group.className = "btn-group btn-group-sm";
      group.setAttribute("role", "group");
      for (const m of [
        { id: "edit", label: "Edit", icon: "bx-slider" },
        { id: "preview", label: "Preview", icon: "bx-show" }
      ]) {
        const btn = button({
          text: m.label,
          icon: m.icon,
          size: "small",
          className: mode === m.id ? "active" : void 0,
          onClick: () => {
            mode = m.id;
            refresh();
          }
        });
        btn.setAttribute("aria-pressed", String(mode === m.id));
        group.appendChild(btn);
      }
      return group;
    }
    function renderEditor(parent) {
      const layout = todayEngine.getLayout();
      const { card } = section(parent, { title: "Layout" });
      const widthInput = document.createElement("input");
      widthInput.type = "number";
      widthInput.className = "form-control form-control-sm";
      widthInput.id = "journal-width";
      widthInput.min = "35";
      widthInput.max = "85";
      widthInput.value = String(layout.journalWidthPercent);
      widthInput.addEventListener("change", () => {
        todayEngine.setJournalWidth(Number(widthInput.value));
        widthInput.value = String(todayEngine.getLayout().journalWidthPercent);
      });
      card.appendChild(row(widthInput, {
        label: "Journal split width",
        description: "Percentage of the homepage given to the journal panel, between 35 and 85.",
        htmlFor: "journal-width"
      }));
      card.appendChild(switchRow({
        id: "quick-capture-bar",
        label: "Show the quick capture bar",
        description: "Buttons at the top of the dashboard for creating a note from a template.",
        checked: layout.showQuickCaptureBar,
        onChange: (checked) => todayEngine.setQuickCaptureBar(checked)
      }));
      const columns = document.createElement("select");
      columns.className = "form-select form-select-sm";
      columns.id = "grid-columns";
      columns.innerHTML = [
        ["auto", "Fit to width"],
        ["1", "One column"],
        ["2", "Two columns"],
        ["3", "Three columns"]
      ].map(([value, label]) => `<option value="${value}"${String(layout.columns) === value ? " selected" : ""}>${label}</option>`).join("");
      columns.addEventListener("change", () => {
        const value = columns.value;
        todayEngine.setColumns(value === "auto" ? "auto" : Number(value));
      });
      card.appendChild(row(columns, {
        label: "Grid columns",
        description: "How many widgets sit side by side at full width. Fewer are shown automatically in a narrow pane.",
        htmlFor: "grid-columns"
      }));
      const density = document.createElement("select");
      density.className = "form-select form-select-sm";
      density.id = "grid-density";
      density.innerHTML = `
            <option value="comfortable"${layout.density !== "compact" ? " selected" : ""}>Comfortable</option>
            <option value="compact"${layout.density === "compact" ? " selected" : ""}>Compact</option>
        `;
      density.addEventListener("change", () => {
        todayEngine.setDensity(density.value);
        refresh();
      });
      card.appendChild(row(density, {
        label: "Density",
        description: "Compact trades padding for more of the dashboard on screen.",
        htmlFor: "grid-density"
      }));
      const widgets = [...layout.widgets].sort((a, b) => a.order - b.order);
      const { card: widgetCard } = section(parent, {
        title: `Widgets (${widgets.filter((w) => w.visible).length} of ${widgets.length} shown)`,
        description: "Which panels appear on the dashboard, how wide they are, and in what order."
      });
      widgets.forEach((widget, idx) => {
        widgetCard.appendChild(widgetRow(widget, idx, widgets));
      });
      renderWeatherSettings(parent, layout.weather);
      renderLocalInsightsSettings(parent, layout);
      const { card: guideCard } = section(parent, {
        title: "How it works",
        description: "The three engine layers behind everything the dashboard creates."
      });
      for (const [label, description] of [
        ["1. Pick a template", "Tasks, meetings, story drafts, and project hubs come pre-formatted with title patterns and promoted fields."],
        ["2. Connect relationships", "Notes link to parent hubs and organizations; topic tags are derived and inherited from them."],
        ["3. Automate with rules", "If/then rules run on creation, e.g. marking a high-priority task due soon."]
      ]) {
        guideCard.appendChild(row("<span></span>", { label, description, compact: true }));
      }
    }
    function widgetRow(widget, idx, ordered) {
      const visibility = toggle(`widget-${widget.id}`, widget.visible, (visible) => {
        todayEngine.toggleWidgetVisibility(widget.id, visible);
        refresh();
      });
      const span = document.createElement("select");
      span.className = "form-select form-select-sm";
      span.style.width = "auto";
      span.innerHTML = `
            <option value="1"${widget.colSpan === 1 ? " selected" : ""}>One column</option>
            <option value="2"${widget.colSpan === 2 ? " selected" : ""}>Two columns</option>
            <option value="3"${widget.colSpan === 3 ? " selected" : ""}>Full width</option>
        `;
      span.addEventListener("change", () => {
        todayEngine.updateWidget(widget.id, { colSpan: Number(span.value) });
      });
      const move = (delta) => {
        const ids = ordered.map((w) => w.id);
        const target = idx + delta;
        [ids[idx], ids[target]] = [ids[target], ids[idx]];
        todayEngine.reorderWidgets(ids);
        refresh();
      };
      const up = iconAction({ icon: "bx-up-arrow-alt", title: `Move ${widget.title} up`, onClick: () => move(-1) });
      if (idx === 0) up.classList.add("disabled");
      const down = iconAction({ icon: "bx-down-arrow-alt", title: `Move ${widget.title} down`, onClick: () => move(1) });
      if (idx === ordered.length - 1) down.classList.add("disabled");
      return listItem({
        title: widget.title,
        // The marker identifies the widget: it is the tag whose notes it collects.
        description: `Collects notes tagged #${widget.marker}.`,
        disabled: !widget.visible,
        actions: [visibility, span, up, down]
      });
    }
    function renderWeatherSettings(parent, weather) {
      const current = weather ?? { label: "", latitude: 0, longitude: 0, units: "metric" };
      const { card } = section(parent, {
        title: "Weather",
        description: "Turn on the Weather widget above to show it. It fetches the forecast from open-meteo.com, which needs no account and receives only these coordinates."
      });
      const label = document.createElement("input");
      label.type = "text";
      label.className = "form-control form-control-sm";
      label.id = "weather-label";
      label.placeholder = "Berkeley";
      label.value = current.label;
      label.addEventListener("change", () => todayEngine.setWeather({ label: label.value }));
      card.appendChild(row(label, {
        label: "Location name",
        description: "Shown on the widget. Not sent anywhere.",
        htmlFor: "weather-label"
      }));
      const coords = document.createElement("div");
      coords.className = "ns-actions";
      const lat = coordinateInput("weather-lat", "Latitude", current.latitude);
      const lon = coordinateInput("weather-lon", "Longitude", current.longitude);
      const commitCoordinates = () => {
        todayEngine.setWeather({ latitude: Number(lat.value), longitude: Number(lon.value) });
        weatherCache = null;
        weatherError = "";
      };
      lat.addEventListener("change", commitCoordinates);
      lon.addEventListener("change", commitCoordinates);
      const locate = iconAction({
        icon: "bx-current-location",
        title: "Use my current location",
        onClick: () => {
          if (!navigator.geolocation) {
            window.alert("This browser cannot report a location.");
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => {
              lat.value = position.coords.latitude.toFixed(4);
              lon.value = position.coords.longitude.toFixed(4);
              commitCoordinates();
            },
            (err) => window.alert(`Could not read your location: ${err.message}`)
          );
        }
      });
      coords.append(lat, lon, locate);
      card.appendChild(row(coords, {
        label: "Coordinates",
        description: "Decimal degrees, e.g. 37.8715 and -122.2730.",
        htmlFor: "weather-lat",
        compact: true
      }));
      const units = document.createElement("select");
      units.className = "form-select form-select-sm";
      units.id = "weather-units";
      units.innerHTML = `
            <option value="metric"${current.units !== "imperial" ? " selected" : ""}>Celsius, km/h</option>
            <option value="imperial"${current.units === "imperial" ? " selected" : ""}>Fahrenheit, mph</option>
        `;
      units.addEventListener("change", () => {
        todayEngine.setWeather({ units: units.value });
        weatherCache = null;
      });
      card.appendChild(row(units, { label: "Units", htmlFor: "weather-units" }));
    }
    function coordinateInput(id, ariaLabel, value) {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.className = "form-control form-control-sm";
      input.id = id;
      input.style.width = "110px";
      input.setAttribute("aria-label", ariaLabel);
      input.value = value ? String(value) : "";
      return input;
    }
    function renderLocalInsightsSettings(parent, layout) {
      const { card } = section(parent, {
        title: "Local Insights",
        description: "Settings for Activity, On This Day, Writing Goal, Moon & Daylight, and Needs Attention. All read-only and computed locally, except Moon & Daylight which reuses the Weather location above."
      });
      const goalInput = document.createElement("input");
      goalInput.type = "number";
      goalInput.className = "form-control form-control-sm";
      goalInput.id = "writing-goal-words";
      goalInput.min = "0";
      goalInput.step = "25";
      goalInput.value = String(layout.writingGoalWords ?? 500);
      goalInput.addEventListener("change", () => {
        todayEngine.setWritingGoalWords(Number(goalInput.value));
        goalInput.value = String(todayEngine.getLayout().writingGoalWords);
      });
      card.appendChild(row(goalInput, {
        label: "Daily writing goal",
        description: "Words per day the Writing Goal widget tracks against, from story drafts and edits touched today.",
        htmlFor: "writing-goal-words"
      }));
      const staleInput = document.createElement("input");
      staleInput.type = "number";
      staleInput.className = "form-control form-control-sm";
      staleInput.id = "stale-threshold-days";
      staleInput.min = "1";
      staleInput.value = String(layout.staleThresholdDays ?? 14);
      staleInput.addEventListener("change", () => {
        todayEngine.setStaleThresholdDays(Number(staleInput.value));
        staleInput.value = String(todayEngine.getLayout().staleThresholdDays);
      });
      card.appendChild(row(staleInput, {
        label: "Stale after (days)",
        description: "How long a still-open note can go untouched before Needs Attention flags it.",
        htmlFor: "stale-threshold-days"
      }));
    }
    function renderWeatherWidget(card) {
      const weather = todayEngine.getLayout().weather;
      if (!hasLocation(weather)) {
        card.appendChild(emptyState("No location set. Add coordinates under Weather in Edit."));
        return;
      }
      const key = `${weather.latitude},${weather.longitude},${weather.units}`;
      if (weatherCache?.key === key) {
        card.appendChild(weatherReport(weatherCache.report, weather));
        return;
      }
      if (weatherError && weatherRequestKey === key) {
        const failed = document.createElement("div");
        failed.className = "ns-actions";
        const message = document.createElement("span");
        message.className = "ns-empty";
        message.textContent = weatherError;
        failed.append(message, button({
          text: "Retry",
          icon: "bx-refresh",
          onClick: () => {
            weatherError = "";
            refresh();
          }
        }));
        card.appendChild(failed);
        return;
      }
      card.appendChild(emptyState("Loading forecast\u2026"));
      if (weatherPending) return;
      weatherPending = true;
      weatherRequestKey = key;
      fetchWeather(weather).then((report) => {
        const currentWeather = todayEngine.getLayout().weather ?? weather;
        const currentKey = `${currentWeather.latitude},${currentWeather.longitude},${currentWeather.units}`;
        if (weatherRequestKey === key && currentKey === key) {
          weatherCache = { key, report };
          weatherError = "";
        }
      }).catch((err) => {
        if (weatherRequestKey === key) weatherError = `Could not load the forecast: ${err.message}`;
      }).finally(() => {
        weatherPending = false;
        if (mode === "preview") refresh();
      });
    }
    function weatherReport(report, weather) {
      const el = document.createElement("div");
      const now = document.createElement("div");
      now.className = "ns-weather-now";
      now.innerHTML = `
            <span class="ns-weather-icon bx bx-${escapeHtml(report.condition.icon)}" aria-hidden="true"></span>
            <div>
                <div class="ns-weather-temp">${report.temperature}${escapeHtml(report.temperatureUnit)}</div>
                <div class="ns-meta">
                    ${escapeHtml(report.condition.label)}${weather.label ? ` &middot; ${escapeHtml(weather.label)}` : ""}
                    &middot; wind ${report.windSpeed} ${escapeHtml(report.windUnit)}
                </div>
            </div>
        `;
      el.appendChild(now);
      if (report.days.length) {
        const forecast = document.createElement("div");
        forecast.className = "ns-weather-forecast";
        forecast.innerHTML = report.days.map((day, i) => `
                    <div class="ns-weather-day">
                        <span class="ns-meta">${i === 0 ? "Today" : escapeHtml(weekday(day.date))}</span>
                        <span class="bx bx-${escapeHtml(day.condition.icon)}" aria-hidden="true" title="${escapeHtml(day.condition.label)}"></span>
                        <span>${day.high}&deg;</span>
                        <span class="ns-meta">${day.low}&deg;</span>
                    </div>
                `).join("");
        el.appendChild(forecast);
      }
      return el;
    }
    function weekday(isoDate) {
      const [year, month, day] = isoDate.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString(void 0, { weekday: "short" });
    }
    function triliumApi4() {
      const g = globalThis;
      const runtimeApi = options.api || g.api;
      return runtimeApi && typeof runtimeApi.searchForNotes === "function" ? runtimeApi : null;
    }
    function parseTriliumTimestamp(value) {
      if (typeof value !== "string") return NaN;
      const normalized = value.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
      const parsed = Date.parse(normalized);
      return Number.isNaN(parsed) ? NaN : parsed;
    }
    function buildSampleNoteSummaries(now) {
      const day = 24 * 60 * 60 * 1e3;
      const summaries = [];
      let id = 0;
      for (let offset = 0; offset < 84; offset++) {
        const count = Math.round(Math.abs(Math.sin(offset * 1.7)) * 3);
        for (let i = 0; i < count; i++) {
          const ts = now.getTime() - offset * day - i * 36e5;
          summaries.push({ noteId: `sample_${id++}`, title: "Sample note", dateCreated: ts, dateModified: ts, status: "done" });
        }
      }
      for (const [yearsAgo, title] of [[1, "Kickoff meeting notes"], [3, "First project retro"]]) {
        const anniversary = new Date(now.getFullYear() - yearsAgo, now.getMonth(), now.getDate(), 10, 0, 0);
        summaries.push({ noteId: `sample_anniversary_${yearsAgo}`, title, dateCreated: anniversary.getTime(), dateModified: anniversary.getTime(), status: "done" });
      }
      summaries.push({ noteId: "sample_stale_1", title: "Vendor contract renewal", dateCreated: now.getTime() - 60 * day, dateModified: now.getTime() - 40 * day, status: "todo" });
      summaries.push({ noteId: "sample_fresh_1", title: "This week's planning doc", dateCreated: now.getTime() - 3 * day, dateModified: now.getTime() - 1 * day, status: "in_progress" });
      return summaries;
    }
    async function loadNoteSummaries(generation = dataGeneration) {
      if (noteSummaryCache) return noteSummaryCache;
      const api2 = triliumApi4();
      if (!api2) {
        noteSummaryCache = buildSampleNoteSummaries(/* @__PURE__ */ new Date());
        return noteSummaryCache;
      }
      const markers = templateEngine.getAllTemplates().map((t) => `#${t.marker}`);
      const notes = await api2.searchForNotes(markers.length ? markers.join(" OR ") : "#extTask");
      const summaries = notes.map((note) => ({
        noteId: note.noteId,
        title: note.title,
        dateCreated: parseTriliumTimestamp(note.dateCreated),
        dateModified: parseTriliumTimestamp(note.dateModified),
        status: typeof note.getLabelValue === "function" ? note.getLabelValue("status") ?? void 0 : void 0
      }));
      if (generation === dataGeneration) noteSummaryCache = summaries;
      return summaries;
    }
    function ensureNoteSummariesLoaded(card) {
      if (noteSummaryCache) return true;
      card.appendChild(emptyState("Loading\u2026"));
      if (!noteSummaryPending) {
        const generation = dataGeneration;
        noteSummaryPending = true;
        loadNoteSummaries(generation).catch((error) => {
          console.warn(`[Ikmal Tools] Activity summary could not load: ${error}`);
          if (generation === dataGeneration) noteSummaryCache = [];
        }).finally(() => {
          if (generation === dataGeneration) {
            noteSummaryPending = false;
            if (mode === "preview") refresh();
          }
        });
      }
      return false;
    }
    async function loadTasks() {
      const api2 = triliumApi4();
      if (!api2) return SAMPLE_TASKS;
      const notes = await api2.searchForNotes("#extTask");
      const tasks = [];
      for (const note of notes) {
        const status = typeof note.getLabelValue === "function" ? note.getLabelValue("status") : null;
        const priority = typeof note.getLabelValue === "function" ? note.getLabelValue("priority") : null;
        const projectNote = typeof note.getRelationTarget === "function" ? await note.getRelationTarget("project") : null;
        tasks.push({
          id: note.noteId,
          title: note.title,
          status: status ?? "todo",
          priority: priority ?? "medium",
          project: projectNote?.title ?? ""
        });
      }
      return tasks;
    }
    function noteLabel(note, name) {
      if (typeof note?.getLabelValue === "function") return note.getLabelValue(name) || "";
      if (typeof note?.getOwnedLabelValue === "function") return note.getOwnedLabelValue(name) || "";
      return "";
    }
    function noteMarker(note, name) {
      if (typeof note?.getOwnedLabelValue !== "function") return null;
      const value = note.getOwnedLabelValue(name);
      return value === void 0 || value === null ? null : value;
    }
    function isProjectDashboard(note) {
      return noteMarker(note, "extProjectDashboard") === "projectHub" || noteMarker(note, "extHubDashboard") === "projectHub";
    }
    async function loadProjectDashboardIds(api2) {
      const dashboards = /* @__PURE__ */ new Map();
      for (const query of ["#extProjectDashboard", "#extHubDashboard"]) {
        try {
          for (const dashboard of await api2.searchForNotes(query)) {
            if (dashboard?.noteId && isProjectDashboard(dashboard)) {
              dashboards.set(dashboard.noteId, dashboard);
            }
          }
        } catch {
        }
      }
      const projectDashboardIds = /* @__PURE__ */ new Map();
      for (const dashboard of dashboards.values()) {
        let parentIds = [];
        if (typeof dashboard.getParentNoteIds === "function") {
          try {
            parentIds = await Promise.resolve(dashboard.getParentNoteIds());
          } catch {
            parentIds = [];
          }
        }
        for (const parentId of parentIds || []) {
          if (!projectDashboardIds.has(parentId)) {
            projectDashboardIds.set(parentId, dashboard.noteId);
          }
        }
      }
      return projectDashboardIds;
    }
    async function loadActiveProjects() {
      const api2 = triliumApi4();
      if (!api2) return SAMPLE_ACTIVE_PROJECTS;
      const roots = await api2.searchForNotes("#activeProjectRoot").catch(() => []);
      const projectNotes = [];
      const seen = /* @__PURE__ */ new Set();
      const pending = [...roots || []];
      while (pending.length) {
        const current = pending.shift();
        if (!current?.noteId || seen.has(current.noteId)) continue;
        seen.add(current.noteId);
        const isProject = noteMarker(current, "extProjectHub") !== null || noteMarker(current, "extTemplate") === "projectHub" || noteMarker(current, "noteType") === "projectHub";
        if (isProject) projectNotes.push(current);
        if (typeof current.getChildNotes === "function") {
          const children = await Promise.resolve(current.getChildNotes()).catch(() => []);
          pending.push(...children || []);
        }
      }
      projectNotes.sort((a, b) => parseTriliumTimestamp(noteLabel(b, "startDate") || b.dateModified) - parseTriliumTimestamp(noteLabel(a, "startDate") || a.dateModified));
      const projectDashboardIds = await loadProjectDashboardIds(api2);
      const projectsWithDashboards = await Promise.all(projectNotes.map(async (note) => {
        const dashboardId = projectDashboardIds.get(note.noteId);
        return {
          id: note.noteId,
          dashboardId,
          title: note.title,
          kind: noteLabel(note, "kind") || "project",
          status: noteLabel(note, "status") || "active",
          startDate: parseTriliumTimestamp(noteLabel(note, "startDate") || note.dateModified)
        };
      }));
      return projectsWithDashboards.sort((a, b) => (Number.isFinite(b.startDate) ? b.startDate : 0) - (Number.isFinite(a.startDate) ? a.startDate : 0));
    }
    function ensureActiveProjectsLoaded(card) {
      if (activeProjectCache) return true;
      card.appendChild(emptyState("Loading\u2026"));
      if (!activeProjectPending) {
        const generation = dataGeneration;
        activeProjectPending = true;
        loadActiveProjects().then((projects) => {
          if (generation === dataGeneration) activeProjectCache = projects;
        }).catch((error) => {
          console.warn(`[Ikmal Tools] Active projects could not load: ${error}`);
          if (generation === dataGeneration) activeProjectCache = [];
        }).finally(() => {
          if (generation === dataGeneration) {
            activeProjectPending = false;
            if (mode === "preview") refresh();
          }
        });
      }
      return false;
    }
    function renderActiveProjects(card) {
      if (!ensureActiveProjectsLoaded(card)) return;
      const api2 = triliumApi4();
      if (!activeProjectCache.length) {
        card.appendChild(emptyState("No active projects."));
        return;
      }
      for (const project of activeProjectCache.slice(0, 8)) {
        const actions = api2?.openTabWithNote ? [iconAction({
          icon: "bx-right-arrow-alt",
          title: `Open ${project.title}`,
          onClick: () => api2.openTabWithNote(project.dashboardId || project.id, true)
        })] : void 0;
        card.appendChild(listItem({
          icon: "bx-book",
          title: project.title,
          description: `${project.kind} \xB7 ${project.status}`,
          actions
        }));
      }
    }
    function ensureTasksLoaded(card) {
      if (taskCache) return true;
      card.appendChild(emptyState("Loading\u2026"));
      if (!taskPending) {
        const generation = dataGeneration;
        taskPending = true;
        loadTasks().then((tasks) => {
          if (generation === dataGeneration) taskCache = tasks;
        }).catch((error) => {
          console.warn(`[Ikmal Tools] Tasks could not load: ${error}`);
          if (generation === dataGeneration) taskCache = [];
        }).finally(() => {
          if (generation === dataGeneration) {
            taskPending = false;
            if (mode === "preview") refresh();
          }
        });
      }
      return false;
    }
    async function loadWordsWrittenToday() {
      const api2 = triliumApi4();
      if (!api2) return 340;
      const notes = await api2.searchForNotes("#extStoryDraft OR #extEmailDraft OR #extScratch");
      const todayKey = (/* @__PURE__ */ new Date()).toDateString();
      let total = 0;
      for (const note of notes) {
        const modified = parseTriliumTimestamp(note.dateModified);
        if (!Number.isFinite(modified) || new Date(modified).toDateString() !== todayKey) continue;
        const content = typeof note.getContent === "function" ? await note.getContent() : "";
        total += countWords(content ?? "");
      }
      return total;
    }
    function heatmapLevel(count) {
      if (count <= 0) return 0;
      if (count === 1) return 1;
      if (count <= 3) return 2;
      if (count <= 5) return 3;
      return 4;
    }
    function renderHeatmapWidget(card) {
      if (!ensureNoteSummariesLoaded(card)) return;
      const timestamps = noteSummaryCache.map((n) => n.dateCreated).filter((t) => Number.isFinite(t));
      if (!timestamps.length) {
        card.appendChild(emptyState("No notes created yet."));
        return;
      }
      const grid = document.createElement("div");
      grid.className = "ns-heatmap";
      for (const week of buildActivityHeatmap(timestamps, /* @__PURE__ */ new Date(), 12)) {
        const col = document.createElement("div");
        col.className = "ns-heatmap-week";
        for (const dayCell of week.days) {
          const cell = document.createElement("div");
          cell.className = `ns-heatmap-day level-${heatmapLevel(dayCell.count)}`;
          cell.title = `${dayCell.date}: ${dayCell.count} note${dayCell.count === 1 ? "" : "s"}`;
          col.appendChild(cell);
        }
        grid.appendChild(col);
      }
      card.appendChild(grid);
    }
    function renderOnThisDayWidget(card) {
      if (!ensureNoteSummariesLoaded(card)) return;
      const results = findOnThisDay(noteSummaryCache, /* @__PURE__ */ new Date());
      if (!results.length) {
        card.appendChild(emptyState("Nothing from this day in previous years."));
        return;
      }
      for (const entry of results) {
        card.appendChild(listItem({
          title: entry.title,
          description: `${entry.yearsAgo} year${entry.yearsAgo === 1 ? "" : "s"} ago today`,
          actions: [
            iconAction({
              icon: "bx-show",
              title: "Open Note",
              onClick: () => {
                const api2 = globalThis.api;
                if (api2?.activateNote) api2.activateNote(entry.noteId);
              }
            })
          ]
        }));
      }
    }
    function renderStaleNotesWidget(card) {
      if (!ensureNoteSummariesLoaded(card)) return;
      const threshold = settingsEngine?.get("staleThresholdDays") ?? todayEngine.getLayout().staleThresholdDays ?? 14;
      const stale = findStaleNotes(noteSummaryCache, /* @__PURE__ */ new Date(), threshold);
      if (!stale.length) {
        card.appendChild(emptyState("Nothing has gone stale."));
        return;
      }
      for (const entry of stale.slice(0, 8)) {
        card.appendChild(listItem({
          title: entry.title,
          description: `Untouched for ${entry.daysSinceModified} days`,
          actions: [
            iconAction({
              icon: "bx-show",
              title: "Open Note",
              onClick: () => {
                const api2 = globalThis.api;
                if (api2?.activateNote) api2.activateNote(entry.noteId);
              }
            }),
            iconAction({
              icon: "bx-check-double",
              title: "Mark Touched",
              onClick: () => {
                const frontendApi = globalThis.api;
                if (frontendApi?.runOnBackend) {
                  frontendApi.runOnBackend((id) => {
                    const n = api.getNote?.(id);
                    if (n) n.touch?.();
                  }, [entry.noteId]);
                }
              }
            })
          ]
        }));
      }
    }
    function renderWritingGoalWidget(card) {
      const quote = pickDailyQuote(/* @__PURE__ */ new Date());
      const quoteEl = document.createElement("blockquote");
      quoteEl.className = "ns-quote";
      quoteEl.innerHTML = `<p>&ldquo;${escapeHtml(quote.text)}&rdquo;</p><cite>&mdash; ${escapeHtml(quote.author)}</cite>`;
      card.appendChild(quoteEl);
      if (wordsTodayCache === null) {
        card.appendChild(emptyState("Loading progress\u2026"));
        if (!wordsTodayPending) {
          const generation = dataGeneration;
          wordsTodayPending = true;
          loadWordsWrittenToday().then((count) => {
            if (generation === dataGeneration) wordsTodayCache = count;
          }).catch((error) => {
            console.warn(`[Ikmal Tools] Writing progress could not load: ${error}`);
            if (generation === dataGeneration) wordsTodayCache = 0;
          }).finally(() => {
            if (generation === dataGeneration) {
              wordsTodayPending = false;
              if (mode === "preview") refresh();
            }
          });
        }
        return;
      }
      const goal = settingsEngine?.get("writingGoalWords") ?? todayEngine.getLayout().writingGoalWords ?? 500;
      const progress = computeWritingGoalProgress(wordsTodayCache, goal);
      const bar = document.createElement("div");
      bar.className = "ns-progress";
      bar.innerHTML = `<div class="ns-progress-fill" style="width: ${progress.percent}%"></div>`;
      card.appendChild(bar);
      const label = document.createElement("div");
      label.className = "ns-meta ns-progress-label";
      label.textContent = progress.metGoal ? `${progress.current} / ${progress.goal} words \u2014 goal met!` : `${progress.current} / ${progress.goal} words (${progress.remaining} to go)`;
      card.appendChild(label);
    }
    function renderMoonPhaseWidget(card) {
      const phase = computeMoonPhase(/* @__PURE__ */ new Date());
      const phaseRow = document.createElement("div");
      phaseRow.className = "ns-weather-now";
      phaseRow.innerHTML = `
            <span class="ns-weather-icon bx bx-moon" aria-hidden="true"></span>
            <div>
                <div class="ns-weather-temp">${escapeHtml(phase.name)}</div>
                <div class="ns-meta">${Math.round(phase.illumination * 100)}% illuminated</div>
            </div>
        `;
      card.appendChild(phaseRow);
      const weather = todayEngine.getLayout().weather;
      if (!hasLocation(weather)) {
        const hint = document.createElement("div");
        hint.className = "ns-meta ns-progress-label";
        hint.textContent = "Set a location under Weather to also show sunrise, sunset, and daylight.";
        card.appendChild(hint);
        return;
      }
      const key = `${weather.latitude},${weather.longitude},${weather.units}`;
      if (weatherCache?.key === key) {
        card.appendChild(daylightRow(weatherCache.report));
        return;
      }
      if (weatherError) {
        const hint = document.createElement("div");
        hint.className = "ns-meta ns-progress-label";
        hint.textContent = "Daylight unavailable \u2014 see the Weather widget for details.";
        card.appendChild(hint);
        return;
      }
      card.appendChild(emptyState("Loading daylight\u2026"));
      if (weatherPending) return;
      weatherPending = true;
      weatherRequestKey = key;
      fetchWeather(weather).then((report) => {
        const currentWeather = todayEngine.getLayout().weather ?? weather;
        const currentKey = `${currentWeather.latitude},${currentWeather.longitude},${currentWeather.units}`;
        if (weatherRequestKey === key && currentKey === key) {
          weatherCache = { key, report };
          weatherError = "";
        }
      }).catch((err) => {
        if (weatherRequestKey === key) weatherError = `Could not load daylight: ${err.message}`;
      }).finally(() => {
        weatherPending = false;
        if (mode === "preview") refresh();
      });
    }
    function daylightRow(report) {
      const el = document.createElement("div");
      el.className = "ns-meta ns-progress-label";
      if (!report.sunrise || !report.sunset) {
        el.textContent = "Daylight data unavailable for this location.";
        return el;
      }
      el.innerHTML = `Sunrise ${formatClockTime(report.sunrise)} &middot; Sunset ${formatClockTime(report.sunset)}` + (report.daylightSeconds ? ` &middot; ${formatDaylight(report.daylightSeconds)} of daylight` : "");
      return el;
    }
    function formatClockTime(isoLocal) {
      const date = new Date(isoLocal);
      if (Number.isNaN(date.getTime())) return isoLocal;
      return date.toLocaleTimeString(void 0, { hour: "numeric", minute: "2-digit" });
    }
    function formatDaylight(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round(seconds % 3600 / 60);
      return `${hours}h ${minutes}m`;
    }
    function renderDashboard(parent) {
      const layout = todayEngine.getLayout();
      if (showJournalCard) {
        renderJournalCard(parent);
      }
      if (layout.showQuickCaptureBar) {
        renderQuickCapture(parent);
      }
      const filterRow = document.createElement("div");
      filterRow.className = "ns-filter-row mb-3";
      filterRow.innerHTML = `
            <div class="input-group input-group-sm">
                <span class="input-group-text bg-transparent border-end-0"><i class="bx bx-search text-muted"></i></span>
                <input type="text" class="form-control form-control-sm border-start-0 today-dashboard-filter" placeholder="Filter tasks, projects, and notes on today's homepage\u2026">
            </div>
        `;
      filterRow.querySelector("input")?.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = parent.querySelectorAll(".ns-kanban-card, .ns-list-item, .ns-row, tr");
        items.forEach((item) => {
          const text = item.textContent?.toLowerCase() || "";
          item.style.display = !query || text.includes(query) ? "" : "none";
        });
      });
      parent.appendChild(filterRow);
      const widgets = todayEngine.getVisibleWidgets().filter((widget) => showOpenTasks || widget.id !== "openTasks");
      if (!widgets.length) {
        const { card } = section(parent, { title: "Dashboard" });
        card.appendChild(emptyState("No widgets are shown. Switch to Edit to turn some on."));
        return;
      }
      const grid = document.createElement("div");
      grid.className = `ns-grid ${layout.columns === "auto" || layout.columns === void 0 ? "ns-grid-auto" : `ns-cols-${layout.columns}`}`;
      for (const widget of widgets) {
        const { section: sec, card } = section(grid, {
          title: widget.title,
          actions: widget.actionType ? [iconAction({
            icon: "bx-plus",
            title: widget.actionLabel || `New ${widget.title}`,
            onClick: () => onQuickCapture(widget.actionType)
          })] : void 0
        });
        if (widget.colSpan === 2) sec.classList.add("ns-span-2");
        if (widget.colSpan === 3) sec.classList.add("ns-span-full");
        if (widget.id === "openTasks") {
          renderKanban(card);
        } else if (widget.id === "activeProjects") {
          renderActiveProjects(card);
        } else if (widget.id === "weather") {
          renderWeatherWidget(card);
        } else if (widget.id === "activityHeatmap") {
          renderHeatmapWidget(card);
        } else if (widget.id === "onThisDay") {
          renderOnThisDayWidget(card);
        } else if (widget.id === "writingGoal") {
          renderWritingGoalWidget(card);
        } else if (widget.id === "moonPhase") {
          renderMoonPhaseWidget(card);
        } else if (widget.id === "staleNotes") {
          renderStaleNotesWidget(card);
        } else {
          card.appendChild(emptyState(widget.emptyMessage));
        }
      }
      parent.appendChild(grid);
    }
    function renderJournalCard(parent) {
      const { section: journalSection, card } = section(parent);
      journalSection.classList.add("ns-journal-section");
      card.classList.add("ns-journal-card");
      const api2 = triliumApi4();
      if (!api2?.getTodayNote) {
        card.appendChild(emptyState("Open this page inside Trilium to access today\u2019s journal."));
        return;
      }
      const loading = emptyState("Loading today\u2019s journal\u2026");
      card.appendChild(loading);
      api2.getTodayNote().then((note) => {
        loading.remove();
        const entry = document.createElement("div");
        entry.className = "ns-journal-entry";
        const title = document.createElement("div");
        title.className = "ns-journal-date";
        title.textContent = note?.title || "Today\u2019s journal";
        const hint = document.createElement("div");
        hint.className = "ns-meta";
        hint.textContent = "Keep this page pinned; the button opens the editable day note in a split.";
        const open = button({
          text: "Open Today\u2019s Journal",
          icon: "bx-edit-alt",
          onClick: () => openJournalNote(api2, note.noteId)
        });
        open.classList.add("ns-journal-open");
        const actions = document.createElement("div");
        actions.className = "ns-actions";
        actions.appendChild(open);
        if (api2.getDayNote) {
          actions.appendChild(button({
            text: "Plan for Tomorrow",
            icon: "bx-calendar-plus",
            onClick: async () => {
              const tomorrow = tomorrowDateIso(api2);
              const tomorrowNote = await api2.getDayNote(tomorrow);
              if (!tomorrowNote?.noteId) throw new Error("Trilium did not return tomorrow\u2019s journal note.");
              await openJournalNote(api2, tomorrowNote.noteId);
            }
          }));
        }
        entry.append(title, hint, actions);
        card.appendChild(entry);
      }).catch((error) => {
        loading.textContent = `Today\u2019s journal is unavailable: ${error.message}`;
      });
    }
    function tomorrowDateIso(api2) {
      if (typeof api2?.dayjs === "function") {
        return api2.dayjs().add(1, "day").format("YYYY-MM-DD");
      }
      const tomorrow = /* @__PURE__ */ new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const day = String(tomorrow.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    function contextNoteId(context) {
      return context?.note?.noteId || context?.noteId || null;
    }
    function isDailyContext(context) {
      const note = context?.note;
      return Boolean(note?.hasLabel?.("dateNote") || note?.getLabelValue?.("dateNote") || note?.getOwnedLabelValue?.("dateNote"));
    }
    function splitPair() {
      const todaySplit = container.closest(".note-split");
      const journalNtxId = journalContext?.ntxId;
      if (!todaySplit || !journalNtxId || !todaySplit.parentElement) return null;
      const parent = todaySplit.parentElement;
      const journalSplit = [...parent.children].find(
        (element) => element instanceof HTMLElement && element.classList.contains("note-split") && element.getAttribute("data-ntx-id") === journalNtxId
      );
      return journalSplit ? { todaySplit, journalSplit, parent } : null;
    }
    function applyJournalWidth() {
      const pair = splitPair();
      if (!pair) return false;
      const width = Math.min(85, Math.max(35, Math.round(todayEngine.getLayout().journalWidthPercent)));
      pair.todaySplit.style.width = `${100 - width}%`;
      pair.journalSplit.style.width = `${width}%`;
      return true;
    }
    function scheduleJournalWidth(api2, noteId) {
      for (const timer of splitWidthTimers) window.clearTimeout(timer);
      splitWidthTimers = [];
      const apply = () => {
        if (api2 && noteId) {
          const context = findExactJournalContext(api2, noteId);
          if (context) journalContext = context;
        }
        applyJournalWidth();
      };
      window.requestAnimationFrame(() => {
        apply();
        for (const delay of [50, 150, 350, 750, 1500]) {
          splitWidthTimers.push(window.setTimeout(apply, delay));
        }
      });
    }
    function findExactJournalContext(api2, noteId) {
      const contexts = typeof api2.getNoteContexts === "function" ? api2.getNoteContexts() : [];
      return contexts.find((context) => contextNoteId(context) === noteId);
    }
    async function openJournalNote(api2, noteId) {
      if (!api2?.openSplitWithNote) return;
      if (journalOpenPromise) return journalOpenPromise;
      journalOpenPromise = (async () => {
        let context = findExactJournalContext(api2, noteId);
        if (!context && journalContext && typeof journalContext.setNote === "function") {
          context = await journalContext.setNote(noteId);
        }
        if (!context) {
          const contexts = typeof api2.getNoteContexts === "function" ? api2.getNoteContexts() : [];
          const existingDailyContext = contexts.find((candidate) => isDailyContext(candidate));
          if (existingDailyContext && typeof existingDailyContext.setNote === "function") {
            context = await existingDailyContext.setNote(noteId);
          }
        }
        if (!context) {
          await api2.openSplitWithNote(noteId, true);
          context = findExactJournalContext(api2, noteId);
        }
        if (context) journalContext = context;
        scheduleJournalWidth(api2, noteId);
      })().finally(() => {
        journalOpenPromise = null;
      });
      await journalOpenPromise;
    }
    function renderQuickCapture(parent) {
      const { card } = section(parent, { title: "Quick capture" });
      const actions = document.createElement("div");
      actions.className = "ns-actions";
      for (const action of TODAY_QUICK_CAPTURE_ACTIONS) {
        actions.appendChild(button({
          text: action.label,
          icon: `bx-${action.icon}`,
          className: "ns-quick-capture-action",
          title: action.title,
          onClick: () => onQuickCapture(action.type)
        }));
      }
      card.appendChild(actions);
    }
    function renderKanban(parent) {
      if (!ensureTasksLoaded(parent)) return;
      const board = document.createElement("div");
      board.className = "ns-kanban";
      for (const column of KANBAN_COLUMNS) {
        const tasks = taskCache.filter((t) => t.status === column.id);
        const col = document.createElement("div");
        col.className = "kanban-col";
        col.innerHTML = `
                <div class="ns-kanban-head">
                    <span>${escapeHtml(column.title)}</span>
                    <span class="ns-count">${tasks.length}</span>
                </div>
            `;
        const list = document.createElement("div");
        list.className = "ns-stack";
        if (!tasks.length) {
          list.appendChild(emptyState("Nothing here."));
        } else {
          for (const task of tasks) {
            const card = document.createElement("div");
            card.className = "kanban-card";
            card.innerHTML = `
                        <div>${escapeHtml(task.title)}</div>
                        <div class="ns-meta">${escapeHtml(task.project)} &middot; ${escapeHtml(task.priority)} priority</div>
                    `;
            list.appendChild(card);
          }
        }
        col.appendChild(list);
        board.appendChild(col);
      }
      parent.appendChild(board);
    }
    const refreshHomepage = () => {
      resetDateSensitiveState();
      refresh();
    };
    const dispose = () => {
      disposed = true;
      stopTodayRolloverMonitor?.();
      stopTodayRolloverMonitor = null;
      for (const timer of splitWidthTimers) window.clearTimeout(timer);
      splitWidthTimers = [];
      if (activeTodayRenderers.get(container) === dispose) activeTodayRenderers.delete(container);
    };
    activeTodayRenderers.set(container, dispose);
    stopTodayRolloverMonitor = startTodayRolloverMonitor(() => {
      resetDateSensitiveState();
      refresh();
    }, {
      // The dashboard hands each render a freshly built content div and the
      // Trilium note can be closed outright, so a later render is not
      // guaranteed to arrive and run the disposer above. Detachment is the
      // condition we actually care about. If a host ever detaches and
      // reattaches a live container, it re-runs the render note and gets a
      // fresh monitor; the worst case is the pre-feature behaviour of not
      // repainting at midnight, not a broken page.
      shouldContinue: () => {
        if (container.isConnected) return true;
        dispose();
        return false;
      }
    });
    refresh();
    return refreshHomepage;
  }

  // src/engine/ifThenManualDispatcher.ts
  function labelValue(note, name) {
    const owned = note?.getOwnedLabelValue?.(name);
    if (owned !== void 0 && owned !== null) return String(owned);
    return void 0;
  }
  function buildManualContext(note, templateEngine) {
    const explicitTemplate = labelValue(note, "extTemplate");
    const markerTemplate = templateEngine?.getAllTemplates?.().find((candidate) => labelValue(note, candidate.marker) !== void 0);
    const templateId = explicitTemplate || markerTemplate?.id || "";
    const template = templateEngine?.getTemplate?.(templateId) || markerTemplate;
    const attributes = {};
    const relations = {};
    for (const attribute of note?.getOwnedAttributes?.() || []) {
      if (!attribute?.name) continue;
      if (attribute.type === "relation") {
        const value = attribute.value || attribute.targetNoteId;
        if (value) relations[attribute.name] = String(value);
      } else {
        attributes[attribute.name] = attribute.value ?? "";
      }
    }
    return {
      noteId: note.noteId,
      title: note.title || "",
      templateId,
      category: template?.category || labelValue(note, "category"),
      containerMarker: labelValue(note, "rootContainerMarker"),
      attributes,
      relations
    };
  }
  async function applyManualAction(note, action, frontendApi) {
    const params = action.params || {};
    switch (action.type) {
      case "setLabel":
        if (params.labelName) await TriliumApiBridge.setNoteAttribute(note.noteId, "label", params.labelName, params.labelValue || "", void 0, frontendApi);
        return;
      case "removeLabel":
        if (params.labelName) {
          await frontendApi.runOnBackend?.((noteId, name) => {
            const target = api.getNote(noteId);
            if (target?.getOwnedLabelValue?.(name) !== void 0) target.removeLabel(name);
            return true;
          }, [note.noteId, params.labelName]);
        }
        return;
      case "setRelation":
        if (params.relationName && params.targetNoteId) {
          await TriliumApiBridge.setNoteAttribute(note.noteId, "relation", params.relationName, "", params.targetNoteId, frontendApi);
        }
        return;
      case "setTaskStatus":
        if (params.status) await TriliumApiBridge.setNoteAttribute(note.noteId, "label", "status", String(params.status), void 0, frontendApi);
        return;
      case "cloneToContainer": {
        const targets = params.relationName ? (note.getRelations?.(params.relationName) || []).map((relation) => relation.value || relation.targetNoteId).filter(Boolean) : [frontendApi.getNoteWithLabel?.(params.containerMarker)?.noteId];
        for (const targetId of targets) {
          if (targetId) await TriliumApiBridge.ensureNotePresentInParent(note.noteId, String(targetId), frontendApi);
        }
        return;
      }
      case "archiveNote": {
        const archive = frontendApi.getNoteWithLabel?.(params.containerMarker || "archiveProjectRoot");
        const active = frontendApi.getNoteWithLabel?.("activeProjectRoot");
        const project = frontendApi.getNoteWithLabel?.("projectRoot");
        if (archive) await TriliumApiBridge.ensureNotePresentInParent(note.noteId, archive.noteId, frontendApi);
        if (active) await TriliumApiBridge.ensureNoteAbsentFromParent(note.noteId, active.noteId, frontendApi);
        if (project) await TriliumApiBridge.ensureNoteAbsentFromParent(note.noteId, project.noteId, frontendApi);
        await TriliumApiBridge.setNoteAttribute(note.noteId, "label", "status", "complete", void 0, frontendApi);
        return;
      }
      case "prependContent":
        if (params.content && frontendApi.runOnBackend) {
          await frontendApi.runOnBackend((noteId, prefix) => {
            const target = api.getNote(noteId);
            const current = typeof target?.getContent === "function" ? target.getContent() : "";
            if (target?.setContent && !String(current || "").startsWith(prefix)) target.setContent(`${prefix}
${current || ""}`);
            return true;
          }, [note.noteId, String(params.content)]);
        }
        return;
      case "syncDerivedTopics":
        if (frontendApi.runOnBackend) {
          await frontendApi.runOnBackend((noteId) => {
            const target = api.getNote(noteId);
            if (!target) return false;
            const sourceRelations = ["project", "client", "companyOnBehalf", "organization", "attendee", "writer"];
            const desired = /* @__PURE__ */ new Set();
            for (const relationName of sourceRelations) {
              for (const relation of target.getRelations(relationName) || []) {
                const source = api.getNote(relation.value);
                for (const topic of source?.getRelations?.("topic") || []) {
                  if (topic.value) desired.add(topic.value);
                }
              }
            }
            target.getOwnedRelations?.("derivedTopic")?.forEach((relation) => target.removeRelation("derivedTopic", relation.value));
            desired.forEach((topicId) => target.addRelation("derivedTopic", topicId));
            return true;
          }, [note.noteId]);
        }
        return;
      case "createLinkedNote":
        if (params.templateId && frontendApi.createNote) {
          const parent = frontendApi.getNoteWithLabel?.(params.containerMarker)?.noteId || note.noteId;
          const result = await frontendApi.createNote(parent, {
            title: params.title || `${note.title} \u2014 Linked Note`,
            type: "text",
            content: params.content || ""
          });
          if (result?.note && params.relationName) {
            await TriliumApiBridge.setNoteAttribute(note.noteId, "relation", params.relationName, "", result.note.noteId, frontendApi);
          }
        }
        return;
      case "runScript":
        throw new Error("runScript actions are disabled for safety");
      default:
        return;
    }
  }
  async function runManualIfThenRules(ruleEngine, frontendApi, noteId, templateEngine) {
    if (!frontendApi || !frontendApi.getNote) return 0;
    const targetId = noteId || frontendApi.currentNote?.noteId;
    if (!targetId) return 0;
    const note = frontendApi.getNote(targetId);
    if (!note) return 0;
    const context = buildManualContext(note, templateEngine);
    const results = ruleEngine.evaluateEvent("onManualAction", context).filter((result) => result.matched);
    for (const result of results) {
      for (const action of result.executedActions) {
        await applyManualAction(note, action, frontendApi);
      }
    }
    return results.length;
  }

  // src/components/TemplateStudio.tsx
  var TEMPLATE_TREE = [
    {
      id: "projectHub",
      label: "Project Hub",
      children: [
        { id: "story", label: "Story Project", children: [
          { id: "edit", label: "Edit Package", children: [] },
          { id: "reportingNotes", label: "Reporting Notes", children: [] }
        ] },
        { id: "projectTask", label: "Project Task", children: [] },
        { id: "meeting", label: "Project Meeting", children: [] },
        { id: "scratch", label: "Project Scratch Note", children: [] },
        { id: "person", label: "Project Person", children: [] },
        { id: "organization", label: "Client Organization", children: [] },
        { id: "emailDraft", label: "Email Draft", children: [] },
        { id: "topic", label: "Assigned Topic", children: [] }
      ]
    },
    {
      id: "organization",
      label: "Organization Directory",
      children: [
        { id: "person", label: "Key Contact Person", children: [] },
        { id: "meeting", label: "Client Meeting", children: [
          { id: "meetingPrep", label: "Meeting Prep", children: [] }
        ] }
      ]
    },
    {
      id: "person",
      label: "Person Directory",
      children: [{ id: "meeting", label: "Person Meeting", children: [] }]
    },
    { id: "task", label: "Standalone Task", children: [] },
    { id: "scratch", label: "Unassigned Scratch Note", children: [] },
    { id: "topic", label: "Global Topic Index", children: [] }
  ];
  function renderTemplateStudio(container, templateEngine, ifThenRuleEngine, onSave, frontendApi) {
    let selectedTemplateId = templateEngine.getAllTemplates()[0]?.id || "story";
    let activeEditorTab = "editor";
    let railMode = "templates";
    let selectedCategoryId = templateEngine.getAllCategories()[0]?.id || "work";
    let railSearchQuery = "";
    let showSplitPreview = false;
    function refresh() {
      container.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.className = "template-studio-wrapper";
      const activeTpl = templateEngine.getTemplate(selectedTemplateId);
      const activeCat = templateEngine.getCategory(selectedCategoryId);
      const inCategories = railMode === "categories";
      wrapper.appendChild(pageHeader({
        icon: "bx-layer",
        title: "Template Studio",
        subtitle: "Template schemas, parent links, automation rules, and promoted attributes.",
        actions: [
          ...inCategories || !activeTpl ? [] : [modeSwitcher()],
          ...inCategories ? [
            button({
              text: "New category",
              icon: "bx-plus",
              kind: "primary",
              onClick: () => openNewCategoryModal()
            })
          ] : [
            button({
              text: "Import template",
              icon: "bx-import",
              kind: "secondary",
              onClick: () => openImportTemplateModal()
            }),
            button({
              text: "New template",
              icon: "bx-plus",
              kind: "primary",
              onClick: () => openNewTemplateModal()
            })
          ]
        ]
      }));
      const split = document.createElement("div");
      split.className = "ns-split";
      const rail = document.createElement("div");
      rail.className = "ns-split-rail";
      renderRail(rail);
      split.appendChild(rail);
      const main = document.createElement("div");
      main.className = "ns-split-main";
      if (inCategories && activeCat) {
        renderCategoryEditor(main, activeCat);
      } else if (activeTpl && activeEditorTab === "editor") {
        if (showSplitPreview) {
          const splitContainer = document.createElement("div");
          splitContainer.className = "d-flex gap-3 w-100 flex-column flex-lg-row";
          const schemaPane = document.createElement("div");
          schemaPane.className = "flex-grow-1 w-100 w-lg-50";
          renderSchemaEditor(schemaPane, activeTpl);
          const previewPane = document.createElement("div");
          previewPane.className = "w-100 w-lg-50 border-start ps-0 ps-lg-3 pt-3 pt-lg-0";
          renderPreview(previewPane, activeTpl);
          splitContainer.append(schemaPane, previewPane);
          main.appendChild(splitContainer);
        } else {
          renderSchemaEditor(main, activeTpl);
        }
      } else if (activeTpl) {
        renderPreview(main, activeTpl);
      }
      split.appendChild(main);
      wrapper.appendChild(split);
      container.appendChild(wrapper);
    }
    function modeSwitcher() {
      const group = document.createElement("div");
      group.className = "btn-group btn-group-sm d-flex align-items-center gap-1";
      group.setAttribute("role", "group");
      for (const mode of [
        { id: "editor", label: "Schema", icon: "bx-slider" },
        { id: "preview", label: "Preview", icon: "bx-show" }
      ]) {
        const btn = button({
          text: mode.label,
          icon: mode.icon,
          size: "small",
          className: activeEditorTab === mode.id ? "active" : void 0,
          onClick: () => {
            activeEditorTab = mode.id;
            refresh();
          }
        });
        btn.setAttribute("aria-pressed", String(activeEditorTab === mode.id));
        group.appendChild(btn);
      }
      const splitBtn = button({
        text: showSplitPreview ? "Split Preview: ON" : "Split Preview: OFF",
        icon: "bx-columns",
        size: "small",
        kind: showSplitPreview ? "primary" : "secondary",
        onClick: () => {
          showSplitPreview = !showSplitPreview;
          if (showSplitPreview) activeEditorTab = "editor";
          refresh();
        }
      });
      group.appendChild(splitBtn);
      return group;
    }
    function renderRail(parent) {
      const { card } = section(parent, { title: "Library" });
      const switcher = document.createElement("div");
      switcher.className = "btn-group btn-group-sm";
      switcher.setAttribute("role", "group");
      switcher.style.width = "100%";
      switcher.style.marginBottom = "12px";
      for (const mode of [
        { id: "templates", label: "Templates", count: templateEngine.getAllTemplates().length },
        { id: "categories", label: "Categories", count: templateEngine.getAllCategories().length }
      ]) {
        const btn = button({
          text: `${mode.label} (${mode.count})`,
          size: "small",
          className: railMode === mode.id ? "active" : void 0,
          onClick: () => {
            railMode = mode.id;
            if (mode.id === "templates") activeEditorTab = "editor";
            refresh();
          }
        });
        btn.setAttribute("aria-pressed", String(railMode === mode.id));
        switcher.appendChild(btn);
      }
      card.appendChild(switcher);
      card.appendChild(railMode === "categories" ? categoryList() : templateTree(TEMPLATE_TREE));
    }
    function categoryList() {
      const list = document.createElement("ul");
      list.className = "ns-tree";
      for (const cat of templateEngine.getAllCategories()) {
        const count = templateEngine.getAllTemplates().filter((t) => t.category === cat.id).length;
        const li = document.createElement("li");
        li.appendChild(treeItem({
          icon: cat.icon,
          label: cat.title,
          count,
          selected: cat.id === selectedCategoryId,
          onClick: () => {
            selectedCategoryId = cat.id;
            refresh();
          }
        }));
        list.appendChild(li);
      }
      return list;
    }
    function templateTree(nodes) {
      const list = document.createElement("ul");
      list.className = "ns-tree";
      for (const node of nodes) {
        const tpl = templateEngine.getTemplate(node.id);
        if (!tpl) continue;
        const li = document.createElement("li");
        li.appendChild(treeItem({
          icon: tpl.icon,
          label: node.label || tpl.title,
          selected: tpl.id === selectedTemplateId,
          onClick: () => {
            selectedTemplateId = tpl.id;
            activeEditorTab = "editor";
            refresh();
          }
        }));
        if (node.children.length) {
          li.appendChild(templateTree(node.children));
        }
        list.appendChild(li);
      }
      return list;
    }
    function treeItem({ icon, label, count, selected, onClick }) {
      const item = document.createElement("div");
      item.className = `ns-tree-item${selected ? " selected" : ""}`;
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.title = label;
      item.innerHTML = `
            <span class="bx bx-${escapeHtml(icon)}" aria-hidden="true"></span>
            <span class="ns-tree-item-label">${escapeHtml(label)}</span>
            ${count !== void 0 ? `<span class="ns-count">${count}</span>` : ""}
        `;
      item.addEventListener("click", onClick);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      });
      return item;
    }
    function renderCategoryEditor(parent, cat) {
      const rules = ifThenRuleEngine.getAllRules().filter((r) => r.trigger.targetCategory === cat.id);
      const templates = templateEngine.getAllTemplates().filter((t) => t.category === cat.id);
      const { card } = section(parent, {
        title: cat.title,
        description: cat.description
      });
      const rootInput = document.createElement("input");
      rootInput.type = "text";
      rootInput.className = "form-control form-control-sm";
      rootInput.id = "cat-root";
      rootInput.value = cat.defaultRootMarker || "projectRoot";
      card.appendChild(row(rootInput, {
        label: "Default root container",
        description: "Container tag new notes in this category are filed under, e.g. projectRoot.",
        htmlFor: "cat-root"
      }));
      const journalToggle = switchRow({
        id: "cat-journal",
        label: "File under today's journal note",
        description: "Add a reference link to the current day note when a note in this category is created.",
        checked: cat.autoJournalClone !== false
      });
      card.appendChild(journalToggle);
      const topicsToggle = switchRow({
        id: "cat-topics",
        label: "Inherit parent topics and metadata",
        description: "Absorb topic tags and client details from parent projects and organizations.",
        checked: cat.inheritParentTopics !== false
      });
      card.appendChild(topicsToggle);
      const scopeToggle = switchRow({
        id: "cat-scoped",
        label: "Require a project hub",
        description: "Notes in this category must be linked to a parent project hub.",
        checked: !!cat.projectScopedDefault
      });
      card.appendChild(scopeToggle);
      const { card: tplCard } = section(parent, { title: `Templates (${templates.length})` });
      if (templates.length) {
        for (const t of templates) {
          tplCard.appendChild(listItem({
            icon: `bx-${t.icon}`,
            title: t.title,
            description: `#${t.marker} \xB7 ${t.attributes.length} attributes \xB7 ${t.relationships.length} parent links`,
            actions: [iconAction({
              icon: "bx-link-external",
              title: `Open ${t.title}`,
              onClick: () => {
                railMode = "templates";
                selectedTemplateId = t.id;
                activeEditorTab = "editor";
                refresh();
              }
            })]
          }));
        }
      } else {
        tplCard.appendChild(emptyState("No templates are assigned to this category."));
      }
      renderRuleSection(parent, {
        title: `Automation rules (${rules.length})`,
        description: "Rules that run for every template in this category.",
        rules,
        emptyText: "No category-wide rules.",
        addLabel: "Add category rule",
        onAdd: () => openRuleEditorModal({ targetCategory: cat.id })
      });
      const actions = document.createElement("div");
      actions.className = "ns-actions ns-actions-end";
      actions.appendChild(button({
        text: "Save category",
        icon: "bx-save",
        kind: "primary",
        size: "normal",
        onClick: () => {
          cat.defaultRootMarker = rootInput.value;
          cat.autoJournalClone = journalToggle.querySelector("input").checked;
          cat.inheritParentTopics = topicsToggle.querySelector("input").checked;
          cat.projectScopedDefault = scopeToggle.querySelector("input").checked;
          templateEngine.registerCategory(cat);
          onSave();
          refresh();
        }
      }));
      parent.appendChild(actions);
    }
    function renderSchemaEditor(parent, tpl) {
      const categories = templateEngine.getAllCategories();
      const allRules = ifThenRuleEngine.getAllRules();
      const globalRules = allRules.filter((r) => !r.trigger.targetCategory && !r.trigger.targetTemplateId);
      const catRules = allRules.filter((r) => r.trigger.targetCategory === tpl.category);
      const tplRules = allRules.filter((r) => r.trigger.targetTemplateId === tpl.id);
      const { card } = section(parent, {
        title: tpl.title,
        description: `Marker #${tpl.marker} \xB7 id ${tpl.id}`
      });
      const titleInput = inputControl("tpl-title", tpl.title);
      card.appendChild(row(titleInput, { label: "Title", htmlFor: "tpl-title" }));
      const categorySelect = searchableSelect({
        id: "tpl-category",
        value: tpl.category,
        placeholder: "Search categories\u2026",
        options: categories.map((c) => ({ value: c.id, label: c.title, description: c.description }))
      });
      card.appendChild(row(categorySelect.el, {
        label: "Category",
        description: "Category behaviour and category-wide rules apply to this template.",
        htmlFor: "tpl-category"
      }));
      const patternInput = inputControl("tpl-pattern", tpl.titlePattern);
      card.appendChild(row(patternInput, {
        label: "Title pattern",
        description: "Pattern applied to new note titles, e.g. Project: {title}.",
        htmlFor: "tpl-pattern"
      }));
      const iconGroup = document.createElement("div");
      iconGroup.className = "input-group input-group-sm";
      iconGroup.innerHTML = `<span class="input-group-text"><span class="bx bx-${escapeHtml(tpl.icon)}"></span></span>`;
      const iconInput = inputControl("tpl-icon", tpl.icon);
      iconInput.className = "form-control form-control-sm";
      iconGroup.appendChild(iconInput);
      card.appendChild(row(iconGroup, {
        label: "Icon",
        description: "Boxicons name without the bx- prefix.",
        htmlFor: "tpl-icon"
      }));
      renderRuleSection(parent, {
        title: `Global rules (${globalRules.length})`,
        description: "Run for every note the system creates.",
        rules: globalRules,
        emptyText: "No global rules.",
        addLabel: "Add rule",
        onAdd: () => openRuleEditorModal({})
      });
      renderRuleSection(parent, {
        title: `Category rules (${catRules.length})`,
        description: `Inherited from the ${tpl.category} category.`,
        rules: catRules,
        emptyText: `No rules on the ${tpl.category} category.`,
        addIcon: "bx-category",
        addLabel: `Edit the ${tpl.category} category`,
        onAdd: () => {
          railMode = "categories";
          selectedCategoryId = tpl.category;
          refresh();
        }
      });
      renderTemplateRuleSection(parent, tpl, tplRules);
      const { card: attrCard } = section(parent, {
        title: `Promoted attributes (${tpl.attributes.length})`,
        description: "Fields shown on the note itself when it is created from this template.",
        actions: [iconAction({ icon: "bx-plus", title: "Add attribute", onClick: () => openAddAttrModal(tpl) })]
      });
      if (tpl.attributes.length) {
        const table = document.createElement("table");
        table.className = "ns-table";
        table.innerHTML = `
                <thead>
                    <tr><th>Name</th><th>Kind</th><th>Type</th><th>Default / options</th><th style="width: 80px;">Actions</th></tr>
                </thead>
                <tbody>
                    ${tpl.attributes.map((a, idx) => `
                        <tr>
                            <td><span class="ns-code">${a.type === "relation" ? "~" : "#"}${escapeHtml(a.name)}</span></td>
                            <td>${escapeHtml(a.type)}</td>
                            <td>${escapeHtml(a.dataType)}</td>
                            <td class="ns-meta">${escapeHtml(a.options ? a.options.join(", ") : a.defaultValue ?? "\u2014")}</td>
                            <td>
                                <div class="d-flex align-items-center gap-1">
                                    <button type="button" class="icon-action move-attr-up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""} title="Move Up"><i class="bx bx-chevron-up"></i></button>
                                    <button type="button" class="icon-action move-attr-down" data-idx="${idx}" ${idx === tpl.attributes.length - 1 ? "disabled" : ""} title="Move Down"><i class="bx bx-chevron-down"></i></button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            `;
        table.querySelectorAll(".move-attr-up").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.idx);
            if (idx > 0) {
              const temp = tpl.attributes[idx];
              tpl.attributes[idx] = tpl.attributes[idx - 1];
              tpl.attributes[idx - 1] = temp;
              templateEngine.updateTemplate(tpl.id, { attributes: [...tpl.attributes] });
              onSave();
              refresh();
            }
          });
        });
        table.querySelectorAll(".move-attr-down").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.idx);
            if (idx < tpl.attributes.length - 1) {
              const temp = tpl.attributes[idx];
              tpl.attributes[idx] = tpl.attributes[idx + 1];
              tpl.attributes[idx + 1] = temp;
              templateEngine.updateTemplate(tpl.id, { attributes: [...tpl.attributes] });
              onSave();
              refresh();
            }
          });
        });
        attrCard.appendChild(table);
      } else {
        attrCard.appendChild(emptyState("No promoted attributes."));
      }
      const { card: contentCard } = section(parent, {
        title: "Content skeleton",
        description: "HTML inserted into the body of a new note created from this template."
      });
      const contentArea = document.createElement("textarea");
      contentArea.className = "form-control ns-code";
      contentArea.id = "tpl-content";
      contentArea.rows = 8;
      contentArea.spellcheck = false;
      contentArea.value = tpl.defaultContent;
      contentCard.appendChild(contentArea);
      const actions = document.createElement("div");
      actions.className = "ns-actions ns-actions-end";
      actions.appendChild(button({
        text: "Export YAML",
        icon: "bx-export",
        kind: "secondary",
        size: "normal",
        onClick: () => openExportTemplateModal(tpl)
      }));
      actions.appendChild(button({
        text: "Save template",
        icon: "bx-save",
        kind: "primary",
        size: "normal",
        onClick: () => {
          templateEngine.updateTemplate(tpl.id, {
            title: titleInput.value,
            category: categorySelect.getValue(),
            titlePattern: patternInput.value,
            icon: iconInput.value,
            defaultContent: contentArea.value
          });
          onSave();
          refresh();
        }
      }));
      parent.appendChild(actions);
    }
    function inputControl(id, value) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "form-control form-control-sm";
      input.id = id;
      input.value = value;
      return input;
    }
    function renderRuleSection(parent, opts) {
      const { card } = section(parent, {
        title: opts.title,
        description: opts.description,
        actions: [iconAction({ icon: opts.addIcon ?? "bx-plus", title: opts.addLabel, onClick: opts.onAdd })]
      });
      if (!opts.rules.length) {
        card.appendChild(emptyState(opts.emptyText));
        return;
      }
      for (const rule of opts.rules) {
        card.appendChild(ruleItem(rule));
      }
    }
    function openPresetRuleModal(tpl) {
      openModal({
        title: "Add Automation Rule Preset",
        icon: "bx-magic-wand",
        confirmText: "Apply Preset",
        body: `
                <div class="ns-field mb-3">
                    <label for="preset-select" class="form-label small font-weight-bold">Select Rule Preset for ${escapeHtml(tpl.title)}</label>
                    <select id="preset-select" class="form-select form-select-sm">
                        <option value="archive_done">\u{1F4E6} Auto-archive note when status becomes 'complete' or 'done'</option>
                        <option value="tag_client">\u{1F3F7}\uFE0F Auto-assign client relation tag on creation</option>
                        <option value="prepend_checklist">\u{1F4DD} Prepend editorial & quality checklist to body</option>
                    </select>
                </div>
            `
      }, (content) => {
        const presetVal = content.querySelector("#preset-select")?.value;
        if (!presetVal) return false;
        if (presetVal === "archive_done") {
          ifThenRuleEngine.registerRule({
            id: `preset_archive_${tpl.id}_${Date.now()}`,
            name: `Auto-archive ${tpl.title} on complete`,
            description: `Automatically archives ${tpl.title} when status is complete or done.`,
            enabled: true,
            isBuiltin: false,
            trigger: { type: "onAttributeChanged", targetTemplateId: tpl.id, attributeName: "status" },
            conditions: [{ field: "status", operator: "equals", value: "complete" }],
            actions: [{ type: "archiveNote", params: {} }]
          });
        } else if (presetVal === "tag_client") {
          ifThenRuleEngine.registerRule({
            id: `preset_client_${tpl.id}_${Date.now()}`,
            name: `Auto-assign client to ${tpl.title}`,
            description: `Assigns client relation attribute to new ${tpl.title}.`,
            enabled: true,
            isBuiltin: false,
            trigger: { type: "onNoteCreated", targetTemplateId: tpl.id },
            conditions: [],
            actions: [{ type: "setRelation", params: { relationName: "client", targetNoteId: "orgRoot" } }]
          });
        } else if (presetVal === "prepend_checklist") {
          ifThenRuleEngine.registerRule({
            id: `preset_checklist_${tpl.id}_${Date.now()}`,
            name: `Prepend checklist to ${tpl.title}`,
            description: `Prepends editorial checklist to new ${tpl.title}.`,
            enabled: true,
            isBuiltin: false,
            trigger: { type: "onNoteCreated", targetTemplateId: tpl.id },
            conditions: [],
            actions: [{ type: "prependContent", params: { content: "<h2>EDITORIAL CHECKLIST</h2><ul><li>[ ] Review angle</li><li>[ ] Fact check quotes</li></ul>" } }]
          });
        }
        onSave();
        refresh();
        return true;
      });
    }
    function renderTemplateRuleSection(parent, tpl, tplRules) {
      const total = tpl.relationships.length + tplRules.length;
      const { card } = section(parent, {
        title: `Template rules (${total})`,
        description: "Parent links and rules that apply only to this template.",
        actions: [
          iconAction({ icon: "bx-magic-wand", title: "Add rule preset", onClick: () => openPresetRuleModal(tpl) }),
          iconAction({ icon: "bx-link", title: "Add parent link", onClick: () => openRelationshipModal(tpl) }),
          iconAction({ icon: "bx-plus", title: "Add rule", onClick: () => openRuleEditorModal({ targetTemplateId: tpl.id }) })
        ]
      });
      tpl.relationships.forEach((rel, idx) => {
        card.appendChild(listItem({
          icon: "bx-link",
          title: `~${rel.relationName} \u2192 ${rel.targetTemplateName}`,
          description: [
            rel.autoCloneToParent ? "files a reference link under the parent" : null,
            rel.inheritTopics ? "inherits parent topics" : null
          ].filter(Boolean).join(", ") || "link only",
          actions: [
            iconAction({ icon: "bx-edit-alt", title: "Edit parent link", onClick: () => openRelationshipModal(tpl, idx) }),
            iconAction({
              icon: "bx-trash",
              title: "Delete parent link",
              onClick: () => {
                tpl.relationships.splice(idx, 1);
                templateEngine.updateTemplate(tpl.id, tpl);
                onSave();
                refresh();
              }
            })
          ]
        }));
      });
      for (const rule of tplRules) {
        card.appendChild(ruleItem(rule, () => {
          ifThenRuleEngine.deleteRule(rule.id);
          onSave();
          refresh();
        }));
      }
      if (!total) {
        card.appendChild(emptyState("No template-specific rules."));
      }
    }
    function formatActionSummary(rule) {
      if (rule.description && rule.description.trim()) return rule.description;
      const act = rule.actions[0];
      if (!act) return "No action defined";
      switch (act.type) {
        case "setLabel":
          return `Set #${act.params.labelName ?? "label"} = "${act.params.labelValue ?? ""}"`;
        case "removeLabel":
          return `Remove #${act.params.labelName ?? "label"}`;
        case "setRelation":
          return `Set ~${act.params.relationName ?? "relation"} \u2192 ${act.params.targetNoteId ?? "target"}`;
        case "cloneToContainer":
          return "File reference link under parent container";
        case "archiveNote":
          return "Archive note (#archived)";
        case "prependContent":
          return "Prepend template checklist or header content";
        case "syncDerivedTopics":
          return "Recalculate inherited parent topics";
        default:
          return act.type;
      }
    }
    function ruleItem(rule, onDelete) {
      const enableToggle = toggle(`rule-enabled-${rule.id}`, rule.enabled, (enabled) => {
        ifThenRuleEngine.toggleRule(rule.id, enabled);
        onSave();
      });
      enableToggle.title = rule.enabled ? "Disable this rule" : "Enable this rule";
      const actions = [
        enableToggle,
        iconAction({ icon: "bx-edit-alt", title: "Edit rule", onClick: () => openRuleEditorModal({ rule }) })
      ];
      if (frontendApi) {
        actions.push(iconAction({
          icon: "bx-play",
          title: "Run manual rules for the current note",
          onClick: async () => {
            try {
              const count = await runManualIfThenRules(ruleEngineForManual(), frontendApi, frontendApi.currentNote?.noteId, templateEngine);
              frontendApi.showMessage?.(count ? `Applied ${count} manual rule${count === 1 ? "" : "s"}.` : "No manual rules matched the current note.");
            } catch (error) {
              frontendApi.showError?.(`Manual rule execution failed: ${error?.message || error}`);
            }
          }
        }));
      }
      if (onDelete) {
        actions.push(iconAction({ icon: "bx-trash", title: "Delete rule", onClick: onDelete }));
      }
      const triggerName = rule.trigger?.type || "onNoteCreated";
      const condSummary = rule.conditions?.length ? rule.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(" & ") : "Always";
      const actSummary = formatActionSummary(rule);
      const flowDesc = `
            <div class="d-flex align-items-center gap-1.5 flex-wrap mt-1 tiny text-muted">
                <span class="badge bg-secondary font-weight-normal"><i class="bx bx-zap text-warning"></i> ${escapeHtml(triggerName)}</span>
                <span>&rarr;</span>
                <span class="badge bg-dark font-weight-normal"><i class="bx bx-filter-alt text-info"></i> IF: ${escapeHtml(condSummary)}</span>
                <span>&rarr;</span>
                <span class="badge bg-primary font-weight-normal"><i class="bx bx-play-circle text-white"></i> THEN: ${escapeHtml(actSummary)}</span>
            </div>
        `;
      const el = listItem({
        icon: "bx-bolt-circle",
        title: rule.name,
        description: "",
        disabled: !rule.enabled,
        actions
      });
      const descContainer = el.querySelector(".ns-list-item-desc");
      if (descContainer) descContainer.innerHTML = flowDesc;
      return el;
    }
    function ruleEngineForManual() {
      return ifThenRuleEngine;
    }
    function renderPreview(parent, tpl) {
      const note = document.createElement("div");
      note.className = "ns-note";
      const titleRow = document.createElement("div");
      titleRow.className = "ns-note-title-row";
      titleRow.innerHTML = `
            <span class="ns-note-icon bx bx-${escapeHtml(tpl.icon)}" aria-hidden="true"></span>
            <input type="text" class="ns-note-title" aria-label="Note title"
                   value="${escapeHtml(templateEngine.formatTitle(tpl.id, "Sample Note Title"))}">
        `;
      note.appendChild(titleRow);
      if (tpl.attributes.length) {
        const attrs = document.createElement("div");
        attrs.className = "promoted-attributes-container";
        attrs.innerHTML = tpl.attributes.map((attr) => `
                <div class="promoted-attribute-cell promoted-attribute-${attr.type === "relation" ? "relation" : `label-${escapeHtml(attr.dataType)}`}">
                    <label>${escapeHtml(attr.label ?? attr.name)}</label>
                    <div class="input-group">${attributeInput(attr)}</div>
                </div>
            `).join("");
        note.appendChild(attrs);
      }
      const body = document.createElement("div");
      body.className = "ns-note-body ck-content";
      body.innerHTML = tpl.defaultContent || "";
      note.appendChild(body);
      parent.appendChild(note);
    }
    function attributeInput(attr) {
      const value = escapeHtml(attr.defaultValue ?? "");
      if (attr.dataType === "select" && attr.options) {
        return `<select class="form-control promoted-attribute-input">
                ${attr.options.map((o) => `<option${o === attr.defaultValue ? " selected" : ""}>${escapeHtml(o)}</option>`).join("")}
            </select>`;
      }
      if (attr.dataType === "boolean") {
        return `<input type="checkbox" class="form-control promoted-attribute-input"${attr.defaultValue ? " checked" : ""}>`;
      }
      const type = attr.dataType === "date" ? "date" : attr.dataType === "number" ? "number" : "text";
      return `<input type="${type}" class="form-control promoted-attribute-input" value="${value}" placeholder="unset">`;
    }
    function openRuleEditorModal(opts) {
      const isEdit = !!opts.rule;
      const rule = opts.rule || {
        id: `rule_${Date.now()}`,
        name: "",
        description: "",
        enabled: true,
        isBuiltin: false,
        trigger: {
          type: "onNoteCreated",
          targetCategory: opts.targetCategory,
          targetTemplateId: opts.targetTemplateId
        },
        conditions: [],
        actions: [{ type: "setLabel", params: { labelName: "processed", labelValue: "true" } }]
      };
      const scope = rule.trigger.targetCategory ? `Category: ${rule.trigger.targetCategory}` : rule.trigger.targetTemplateId ? `Template: ${rule.trigger.targetTemplateId}` : "Global";
      const currentAct = rule.actions[0] || { type: "setLabel", params: {} };
      openModal({
        title: isEdit ? "Edit automation rule" : "New automation rule",
        icon: "bx-bolt-circle",
        confirmText: "Save rule",
        body: `
                <div class="ns-field">
                    <label for="rule-name">Name</label>
                    <input type="text" id="rule-name" class="form-control form-control-sm" value="${escapeHtml(rule.name)}" placeholder="High priority task \u2192 due soon tag">
                </div>
                <div class="ns-field">
                    <label for="rule-desc">Description</label>
                    <input type="text" id="rule-desc" class="form-control form-control-sm" value="${escapeHtml(rule.description)}" placeholder="What this rule does (optional)">
                </div>
                <div class="ns-field-grid">
                    <div class="ns-field">
                        <label for="rule-trigger">Trigger</label>
                        <select id="rule-trigger" class="form-select form-select-sm">
                            <option value="onNoteCreated"${rule.trigger.type === "onNoteCreated" ? " selected" : ""}>When a note is created</option>
                            <option value="onAttributeChanged"${rule.trigger.type === "onAttributeChanged" ? " selected" : ""}>When an attribute changes</option>
                            <option value="onManualAction"${rule.trigger.type === "onManualAction" ? " selected" : ""}>When manually run</option>
                            <option value="onScheduledCheck"${rule.trigger.type === "onScheduledCheck" ? " selected" : ""}>During scheduled checks</option>
                        </select>
                    </div>
                    <div class="ns-field">
                        <label for="rule-scope">Scope</label>
                        <input type="text" id="rule-scope" class="form-control form-control-sm" value="${escapeHtml(scope)}" disabled>
                    </div>
                </div>
                <div class="ns-field">
                    <label for="rule-attribute-name">Changed attribute (optional)</label>
                    <input type="text" id="rule-attribute-name" class="form-control form-control-sm" value="${escapeHtml(rule.trigger.attributeName || "")}" placeholder="Only used for attribute-change rules">
                </div>
                <div class="ns-field">
                    <label for="rule-action">Action</label>
                    <select id="rule-action" class="form-select form-select-sm">
                        <option value="setLabel"${currentAct.type === "setLabel" ? " selected" : ""}>Assign a label value (#doneDate, #color)</option>
                        <option value="removeLabel"${currentAct.type === "removeLabel" ? " selected" : ""}>Remove a label</option>
                        <option value="setRelation"${currentAct.type === "setRelation" ? " selected" : ""}>Set relation link (~parent, ~client)</option>
                        <option value="cloneToContainer"${currentAct.type === "cloneToContainer" ? " selected" : ""}>File a reference link under parent container</option>
                        <option value="archiveNote"${currentAct.type === "archiveNote" ? " selected" : ""}>Archive note (#archived)</option>
                        <option value="prependContent"${currentAct.type === "prependContent" ? " selected" : ""}>Prepend checklist or header content</option>
                        <option value="syncDerivedTopics"${currentAct.type === "syncDerivedTopics" ? " selected" : ""}>Recalculate inherited parent topics</option>
                    </select>
                </div>
                <div class="action-params-box border-top pt-2 mt-2">
                    <div class="ns-field param-label-name">
                        <label for="param-lname">Label / Relation Name</label>
                        <input type="text" id="param-lname" class="form-control form-control-sm" value="${escapeHtml(currentAct.params.labelName ?? currentAct.params.relationName ?? "processed")}">
                    </div>
                    <div class="ns-field param-label-val">
                        <label for="param-lval">Value / Target ID / Content</label>
                        <input type="text" id="param-lval" class="form-control form-control-sm" value="${escapeHtml(currentAct.params.labelValue ?? currentAct.params.targetNoteId ?? currentAct.params.content ?? "true")}" placeholder="Supports {TODAY}, {NOTE_TITLE}">
                    </div>
                </div>
            `
      }, (content) => {
        const name = content.querySelector("#rule-name").value.trim();
        if (!name) return false;
        rule.name = name;
        rule.description = content.querySelector("#rule-desc").value;
        rule.trigger.type = content.querySelector("#rule-trigger").value;
        const changedAttribute = content.querySelector("#rule-attribute-name")?.value.trim();
        if (changedAttribute) rule.trigger.attributeName = changedAttribute;
        else delete rule.trigger.attributeName;
        const actionType = content.querySelector("#rule-action").value;
        const lName = content.querySelector("#param-lname")?.value.trim();
        const lVal = content.querySelector("#param-lval")?.value;
        const params = {};
        if (actionType === "setLabel") {
          params.labelName = lName || "processed";
          params.labelValue = lVal !== void 0 ? lVal : "true";
        } else if (actionType === "removeLabel") {
          params.labelName = lName || "";
        } else if (actionType === "setRelation") {
          params.relationName = lName || "project";
          params.targetNoteId = lVal || "";
        } else if (actionType === "archiveNote") {
          params.containerMarker = lName || "archiveProjectRoot";
        } else if (actionType === "prependContent") {
          params.content = lVal || "";
        } else if (actionType === "cloneToContainer") {
          params.relationName = "project";
        }
        rule.actions = [{ type: actionType, params }];
        ifThenRuleEngine.registerRule(rule);
        onSave();
        refresh();
      });
    }
    function openExportTemplateModal(tpl) {
      const yamlContent = exportTemplateToYaml(tpl);
      openModal({
        title: `Export ${tpl.title} (YAML)`,
        icon: "bx-export",
        confirmText: "Copy to Clipboard",
        cancelText: "Close",
        body: `
                <div class="ns-field">
                    <label>Single Template Specification</label>
                    <textarea class="form-control form-control-sm font-monospace yaml-export-text" rows="14" readonly>${escapeHtml(yamlContent)}</textarea>
                    <small class="ns-row-desc">Share or paste into another Trilium Notes System package.</small>
                </div>
                <div class="copy-status alert alert-success d-none py-1 px-2 tiny mt-2">Copied to clipboard!</div>
            `
      }, (content) => {
        const textarea = content.querySelector(".yaml-export-text");
        if (textarea) {
          textarea.select();
          if (navigator.clipboard) {
            navigator.clipboard.writeText(textarea.value);
          }
          const status = content.querySelector(".copy-status");
          if (status) status.classList.remove("d-none");
        }
        return false;
      });
    }
    function openImportTemplateModal() {
      openModal({
        title: "Import Template from YAML",
        icon: "bx-import",
        confirmText: "Import Template",
        body: `
                <div class="ns-field">
                    <label for="import-yaml-input">Paste Template YAML</label>
                    <textarea id="import-yaml-input" class="form-control form-control-sm font-monospace" rows="12" placeholder="Paste single template YAML specification here..."></textarea>
                    <small class="ns-row-desc">Expects a YAML document with template properties, attributes, and parentLinks.</small>
                </div>
                <div class="import-error alert alert-danger d-none py-1 px-2 tiny m-0"></div>
            `
      }, (content) => {
        const yamlStr = content.querySelector("#import-yaml-input")?.value || "";
        const errorBox = content.querySelector(".import-error");
        try {
          const imported = importTemplateFromYaml(yamlStr);
          templateEngine.registerTemplate(imported);
          selectedTemplateId = imported.id;
          activeEditorTab = "editor";
          onSave();
          refresh();
          return true;
        } catch (err) {
          if (errorBox) {
            errorBox.textContent = `Import failed: ${err.message}`;
            errorBox.classList.remove("d-none");
          }
          return false;
        }
      });
    }
    function openRelationshipModal(tpl, editIdx) {
      const isEdit = editIdx !== void 0;
      const rel = isEdit ? tpl.relationships[editIdx] : {
        id: `rel_${tpl.id}_${Date.now()}`,
        name: "project link",
        relationName: "project",
        targetTemplateId: "projectHub",
        targetTemplateName: "Project Hub",
        isMulti: false,
        autoCloneToParent: true,
        inheritTopics: true,
        direction: "parent"
      };
      const allTemplates = templateEngine.getAllTemplates();
      const modal = openModal({
        title: isEdit ? "Edit parent link" : "Add parent link",
        icon: "bx-link",
        confirmText: "Save link",
        body: `
                <div class="ns-field">
                    <label for="rel-name">Relation name</label>
                    <input type="text" id="rel-name" class="form-control form-control-sm" value="${escapeHtml(rel.relationName)}">
                    <small class="ns-row-desc">Used as ~name on the note, e.g. project, client, attendee.</small>
                </div>
                <div class="ns-field">
                    <label for="rel-target">Parent template</label>
                    <div class="rel-target-slot"></div>
                </div>
                <div class="ns-toggles"></div>
            `
      }, (content) => {
        const relName = content.querySelector("#rel-name").value.trim();
        if (!relName) return false;
        const targetId = targetPicker.getValue();
        const targetTpl = templateEngine.getTemplate(targetId);
        const targetName = targetTpl ? targetTpl.title : targetId;
        rel.relationName = relName;
        rel.targetTemplateId = targetId;
        rel.targetTemplateName = targetName;
        rel.autoCloneToParent = cloneRow.querySelector("input").checked;
        rel.inheritTopics = topicsRow.querySelector("input").checked;
        if (!isEdit) tpl.relationships.push(rel);
        templateEngine.updateTemplate(tpl.id, tpl);
        ifThenRuleEngine.registerRule({
          id: `rule_rel_${tpl.id}_${relName}`,
          name: `Parent link ~${relName} \u2192 ${targetName}`,
          description: `When the note has ~${relName}, link it to ${targetName}, file a reference link under the parent container, and inherit parent topics.`,
          enabled: true,
          isBuiltin: false,
          trigger: { type: "onNoteCreated", targetTemplateId: tpl.id },
          conditions: [{ field: relName, operator: "isSet", value: true }],
          actions: [
            { type: "cloneToContainer", params: { relationName: relName } },
            { type: "syncDerivedTopics", params: {} }
          ]
        });
        onSave();
        refresh();
      });
      const targetPicker = searchableSelect({
        id: "rel-target",
        value: rel.targetTemplateId,
        placeholder: "Search templates\u2026",
        options: allTemplates.map((t) => ({ value: t.id, label: t.title, description: `#${t.marker}` }))
      });
      modal.querySelector(".rel-target-slot").appendChild(targetPicker.el);
      const toggles = modal.querySelector(".ns-toggles");
      const cloneRow = switchRow({
        id: "rel-clone",
        label: "File a reference link under the parent",
        checked: rel.autoCloneToParent
      });
      const topicsRow = switchRow({
        id: "rel-topics",
        label: "Inherit parent topics and metadata",
        checked: rel.inheritTopics
      });
      toggles.appendChild(cloneRow);
      toggles.appendChild(topicsRow);
    }
    function openNewTemplateModal() {
      const categories = templateEngine.getAllCategories();
      const modal = openModal({
        title: "New template",
        icon: "bx-plus",
        confirmText: "Create template",
        body: `
                <div class="ns-field">
                    <label for="new-tpl-title">Title</label>
                    <input type="text" id="new-tpl-title" class="form-control form-control-sm" placeholder="Research Brief">
                </div>
                <div class="ns-field">
                    <label for="new-tpl-cat">Category</label>
                    <div class="new-tpl-cat-slot"></div>
                </div>
            `
      }, (content) => {
        const title = content.querySelector("#new-tpl-title").value.trim();
        if (!title) return false;
        const category = categoryPicker.getValue();
        const id = title.toLowerCase().replace(/\s+/g, "-");
        templateEngine.registerTemplate({
          id,
          marker: `ext${title.replace(/\s+/g, "")}`,
          title,
          category: category || "work",
          rootContainerMarker: "projectRoot",
          titlePattern: "{title}",
          icon: "file-blank",
          attributes: [],
          relationships: [],
          defaultContent: `<h2>${escapeHtml(title)}</h2><p>Notes content\u2026</p>`
        });
        selectedTemplateId = id;
        activeEditorTab = "editor";
        onSave();
        refresh();
      });
      const categoryPicker = searchableSelect({
        id: "new-tpl-cat",
        value: categories[0]?.id ?? "work",
        placeholder: "Search categories\u2026",
        options: categories.map((c) => ({ value: c.id, label: c.title, description: c.description }))
      });
      modal.querySelector(".new-tpl-cat-slot").appendChild(categoryPicker.el);
    }
    function openNewCategoryModal() {
      openModal({
        title: "New category",
        icon: "bx-plus",
        confirmText: "Create category",
        body: `
                <div class="ns-field">
                    <label for="cat-title">Title</label>
                    <input type="text" id="cat-title" class="form-control form-control-sm" placeholder="Legal Documents">
                </div>
                <div class="ns-field">
                    <label for="cat-desc">Description</label>
                    <input type="text" id="cat-desc" class="form-control form-control-sm" placeholder="Contracts and legal agreements">
                </div>
            `
      }, (content) => {
        const title = content.querySelector("#cat-title").value.trim();
        if (!title) return false;
        const id = title.toLowerCase().replace(/\s+/g, "-");
        templateEngine.registerCategory({
          id,
          title,
          description: content.querySelector("#cat-desc").value || "Custom category",
          icon: "layer",
          defaultRootMarker: "unassignedRoot",
          autoJournalClone: true,
          inheritParentTopics: true,
          projectScopedDefault: false,
          isBuiltin: false
        });
        selectedCategoryId = id;
        onSave();
        refresh();
      });
    }
    function openAddAttrModal(tpl) {
      openModal({
        title: "Add promoted attribute",
        icon: "bx-list-check",
        confirmText: "Add attribute",
        body: `
                <div class="ns-field">
                    <label for="attr-name">Name</label>
                    <input type="text" id="attr-name" class="form-control form-control-sm" placeholder="priority">
                    <small class="ns-row-desc">Without the leading # or ~.</small>
                </div>
                <div class="ns-field-grid">
                    <div class="ns-field">
                        <label for="attr-kind">Kind</label>
                        <select id="attr-kind" class="form-select form-select-sm">
                            <option value="label">Label (#)</option>
                            <option value="relation">Relation (~)</option>
                        </select>
                    </div>
                    <div class="ns-field">
                        <label for="attr-type">Type</label>
                        <select id="attr-type" class="form-select form-select-sm">
                            <option value="string">Text</option>
                            <option value="select">Select</option>
                            <option value="date">Date</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                        </select>
                    </div>
                </div>
            `
      }, (content) => {
        const name = content.querySelector("#attr-name").value.trim();
        if (!name) return false;
        tpl.attributes.push({
          name,
          type: content.querySelector("#attr-kind").value === "relation" ? "relation" : "label",
          dataType: content.querySelector("#attr-type").value,
          isPromoted: true
        });
        templateEngine.updateTemplate(tpl.id, tpl);
        onSave();
        refresh();
      });
    }
    refresh();
  }

  // src/components/SettingsStudio.tsx
  function renderSettingsStudio(container, todayEngine, templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine, onSaveSettings, initialYamlSpec, frontendApi) {
    let importError = "";
    let importSuccess = "";
    let settingsError = "";
    let currentYamlSpec = initialYamlSpec;
    function render() {
      container.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.className = "settings-studio-container";
      wrapper.appendChild(pageHeader({
        icon: "bx-slider-alt",
        title: "Package Settings",
        subtitle: "Automation preferences and the YAML specification for this package."
      }));
      renderPreferences(wrapper);
      renderSystemHealth(wrapper);
      renderIkmalToolsCatalog(wrapper);
      renderYamlSpecification(wrapper);
      container.appendChild(wrapper);
    }
    function renderPreferences(parent) {
      const { card: bundleCard } = section(parent, {
        title: "\u{1F4E6} Ikmal App Store Bundle",
        description: "Explore companion plugins or complete your bundle in the Trilium Community Catalog."
      });
      const bundleList = document.createElement("div");
      bundleList.className = "d-flex flex-column gap-2 p-1";
      bundleList.innerHTML = `
            <div class="ns-row-desc mb-2">You are using <strong>Ikmal Tools Core Package</strong>. You can install companion tools individually or get the full suite:</div>
            <div class="d-flex flex-wrap gap-2">
                <span class="badge bg-primary-subtle text-primary border p-2"><i class="bx bx-check-circle me-1"></i> Ikmal Tools Full Suite (Installed)</span>
                <span class="badge bg-secondary-subtle text-body border p-2"><i class="bx bx-text me-1"></i> Ikmal Editor (companion)</span>
                <span class="badge bg-secondary-subtle text-body border p-2"><i class="bx bx-keyboard me-1"></i> Ikmal Shortcuts & Command Palette</span>
                <span class="badge bg-secondary-subtle text-body border p-2"><i class="bx bx-layout me-1"></i> Ikmal Standalone Kanban Board</span>
            </div>
            <div class="mt-2 text-end">
                <a href="https://github.com/iansherr/ikmal_editor_trilium" target="_blank" class="btn btn-micro btn-outline-primary">
                    <i class="bx bx-store-alt me-1"></i> Complete Your Bundle on GitHub
                </a>
            </div>
        `;
      bundleCard.appendChild(bundleList);
      const { card } = section(parent, {
        title: "Automation",
        description: "Saved to this package\u2019s manifest note, so they persist across reloads and are visible from Trilium\u2019s Plugins settings too."
      });
      if (settingsError) {
        const status = document.createElement("div");
        status.className = "alert alert-danger";
        status.textContent = settingsError;
        card.appendChild(status);
      }
      card.appendChild(switchRow({
        id: "ifThenRulesToggle",
        label: "Auto-execute if/then automation rules",
        description: "Evaluate if/then automation rules when creating tasks, story drafts, or project hubs.",
        checked: settingsEngine.get("autoRunIfThenRulesOnCreation"),
        onChange: (checked) => applySetting("autoRunIfThenRulesOnCreation", checked)
      }));
      card.appendChild(switchRow({
        id: "derivedTopicsToggle",
        label: "Enable derived topic propagation",
        description: "Inherit topic tags from parent project hubs, organizations, or person relations.",
        checked: settingsEngine.get("enableDerivedTopics"),
        onChange: (checked) => applySetting("enableDerivedTopics", checked)
      }));
      card.appendChild(switchRow({
        id: "autoJournalCloneToggle",
        label: "File new notes under today's journal note",
        description: "Master switch for the per-category setting in Template Studio. Off disables journal filing everywhere; on, project work is filed under both its project and today's journal.",
        checked: settingsEngine.get("autoJournalClone"),
        onChange: (checked) => applySetting("autoJournalClone", checked)
      }));
      const swatchRow = document.createElement("div");
      swatchRow.className = "ns-row d-flex justify-content-between align-items-center py-2";
      swatchRow.innerHTML = `
            <div class="ns-row-label">
                <label>Theme Accent Color</label>
                <small class="ns-row-desc">Personalize primary buttons, badge highlights, and focus outlines.</small>
            </div>
            <div class="ns-row-input d-flex align-items-center gap-1.5">
                ${[
        { name: "Indigo", color: "#6366f1" },
        { name: "Royal Blue", color: "#3b82f6" },
        { name: "Emerald", color: "#10b981" },
        { name: "Amber", color: "#f59e0b" },
        { name: "Crimson", color: "#ef4444" }
      ].map((s) => `
                    <button type="button" class="btn btn-micro accent-swatch-btn" data-color="${s.color}" title="${s.name}" style="background-color: ${s.color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--main-background-color); cursor: pointer;"></button>
                `).join("")}
            </div>
        `;
      swatchRow.querySelectorAll(".accent-swatch-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const hex = e.currentTarget.dataset.color;
          if (hex && typeof document !== "undefined") {
            document.documentElement.style.setProperty("--accent-color", hex);
            document.documentElement.style.setProperty("--bs-primary", hex);
          }
        });
      });
      card.appendChild(swatchRow);
      const cardStyleSelect = document.createElement("select");
      cardStyleSelect.className = "form-select form-select-sm";
      cardStyleSelect.id = "card-style-mode";
      cardStyleSelect.innerHTML = `
            <option value="glass">Frosted Glass (Dynamic Translucency)</option>
            <option value="solid">High-Contrast Solid (Classic Borders)</option>
        `;
      cardStyleSelect.addEventListener("change", () => {
        if (typeof document !== "undefined") {
          document.documentElement.dataset.ikmalCardStyle = cardStyleSelect.value;
        }
      });
      card.appendChild(row(cardStyleSelect, {
        label: "Card Surface Aesthetics",
        description: "Choose between frosted glassmorphism or high-contrast solid borders across all system cards.",
        htmlFor: "card-style-mode"
      }));
      const tplInput = document.createElement("input");
      tplInput.type = "text";
      tplInput.className = "form-control form-control-sm";
      tplInput.id = "default-capture-tpl";
      tplInput.value = settingsEngine.get("defaultQuickCaptureTemplate") || "task";
      tplInput.addEventListener("change", () => applySetting("defaultQuickCaptureTemplate", tplInput.value.trim() || "task"));
      card.appendChild(row(tplInput, {
        label: "Default Quick Capture template ID",
        description: "Template ID opened by default when clicking the global header Quick Capture button (e.g. task, meeting, story).",
        htmlFor: "default-capture-tpl"
      }));
      const staleInput = document.createElement("input");
      staleInput.type = "number";
      staleInput.className = "form-control form-control-sm";
      staleInput.id = "stale-threshold-input";
      staleInput.value = String(settingsEngine.get("staleThresholdDays") ?? 14);
      staleInput.addEventListener("change", () => applySetting("staleThresholdDays", Math.max(1, parseInt(staleInput.value, 10) || 14)));
      card.appendChild(row(staleInput, {
        label: "Stale Notes inactivity threshold (days)",
        description: "Active notes unmodified for longer than this threshold appear in the Stale Notes review list.",
        htmlFor: "stale-threshold-input"
      }));
      const goalInput = document.createElement("input");
      goalInput.type = "number";
      goalInput.className = "form-control form-control-sm";
      goalInput.id = "writing-goal-input";
      goalInput.value = String(settingsEngine.get("writingGoalWords") ?? 500);
      goalInput.addEventListener("change", () => applySetting("writingGoalWords", Math.max(50, parseInt(goalInput.value, 10) || 500)));
      card.appendChild(row(goalInput, {
        label: "Daily writing target (words)",
        description: "Word count target for the Writing Goal progress bar and activity heatmap on the Today Homepage.",
        htmlFor: "writing-goal-input"
      }));
    }
    function renderIkmalToolsCatalog(parent) {
      const { card } = section(parent, {
        title: "Ikmal Micro-Tools Suite",
        description: "Standalone render note artifacts declared in this package. Link or clone any of these notes into daily notes or project hubs to embed them independently."
      });
      const microTools = [
        { id: "notes-system-kanban", title: "Ikmal Task Kanban Board", icon: "bx-layout", desc: "Live task board sorted by todo, in progress, and completed columns." },
        { id: "notes-system-insights", title: "Ikmal Writing & Productivity Insights", icon: "bx-target-lock", desc: "Daily word count goal progress, 30-day activity heatmap, and moon phase." },
        { id: "notes-system-quick-capture", title: "Ikmal Quick Capture Toolbar", icon: "bx-plus-circle", desc: "1-click note creation toolbar for tasks, meetings, and story packages." },
        { id: "notes-system-weather", title: "Ikmal Weather & Climate Card", icon: "bx-sun", desc: "Open-Meteo weather forecast, temperature, daylight hours, and moon phase." },
        { id: "notes-system-on-this-day", title: "Ikmal Time Machine (On This Day)", icon: "bx-history", desc: "Notes created on the exact calendar day in previous years." },
        { id: "notes-system-stale-notes", title: "Ikmal Stale Note Reviewer", icon: "bx-time-five", desc: "Active notes unmodified longer than the configured threshold." },
        { id: "notes-system-canvas", title: "Ikmal Interactive Canvas (Beta)", icon: "bx-network-chart", desc: "Interactive visual whiteboard and node graph for project notes and mind-mapping." }
      ];
      for (const tool of microTools) {
        card.appendChild(listItem({
          icon: tool.icon,
          title: tool.title,
          description: tool.desc
        }));
      }
    }
    function applySetting(key, value) {
      const previous = settingsEngine.get(key);
      settingsEngine.set(key, value);
      settingsError = "";
      saveAutomationSetting(key, value, frontendApi).catch((err) => {
        settingsEngine.set(key, previous);
        settingsError = `Could not save this setting: ${err.message}`;
        render();
      });
    }
    function renderYamlSpecification(parent) {
      const yamlContent = dumpYamlSpec(
        todayEngine.getLayout(),
        templateEngine,
        relationshipEngine,
        ifThenRuleEngine
      );
      const editorContent = currentYamlSpec ?? yamlContent;
      const { card } = section(parent, {
        title: "Specification",
        description: "The complete package as YAML: Today Homepage layout, every template, relationship rules, and automation trees. Edit and save to apply."
      });
      const status = document.createElement("div");
      if (importError) {
        status.className = "alert alert-danger";
        status.textContent = importError;
        card.appendChild(status);
      } else if (importSuccess) {
        status.className = "alert alert-success";
        status.textContent = importSuccess;
        card.appendChild(status);
      }
      const field = document.createElement("div");
      field.className = "ns-field";
      field.innerHTML = `
            <textarea class="form-control ns-code" rows="18" spellcheck="false">${escapeHtml(editorContent)}</textarea>
        `;
      card.appendChild(field);
      const actions = document.createElement("div");
      actions.className = "ns-actions ns-actions-end d-flex gap-2 flex-wrap";
      actions.style.marginTop = "14px";
      actions.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-info export-tpl-btn"><span class="bx bx-export"></span> Export Single Template</button>
            <button type="button" class="btn btn-sm btn-outline-success import-tpl-btn"><span class="bx bx-import"></span> Import Single Template</button>
            <button type="button" class="btn btn-sm btn-secondary copy-yaml-btn"><span class="bx bx-copy"></span> Copy Spec</button>
            <button type="button" class="btn btn-sm btn-primary save-yaml-btn"><span class="bx bx-save"></span> Save specification</button>
        `;
      card.appendChild(actions);
      actions.querySelector(".export-tpl-btn").addEventListener("click", () => {
        const allTpls = templateEngine.getAllTemplates();
        openModal({
          title: "Export Single Template",
          icon: "bx-export",
          body: `
                    <div class="mb-3">
                        <label class="form-label small font-weight-bold">Select Template to Export</label>
                        <select class="form-select form-select-sm export-tpl-select">
                            ${allTpls.map((t) => `<option value="${t.id}">${escapeHtml(t.title)} (#${t.marker})</option>`).join("")}
                        </select>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small font-weight-bold">Template YAML Output</label>
                        <textarea class="form-control ns-code export-tpl-out" rows="8" readonly></textarea>
                    </div>
                `,
          confirmText: "Copy Template YAML"
        }, (modalEl) => {
          const getYamlFor = (tplId) => {
            const tpl = templateEngine.getTemplate(tplId);
            if (!tpl) return "";
            return exportTemplateToYaml(tpl);
          };
          const sel = modalEl.querySelector(".export-tpl-select");
          const out = modalEl.querySelector(".export-tpl-out");
          if (sel && out) {
            const yamlStr = getYamlFor(sel.value);
            out.value = yamlStr;
            navigator.clipboard.writeText(yamlStr);
            importSuccess = `Template "${sel.value}" exported to clipboard!`;
            render();
          }
          return true;
        });
        const selEl = document.querySelector(".export-tpl-select");
        const outEl = document.querySelector(".export-tpl-out");
        if (selEl && outEl) {
          const getYamlFor = (tplId) => {
            const tpl = templateEngine.getTemplate(tplId);
            if (!tpl) return "";
            return exportTemplateToYaml(tpl);
          };
          outEl.value = getYamlFor(selEl.value);
          selEl.addEventListener("change", () => {
            outEl.value = getYamlFor(selEl.value);
          });
        }
      });
      actions.querySelector(".import-tpl-btn").addEventListener("click", () => {
        openModal({
          title: "Import Single Template",
          icon: "bx-import",
          body: `
                    <div class="mb-2">
                        <label class="form-label small font-weight-bold">Paste Single Template YAML</label>
                        <textarea class="form-control ns-code import-tpl-input" rows="8" placeholder="Paste template YAML spec here..."></textarea>
                    </div>
                `,
          confirmText: "Import Template"
        }, (modalEl) => {
          const input = modalEl.querySelector(".import-tpl-input");
          const yamlStr = input ? input.value.trim() : "";
          if (!yamlStr) return false;
          try {
            const importedTpl = importTemplateFromYaml(yamlStr);
            templateEngine.registerTemplate(importedTpl);
            importSuccess = `Successfully imported template "${importedTpl.title}" (#${importedTpl.marker})!`;
            render();
            return true;
          } catch (err) {
            importError = `Import error: ${err.message}`;
            render();
            return false;
          }
        });
      });
      const textarea = field.querySelector("textarea");
      actions.querySelector(".copy-yaml-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(textarea.value);
        importSuccess = "Specification copied to clipboard.";
        importError = "";
        render();
      });
      actions.querySelector(".save-yaml-btn").addEventListener("click", () => {
        const hasCustomSpec = Boolean(textarea.value.trim());
        const yamlToApply = hasCustomSpec ? textarea.value : DEFAULT_STARTER_YAML_SPEC;
        const res = parseAndApplyYamlSpec(yamlToApply, todayEngine, templateEngine, ifThenRuleEngine);
        if (!res.success) {
          importError = res.message;
          importSuccess = "";
          render();
          return;
        }
        currentYamlSpec = yamlToApply;
        importSuccess = hasCustomSpec ? res.message : "Loaded the starter specification. Built-in templates and automation remain active until you add custom sections.";
        importError = "";
        render();
        if (onSaveSettings) {
          onSaveSettings(yamlToApply).catch((err) => {
            importError = `Applied in this session, but could not save to the manifest note: ${err.message}`;
            importSuccess = "";
            render();
          });
        }
      });
    }
    function renderSystemHealth(parent) {
      const { card } = section(parent, {
        title: "System Health & Workspace Maintenance",
        description: "Verify system container markers, saved search queries, backend event hooks, and journal template wiring. Run 1-click repairs to realign missing structures without touching your notes."
      });
      const statusBox = document.createElement("div");
      statusBox.className = "alert alert-info";
      statusBox.textContent = 'Click "Run Health Verification" to inspect workspace integrity or "Repair Workspace Alignment" to re-apply containers and event wiring.';
      card.appendChild(statusBox);
      const actions = document.createElement("div");
      actions.className = "ns-actions";
      actions.style.marginTop = "12px";
      actions.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-secondary check-health-btn"><span class="bx bx-check-shield"></span> Run Health Verification</button>
            <button type="button" class="btn btn-sm btn-primary repair-workspace-btn"><span class="bx bx-wrench"></span> Repair Workspace Alignment</button>
            <button type="button" class="btn btn-sm btn-outline-primary clean-projects-btn"><span class="bx bx-archive-in"></span> Clean & Auto-Archive Projects</button>
        `;
      card.appendChild(actions);
      actions.querySelector(".clean-projects-btn").addEventListener("click", async () => {
        statusBox.className = "alert alert-info";
        statusBox.textContent = "Sweeping active project hubs and reconciling completed edit rounds...";
        try {
          const api2 = frontendApi || globalThis.api;
          if (!api2 || typeof api2.searchForNotes !== "function") {
            statusBox.className = "alert alert-warning";
            statusBox.textContent = "Project reconciliation requires live Trilium session context.";
            return;
          }
          const activeRootNotes = await api2.searchForNotes("#activeProjectRoot");
          const archiveRootNotes = await api2.searchForNotes("#archiveProjectRoot");
          const projectHubs = await api2.searchForNotes('#extTemplate="projectHub"');
          let moved = 0;
          let statusUpdated = 0;
          const activeRoot = activeRootNotes?.[0];
          const archiveRoot = archiveRootNotes?.[0];
          for (const hub of projectHubs || []) {
            const drafts = (hub.getTargetRelations?.() || []).filter((r) => r.type === "relation" && r.name === "project").map((r) => api2.getNote?.(r.noteId)).filter((n) => n && n.hasLabel?.("extTemplate", "storyDraft")).sort((a, b) => Number(b.getLabelValue?.("round") || 0) - Number(a.getLabelValue?.("round") || 0));
            if (!drafts.length) continue;
            const latest = drafts[0];
            const latestStatus = (latest.getLabelValue?.("status") || "").toLowerCase();
            const isDone = latestStatus === "done" || latestStatus === "approved" || latestStatus === "published" || Boolean(latest.getOwnedLabelValue?.("doneDate"));
            const currentStatus = hub.getLabelValue?.("status");
            if (isDone && currentStatus !== "complete") {
              hub.setLabel?.("status", "complete");
              statusUpdated++;
              if (archiveRoot && !hub.getParentNoteIds?.().includes(archiveRoot.noteId)) {
                api2.ensureNoteIsPresentInParent?.(hub.noteId, archiveRoot.noteId, "");
                moved++;
              }
              if (activeRoot && hub.getParentNoteIds?.().includes(activeRoot.noteId)) {
                api2.ensureNoteIsAbsentFromParent?.(hub.noteId, activeRoot.noteId);
              }
            } else if (!isDone && (currentStatus === "complete" || currentStatus === "archived")) {
              hub.setLabel?.("status", "active");
              statusUpdated++;
              if (activeRoot && !hub.getParentNoteIds?.().includes(activeRoot.noteId)) {
                api2.ensureNoteIsPresentInParent?.(hub.noteId, activeRoot.noteId, "");
                moved++;
              }
              if (archiveRoot && hub.getParentNoteIds?.().includes(archiveRoot.noteId)) {
                api2.ensureNoteIsAbsentFromParent?.(hub.noteId, archiveRoot.noteId);
              }
            }
          }
          statusBox.className = "alert alert-success";
          statusBox.textContent = `\u{1F4E6} Project reconciliation complete! Reconciled ${projectHubs?.length || 0} Project Hub(s): ${statusUpdated} status update(s), ${moved} area move(s).`;
        } catch (err) {
          statusBox.className = "alert alert-danger";
          statusBox.textContent = `Project reconciliation error: ${err?.message || String(err)}`;
        }
      });
      actions.querySelector(".check-health-btn").addEventListener("click", async () => {
        statusBox.className = "alert alert-info";
        statusBox.textContent = "Running system health verification...";
        try {
          const api2 = frontendApi || globalThis.api;
          if (!api2 || typeof api2.searchForNotes !== "function") {
            statusBox.className = "alert alert-warning";
            statusBox.textContent = "System verification requires live Trilium session context.";
            return;
          }
          const containers = ["calendarRoot", "todayRoot", "projectRoot", "activeProjectRoot", "archiveProjectRoot", "unassignedRoot", "taskRoot", "meetingRoot", "peopleRoot", "orgRoot", "topicRoot", "templateRoot", "extConfig", "storyDraftRoot", "emailRoot"];
          const missing = [];
          for (const m of containers) {
            const found = await api2.searchForNotes(`#${m}`);
            if (!found || !found.length) missing.push(`#${m}`);
          }
          const journal = (await api2.searchForNotes("#calendarRoot"))?.[0];
          const hasDateTpl = journal?.getRelations?.("dateTemplate")?.length > 0;
          if (!hasDateTpl) missing.push("Journal ~dateTemplate relation");
          if (missing.length === 0) {
            statusBox.className = "alert alert-success";
            statusBox.textContent = "\u2705 All 15 system containers, templates, and Journal dateTemplate relations are 100% healthy and verified.";
          } else {
            statusBox.className = "alert alert-warning";
            statusBox.textContent = `\u26A0\uFE0F Found ${missing.length} missing system element(s): ${missing.join(", ")}. Click "Repair Workspace Alignment" to restore them.`;
          }
        } catch (err) {
          statusBox.className = "alert alert-danger";
          statusBox.textContent = `Verification error: ${err?.message || String(err)}`;
        }
      });
      actions.querySelector(".repair-workspace-btn").addEventListener("click", async () => {
        statusBox.className = "alert alert-info";
        statusBox.textContent = "Executing workspace repair and schema alignment...";
        try {
          const repair = typeof window !== "undefined" ? window.__ikmal_workspace_repair : null;
          if (typeof repair !== "function") {
            throw new Error("Workspace repair is not loaded. Reload the Trilium frontend and try again.");
          }
          await repair();
          statusBox.className = "alert alert-success";
          statusBox.textContent = "\u{1F6E0}\uFE0F Workspace repair completed. Containers, templates, saved search views, and backend event hooks have been aligned.";
        } catch (err) {
          statusBox.className = "alert alert-danger";
          statusBox.textContent = `Repair error: ${err?.message || String(err)}`;
        }
      });
    }
    render();
  }

  // src/engine/noteMaterializer.ts
  function triliumApi2(explicitApi) {
    const a = explicitApi || globalThis.api;
    return a && typeof a.createNote === "function" ? a : null;
  }
  async function fetchNoteTopics(api2, noteId) {
    try {
      if (typeof api2.getNote !== "function") return [];
      const note = await api2.getNote(noteId);
      if (!note) return [];
      const topics = [];
      if (typeof note.getRelations === "function") {
        const rels = note.getRelations("topic") || [];
        for (const rel of rels) {
          const targetId = rel.targetNoteId || rel.value;
          if (targetId) topics.push(targetId);
        }
      }
      if (Array.isArray(note.attributes)) {
        for (const attr of note.attributes) {
          if (attr.name === "topic") {
            const targetId = attr.targetNoteId || attr.value;
            if (targetId && !topics.includes(targetId)) {
              topics.push(targetId);
            }
          }
        }
      }
      return topics;
    } catch {
      return [];
    }
  }
  function applyDerivedTopics(plan, parentTopicMap, relEngine = new RelationshipEngine(new TemplateEngine())) {
    if (!plan.inheritedTopicSources || plan.inheritedTopicSources.length === 0) return;
    const explicitTopicIds = plan.relationsToCreate.filter((r) => r.name === "topic").map((r) => r.value);
    const derivedRes = relEngine.computeDerivedTopics(explicitTopicIds, parentTopicMap);
    for (const derivedTopicId of derivedRes.derivedTopics) {
      if (!plan.relationsToCreate.some((r) => r.name === "topic" && r.value === derivedTopicId)) {
        plan.relationsToCreate.push({ name: "topic", value: derivedTopicId });
      }
    }
  }
  async function cloneNoteToParentNote(childNoteId, parentNoteId, explicitApi) {
    const frontendApi = explicitApi || globalThis.api;
    if (frontendApi && typeof frontendApi.runOnBackend === "function") {
      try {
        const applied = await frontendApi.runOnBackend((cId, pId) => {
          if (typeof api === "undefined" || typeof api.ensureNoteIsPresentInParent !== "function") {
            return false;
          }
          api.ensureNoteIsPresentInParent(cId, pId, "");
          return true;
        }, [childNoteId, parentNoteId]);
        if (applied) return;
      } catch {
      }
    }
    const glob = globalThis.glob;
    if (!glob) throw new Error("Not running inside Trilium.");
    const headers = {
      "x-csrf-token": glob.csrfToken,
      "trilium-component-id": glob.componentId,
      "content-type": "application/json"
    };
    const path = `${glob.baseApiUrl}notes/${childNoteId}/toggle-in-parent/${parentNoteId}/true`;
    const send = () => globalThis.fetch(path, {
      method: "PUT",
      credentials: "same-origin",
      headers,
      body: JSON.stringify({})
    });
    let response = await send();
    if (response.status === 403) {
      const bootstrapUrl = `./bootstrap${globalThis.location?.search ?? ""}`;
      const bootstrap = await globalThis.fetch(bootstrapUrl, { credentials: "same-origin", cache: "no-store" });
      if (bootstrap.ok) {
        const refreshed = await bootstrap.json();
        glob.csrfToken = refreshed.csrfToken;
        headers["x-csrf-token"] = refreshed.csrfToken;
        response = await send();
      }
    }
    if (!response.ok) {
      throw new Error(`Failed to file the note under ${parentNoteId} (HTTP ${response.status})`);
    }
    const result = await response.json().catch(() => null);
    if (result?.success === false) {
      throw new Error(`Trilium refused to file the note under ${parentNoteId}`);
    }
  }
  async function resolveContainerMarker(api2, marker) {
    if (!marker) return null;
    const note = await api2.searchForNote(`#${marker}`);
    return note?.noteId || null;
  }
  async function setNoteAttribute(noteId, type, name, value, explicitApi) {
    const frontendApi = explicitApi || globalThis.api;
    if (frontendApi && typeof frontendApi.runOnBackend === "function") {
      try {
        const applied = await frontendApi.runOnBackend(
          (nId, aType, aName, aValue) => {
            if (typeof api === "undefined") return false;
            const note = api.getNote?.(nId);
            if (!note) return false;
            if (aType === "label") note.setLabel(aName, aValue || "");
            else if (aType === "relation") note.setRelation(aName, aValue || "");
            else return false;
            return true;
          },
          [noteId, type, name, value]
        );
        if (applied) return;
      } catch {
      }
    }
    const glob = globalThis.glob;
    if (!glob) throw new Error("Not running inside Trilium.");
    const headers = {
      "x-csrf-token": glob.csrfToken,
      "trilium-component-id": glob.componentId,
      "content-type": "application/json"
    };
    const path = `${glob.baseApiUrl}notes/${noteId}/set-attribute`;
    const body = JSON.stringify({ type, name, value, isInheritable: false });
    const send = () => globalThis.fetch(path, {
      method: "PUT",
      credentials: "same-origin",
      headers,
      body
    });
    let response = await send();
    if (response.status === 403) {
      const bootstrapUrl = `./bootstrap${globalThis.location?.search ?? ""}`;
      const bootstrap = await globalThis.fetch(bootstrapUrl, {
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
    if (!response.ok) throw new Error(`Failed to set ${name} (HTTP ${response.status})`);
    const result = await response.json().catch(() => null);
    if (result?.success === false) throw new Error(`Trilium refused to set ${name}`);
  }
  async function searchManagedPackageNotes(api2) {
    if (typeof api2.searchForNotesIncludingHidden === "function") {
      return await api2.searchForNotesIncludingHidden("#packageArtifact");
    }
    const glob = globalThis.glob;
    if (!glob || typeof api2.getNotes !== "function") return [];
    const response = await globalThis.fetch(
      `${glob.baseApiUrl}quick-search/${encodeURIComponent("#packageArtifact")}`,
      { credentials: "same-origin" }
    );
    if (!response.ok) return [];
    const result = await response.json();
    return await api2.getNotes(result.searchResultNoteIds || [], true);
  }
  async function attachProjectDashboard(noteId, explicitApi) {
    const api2 = triliumApi2(explicitApi);
    if (!api2) return;
    const dashboardNotes = await searchManagedPackageNotes(api2);
    const dashboardCode = dashboardNotes.find((note) => {
      const artifact = note.getOwnedLabelValue?.("packageArtifact");
      return note.type === "code" && !note.isArchived && note.getOwnedLabelValue?.("packageOwner") === "iansherr/ikmal_tools_trilium" && ["notes-system-project-dashboard", "notes-system-project-dashboard-script"].includes(artifact || "");
    });
    if (!dashboardCode) return;
    const project = typeof api2.getNote === "function" ? await api2.getNote(noteId) : null;
    const { note: dashboard } = await api2.createNote(noteId, {
      title: project?.title ? `Dashboard: ${project.title}` : "Project Dashboard",
      type: "render",
      activate: false
    });
    if (!dashboard) throw new Error("Trilium did not return the project dashboard.");
    await setNoteAttribute(dashboard.noteId, "label", "extProjectDashboard", "projectHub", api2);
    await setNoteAttribute(dashboard.noteId, "relation", "renderNote", dashboardCode.noteId, api2);
  }
  function buildAttributeRows(plan) {
    return [
      ...plan.labelsToCreate.map((l) => ({ type: "label", name: l.name, value: l.value })),
      ...plan.relationsToCreate.map((r) => ({ type: "relation", name: r.name, value: r.value }))
    ];
  }
  async function resolveParentNoteId(api2, plan) {
    if (plan.targetContainerId) return plan.targetContainerId;
    let marker = plan.rootContainerMarker || (plan.templateId === "projectHub" ? "activeProjectRoot" : "projectRoot");
    if (plan.templateId === "projectHub" && marker === "projectRoot") {
      marker = "activeProjectRoot";
    }
    const isProjectScopedType = ["task", "projectTask", "story", "reportingNotes", "email", "meeting", "meetingPrep", "scratch"].includes(plan.templateId);
    const hasProjectHubRel = plan.relationsToCreate.some((r) => r.name === "project");
    if (isProjectScopedType && !hasProjectHubRel && plan.templateId !== "projectHub") {
      const unassigned = await api2.searchForNote("#unassignedRoot");
      if (unassigned) {
        return unassigned.noteId;
      }
    }
    let container = await api2.searchForNote(`#${marker}`);
    if (!container && marker === "activeProjectRoot") {
      const projectRoot = await api2.searchForNote("#projectRoot");
      const parentId = projectRoot ? projectRoot.noteId : "root";
      const { note: created } = await api2.createNote(parentId, {
        title: "Active",
        type: "book",
        activate: false,
        attributes: [
          { type: "label", name: "activeProjectRoot", value: "" },
          { type: "label", name: "iconClass", value: "bx bx-folder-open" },
          { type: "label", name: "projectArea", value: "active", isInheritable: true }
        ]
      });
      container = created;
    } else if (!container && marker === "archiveProjectRoot") {
      const projectRoot = await api2.searchForNote("#projectRoot");
      const parentId = projectRoot ? projectRoot.noteId : "root";
      const { note: created } = await api2.createNote(parentId, {
        title: "Archive",
        type: "book",
        activate: false,
        attributes: [
          { type: "label", name: "archiveProjectRoot", value: "" },
          { type: "label", name: "iconClass", value: "bx bx-archive" },
          { type: "label", name: "projectArea", value: "archive", isInheritable: true },
          { type: "label", name: "projectArchive", value: "", isInheritable: true }
        ]
      });
      container = created;
    } else if (!container && marker === "unassignedRoot") {
      const projectRoot = await api2.searchForNote("#projectRoot");
      const parentId = projectRoot ? projectRoot.noteId : "root";
      const { note: created } = await api2.createNote(parentId, {
        title: "Unassigned",
        type: "book",
        activate: false,
        attributes: [
          { type: "label", name: "unassignedRoot", value: "" },
          { type: "label", name: "iconClass", value: "bx bx-inbox" }
        ]
      });
      container = created;
    }
    if (!container) {
      container = await api2.searchForNote("#projectRoot") || await api2.searchForNote("#root");
    }
    if (!container) {
      throw new Error(`Could not find or create a container note tagged #${marker}.`);
    }
    return container.noteId;
  }
  async function materializeNoteCreation(plan, options) {
    const api2 = triliumApi2(options?.api);
    if (!api2) throw new Error("Not running inside Trilium.");
    if (plan.inheritedTopicSources && plan.inheritedTopicSources.length > 0) {
      const parentTopicMap = {};
      for (const sourceId of plan.inheritedTopicSources) {
        parentTopicMap[sourceId] = options?.topicFetcher ? await options.topicFetcher(sourceId) : await fetchNoteTopics(api2, sourceId);
      }
      const relEngine = options?.relationshipEngine ?? new RelationshipEngine(new TemplateEngine());
      applyDerivedTopics(plan, parentTopicMap, relEngine);
    }
    const parentNoteId = await resolveParentNoteId(api2, plan);
    let projectHubId = plan.relationsToCreate.find((r) => r.name === "project")?.value;
    if (!projectHubId && plan.templateId === "story" && parentNoteId) {
      try {
        const potentialHub = typeof api2.getNote === "function" ? await api2.getNote(parentNoteId) : null;
        if (potentialHub && (potentialHub.getOwnedLabelValue?.("extProjectHub") !== void 0 || potentialHub.getOwnedLabelValue?.("extTemplate") === "projectHub")) {
          projectHubId = parentNoteId;
        }
      } catch {
      }
    }
    if (projectHubId && (plan.templateId === "story" || plan.templateId === "edit")) {
      try {
        const hub = typeof api2.getNote === "function" ? await api2.getNote(projectHubId) : null;
        if (hub) {
          const hubStatus = hub.getOwnedLabelValue?.("status");
          if (hubStatus === "complete" || hubStatus === "archived") {
            await reopenProjectNote(hub.noteId, api2);
          }
          const children = typeof hub.getChildNotes === "function" ? await hub.getChildNotes() : [];
          const rounds = children.filter((c) => c.getOwnedLabelValue?.("extStoryDraft") !== void 0 || c.getOwnedLabelValue?.("extTemplate") === "story").map((c) => Number(c.getOwnedLabelValue?.("round"))).filter((r) => Number.isFinite(r));
          const nextRoundNum = rounds.length ? Math.max(...rounds) + 1 : 1;
          if (!plan.labelsToCreate.some((l) => l.name === "round")) {
            plan.labelsToCreate.push({ name: "round", value: String(nextRoundNum) });
          }
          const hubKind = hub.getOwnedLabelValue?.("kind") || plan.mode || "project";
          const roundLabel = hubKind === "edit" ? "Round" : "Draft";
          if (!/(?:\bround\s*\d+\b|\bdraft\s*\d+\b|\bv\s*\d+\b)/i.test(plan.formattedTitle)) {
            plan.formattedTitle = `${plan.formattedTitle} \u2014 ${roundLabel} ${nextRoundNum}`;
          }
          await setNoteAttribute(hub.noteId, "label", "currentRound", String(nextRoundNum), api2);
          const clientRel = hub.getRelations?.("client")?.[0];
          const clientId = clientRel?.value || clientRel?.targetNoteId;
          if (clientId && !plan.relationsToCreate.some((r) => r.name === "client")) {
            plan.relationsToCreate.push({ name: "client", value: clientId });
          }
        }
      } catch (err) {
        console.warn(`[Ikmal Tools] Story round reconciliation deferred: ${err}`);
      }
    }
    let noteContent = plan.content;
    if (noteContent && noteContent.includes("__OPEN_TASKS_VIEW__")) {
      try {
        const openTasksNote = await api2.searchForNote("#extView=openTasks");
        if (openTasksNote) {
          noteContent = noteContent.replace(/__OPEN_TASKS_VIEW__/g, openTasksNote.noteId);
        }
      } catch (err) {
        console.warn(`[Ikmal Tools] Open tasks saved search lookup deferred: ${err}`);
      }
    }
    const { note } = await api2.createNote(parentNoteId, {
      title: plan.formattedTitle,
      content: noteContent,
      type: plan.noteType || "text",
      activate: false,
      attributes: buildAttributeRows(plan)
    });
    if (!note) throw new Error("Trilium did not return the created note.");
    if (plan.templateId === "projectHub") {
      try {
        await attachProjectDashboard(note.noteId, api2);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Ikmal Tools] Project dashboard attachment deferred: ${message}`);
      }
    }
    const clonedUnder = [];
    for (const containerId of plan.autoCloneContainers) {
      await cloneNoteToParentNote(note.noteId, containerId, api2);
      clonedUnder.push(containerId);
    }
    for (const marker of plan.autoCloneContainerMarkers ?? []) {
      const containerId = await resolveContainerMarker(api2, marker);
      if (!containerId || clonedUnder.includes(containerId)) continue;
      await cloneNoteToParentNote(note.noteId, containerId, api2);
      clonedUnder.push(containerId);
    }
    if (plan.journalClone) {
      const journalNote = await api2.getTodayNote();
      if (journalNote) {
        await cloneNoteToParentNote(note.noteId, journalNote.noteId, api2);
        clonedUnder.push(journalNote.noteId);
      }
    }
    const childNoteIds = [];
    for (const child of plan.childNotesToCreate ?? []) {
      const childAttributes = child.labels.map((l) => ({ type: "label", name: l.name, value: l.value }));
      if (plan.templateId === "projectHub") {
        childAttributes.push({ type: "relation", name: "project", value: note.noteId });
      }
      const { note: childNote } = await api2.createNote(note.noteId, {
        title: child.title,
        content: child.content || "",
        activate: false,
        attributes: childAttributes
      });
      if (childNote) {
        childNoteIds.push(childNote.noteId);
        const journalNote = await api2.getTodayNote();
        if (journalNote) {
          try {
            await cloneNoteToParentNote(childNote.noteId, journalNote.noteId, api2);
          } catch {
          }
        }
      }
    }
    if (["task", "projectTask", "story", "edit"].includes(plan.templateId)) {
      try {
        await reconcileProjectHubStatuses(api2);
      } catch {
      }
    }
    return { noteId: note.noteId, title: note.title, clonedUnder, childNoteIds };
  }
  async function removeNoteFromParentNote(childNoteId, parentNoteId, explicitApi) {
    const frontendApi = explicitApi || globalThis.api;
    if (frontendApi && typeof frontendApi.runOnBackend === "function") {
      try {
        const applied = await frontendApi.runOnBackend((cId, pId) => {
          if (typeof api === "undefined" || typeof api.ensureNoteIsAbsentFromParent !== "function") {
            return false;
          }
          api.ensureNoteIsAbsentFromParent(cId, pId);
          return true;
        }, [childNoteId, parentNoteId]);
        if (applied) return;
      } catch {
      }
    }
    const glob = globalThis.glob;
    if (!glob) return;
    const headers = {
      "x-csrf-token": glob.csrfToken,
      "trilium-component-id": glob.componentId,
      "content-type": "application/json"
    };
    const path = `${glob.baseApiUrl}notes/${childNoteId}/toggle-in-parent/${parentNoteId}/false`;
    const send = () => globalThis.fetch(path, {
      method: "PUT",
      credentials: "same-origin",
      headers,
      body: JSON.stringify({})
    });
    let response = await send();
    if (response.status === 403) {
      const bootstrapUrl = `./bootstrap${globalThis.location?.search ?? ""}`;
      const bootstrap = await globalThis.fetch(bootstrapUrl, { credentials: "same-origin", cache: "no-store" });
      if (bootstrap.ok) {
        const refreshed = await bootstrap.json();
        glob.csrfToken = refreshed.csrfToken;
        headers["x-csrf-token"] = refreshed.csrfToken;
        response = await send();
      }
    }
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to remove note ${childNoteId} from ${parentNoteId} (HTTP ${response.status})`);
    }
    if (response.ok) {
      const result = await response.json().catch(() => null);
      if (result?.success === false) {
        throw new Error(`Trilium refused to remove note ${childNoteId} from ${parentNoteId}`);
      }
    }
  }
  async function archiveProjectNote(hubNoteId, explicitApi) {
    const api2 = triliumApi2(explicitApi);
    if (!api2) return;
    const archiveRoot = await api2.searchForNote("#archiveProjectRoot");
    const activeRoot = await api2.searchForNote("#activeProjectRoot");
    const projectRoot = await api2.searchForNote("#projectRoot");
    if (archiveRoot) {
      await cloneNoteToParentNote(hubNoteId, archiveRoot.noteId, api2);
    }
    if (activeRoot) {
      await removeNoteFromParentNote(hubNoteId, activeRoot.noteId, api2);
    }
    if (projectRoot) {
      await removeNoteFromParentNote(hubNoteId, projectRoot.noteId, api2);
    }
    await setNoteAttribute(hubNoteId, "label", "status", "complete", api2);
  }
  async function reopenProjectNote(hubNoteId, explicitApi) {
    const api2 = triliumApi2(explicitApi);
    if (!api2) return;
    const activeRoot = await api2.searchForNote("#activeProjectRoot");
    const archiveRoot = await api2.searchForNote("#archiveProjectRoot");
    const projectRoot = await api2.searchForNote("#projectRoot");
    if (activeRoot) {
      await cloneNoteToParentNote(hubNoteId, activeRoot.noteId, api2);
    }
    if (archiveRoot) {
      await removeNoteFromParentNote(hubNoteId, archiveRoot.noteId, api2);
    }
    if (projectRoot) {
      await removeNoteFromParentNote(hubNoteId, projectRoot.noteId, api2);
    }
    await setNoteAttribute(hubNoteId, "label", "status", "active", api2);
  }
  async function reconcileProjectHubStatuses(explicitApi) {
    const api2 = triliumApi2(explicitApi);
    if (!api2 || typeof api2.searchForNotes !== "function") return 0;
    const hubs = await api2.searchForNotes("#extTemplate=projectHub") || [];
    const legacyHubs = await api2.searchForNotes("#extProjectHub") || [];
    const allHubs = [...hubs];
    for (const h of legacyHubs) {
      if (!allHubs.some((existing) => existing.noteId === h.noteId)) {
        allHubs.push(h);
      }
    }
    let updated = 0;
    for (const hub of allHubs) {
      const status = hub.getOwnedLabelValue?.("status");
      const drafts = [];
      if (typeof hub.getChildNotes === "function") {
        const children = await hub.getChildNotes();
        for (const c of children) {
          if (c.getOwnedLabelValue?.("extStoryDraft") !== void 0 || c.getOwnedLabelValue?.("extTemplate") === "story" || c.getOwnedLabelValue?.("extTemplate") === "edit") {
            drafts.push(c);
          }
        }
      }
      const relDrafts = await api2.searchForNotes(`~project='${hub.noteId}' AND (#extStoryDraft OR #extTemplate=story OR #extTemplate=edit)`);
      for (const rd of relDrafts || []) {
        if (!drafts.some((d) => d.noteId === rd.noteId)) {
          drafts.push(rd);
        }
      }
      if (!drafts.length) continue;
      drafts.sort((a, b) => Number(b.getOwnedLabelValue?.("round") || 0) - Number(a.getOwnedLabelValue?.("round") || 0));
      const latestDraft = drafts[0];
      const latestStatus = (latestDraft.getOwnedLabelValue?.("status") || "").toLowerCase();
      const isLatestDone = latestStatus === "done" || latestStatus === "approved" || latestStatus === "published" || Boolean(latestDraft.getOwnedLabelValue?.("doneDate"));
      if (isLatestDone && status !== "complete") {
        await archiveProjectNote(hub.noteId, api2);
        updated++;
      } else if (!isLatestDone && (status === "complete" || status === "archived")) {
        await reopenProjectNote(hub.noteId, api2);
        updated++;
      }
    }
    return updated;
  }

  // src/components/QuickCaptureModal.ts
  function formatOptionLabel(attrName, opt) {
    const map = {
      todo: "\u{1F4DD} To Do",
      in_progress: "\u23F3 In Progress",
      done: "\u2705 Done",
      cancelled: "\u{1F6AB} Cancelled",
      drafting: "\u270F\uFE0F Drafting",
      editing: "\u2702\uFE0F Editing",
      review: "\u{1F440} In Review",
      published: "\u{1F680} Published",
      approved: "\u2705 Approved",
      returned: "\u{1F504} Returned",
      active: "\u{1F7E2} Active",
      archived: "\u{1F4E6} Archived",
      on_hold: "\u23F8\uFE0F On Hold",
      awaiting: "\u23F3 Awaiting Reply",
      high: "\u{1F534} High Priority",
      medium: "\u{1F7E1} Medium Priority",
      low: "\u{1F7E2} Low Priority",
      simple: "\u26A1 Simple Task",
      multi: "\u{1F9E9} Multi-step Task",
      project: "\u{1F4D8} Story Project",
      edit: "\u270F\uFE0F Edit Package",
      client: "\u{1F3E2} Client Hub",
      internal: "\u2699\uFE0F Internal Hub"
    };
    return map[opt] || opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, " ");
  }
  function triliumApi3(explicitApi) {
    const a = explicitApi || globalThis.api;
    return a && typeof a.searchForNotes === "function" ? a : null;
  }
  async function showQuickCaptureModal(templateId, templateEngine, noteCreationEngine, onCreated, initialRelations, options) {
    const isStoryOrEdit = templateId === "story" || templateId === "edit";
    const activeTplId = isStoryOrEdit ? "story" : templateId;
    const template = templateEngine.getTemplate(activeTplId);
    if (!template) return;
    const isEditMode = templateId === "edit";
    const descriptions = {
      task: "Creates an actionable task item with priority, due date, and status labels.",
      meeting: "Creates a meeting notes document linked to participants, clients, or organizations.",
      story: "Starts a full Story Project from scratch. Creates a Project Hub (#kind=project), a Story Draft (#status=drafting), and a dedicated Reporting & Notes child note. Auto-cloned to today's Journal.",
      edit: "Starts a Quick Edit Package. Creates an Edit Project Hub (#kind=edit) and a Story Draft (#status=editing, #workflow=edit) for fast copy editing/proofreading, skipping extra reporting notes. Auto-cloned to today's Journal.",
      dailyNote: "Creates today's daily journal note.",
      projectHub: "Creates a new Project Hub root folder to organize tasks, stories, and meetings.",
      scratch: "Creates a quick scratchpad note. Choose an Active Project Hub to organize it under a project, or keep it in Unassigned for later."
    };
    const description = descriptions[templateId] || `Creates a new ${template.title} note.`;
    const modalTitle = isEditMode ? "New Edit Package" : templateId === "story" ? "New Story Project" : `New ${template.title}`;
    const api2 = triliumApi3(options?.api);
    const relationCandidates = /* @__PURE__ */ new Map();
    const candidateTemplateIds = /* @__PURE__ */ new Map();
    for (const rel of template.relationships) {
      candidateTemplateIds.set(rel.relationName, rel.targetTemplateId);
    }
    for (const attr of template.attributes) {
      if (attr.dataType === "relation" && attr.targetTemplateId) {
        candidateTemplateIds.set(attr.name, attr.targetTemplateId);
      }
    }
    for (const [fieldName, targetTemplateId] of candidateTemplateIds) {
      if (!api2) {
        relationCandidates.set(fieldName, []);
        continue;
      }
      const targetTpl = templateEngine.getTemplate(targetTemplateId);
      let notes = [];
      if (targetTpl) {
        notes = await api2.searchForNotes(`#${targetTpl.marker}`);
        if (targetTpl.id === "projectHub") {
          const legacyHubs = await api2.searchForNotes("#extTemplate=projectHub");
          for (const h of legacyHubs) {
            if (!notes.some((existing) => existing.noteId === h.noteId)) {
              notes.push(h);
            }
          }
        }
      }
      relationCandidates.set(fieldName, notes);
    }
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop fade show";
    backdrop.style.zIndex = "1050";
    const modal = document.createElement("div");
    modal.className = "modal fade show d-block";
    modal.tabIndex = -1;
    modal.style.zIndex = "1055";
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content border shadow-lg" style="background-color: var(--sub-background-color, transparent); color: var(--main-text-color, inherit); border-color: var(--border-color, rgba(128,128,128,0.3)) !important;">
                <div class="modal-header border-bottom p-3">
                    <h5 class="modal-title h6 font-weight-bold d-flex align-items-center gap-2">
                        <i class="bx bx-${isEditMode ? "edit" : template.icon} text-primary"></i>
                        <span>${modalTitle}</span>
                    </h5>
                    <button type="button" class="btn-close close-btn" aria-label="Close"></button>
                </div>
                <div class="modal-body p-4 d-flex flex-column gap-3">
                    <div class="d-flex align-items-center gap-1.5 flex-wrap pb-2 border-bottom template-switcher-bar">
                        <span class="tiny text-muted font-weight-bold me-1"><i class="bx bx-category"></i> Switch Template:</span>
                        ${[
      { id: "task", label: "Task", icon: "check-square" },
      { id: "story", label: "Story Project", icon: "news" },
      { id: "edit", label: "Edit Package", icon: "edit" },
      { id: "meeting", label: "Meeting", icon: "calendar-event" },
      { id: "person", label: "Person", icon: "user" },
      { id: "organization", label: "Organization", icon: "buildings" },
      { id: "projectHub", label: "Project Hub", icon: "book" },
      { id: "scratch", label: "Scratch", icon: "file-blank" },
      { id: "topic", label: "Topic", icon: "purchase-tag" }
    ].map((t) => `
                            <button type="button" class="btn btn-micro ${t.id === templateId ? "btn-primary" : "btn-outline-secondary"} tpl-switch-btn" data-tpl="${t.id}" style="border-radius: 12px;">
                                <i class="bx bx-${t.icon}"></i> ${t.label}
                            </button>
                        `).join("")}
                    </div>

                    <div class="p-3 rounded border" style="background-color: var(--main-background-color, transparent); border-color: var(--border-color, rgba(128,128,128,0.2)) !important;">
                        <div class="small font-weight-bold text-info d-flex align-items-center gap-1.5 mb-1">
                            <i class="bx bx-info-circle"></i> Quick Capture: ${modalTitle}
                        </div>
                        <p class="small text-muted m-0">${description}</p>
                    </div>

                    <div>
                        <label class="form-label small font-weight-bold">${modalTitle} Title</label>
                        <input type="text" class="form-control title-input" placeholder="e.g. ${isEditMode ? "Round 1 Edit Package" : "Investigative Report Title"}" value="">
                    </div>

                    ${template.attributes.filter((a) => !(a.dataType === "relation" && template.relationships.some((rel) => rel.relationName === a.name))).length > 0 ? `
                        <div class="border-top pt-3">
                            <label class="form-label small font-weight-bold d-flex align-items-center gap-1 mb-2">
                                <i class="bx bx-slider-alt text-success"></i> Promoted Form Attributes
                            </label>
                            <div class="row g-2 attr-form">
                                ${template.attributes.filter((a) => !(a.dataType === "relation" && template.relationships.some((rel) => rel.relationName === a.name))).map((a) => {
      const opts = a.options || (a.name === "priority" ? ["medium", "high", "low"] : a.name === "complexity" ? ["simple", "multi"] : a.name === "kind" ? ["project", "edit", "client", "internal"] : a.name === "status" ? templateId === "story" ? ["drafting", "review", "published"] : templateId === "edit" ? ["editing", "approved", "returned"] : templateId === "projectHub" ? ["active", "on_hold", "complete", "archived"] : ["todo", "in_progress", "done", "cancelled"] : void 0);
      const isRelationPicker = a.dataType === "relation" && Boolean(a.targetTemplateId);
      const isOptionPicker = isRelationPicker || a.dataType === "select" || Boolean(opts);
      const relationOptions = isRelationPicker ? relationCandidates.get(a.name) || [] : [];
      const targetTpl = a.targetTemplateId ? templateEngine.getTemplate(a.targetTemplateId) : void 0;
      return `
                                    <div class="col-md-6">
                                        <label class="form-label tiny text-muted font-weight-bold">#${a.name}</label>
                                        ${isOptionPicker ? `
                                            <div class="attr-picker" data-attr-picker="${escapeHtml(a.name)}"></div>
                                        ` : `
                                            <input type="${a.dataType === "date" ? "date" : "text"}" class="form-control form-control-sm attr-input" data-attr="${escapeHtml(a.name)}" value="${escapeHtml(String(a.defaultValue ?? ""))}" placeholder="Value...">
                                        `}
                                    </div>
                                    `;
    }).join("")}
                            </div>
                        </div>
                    ` : ""}

                    ${template.relationships.length > 0 ? `
                        <div class="border-top pt-3 rel-form">
                            <label class="form-label small font-weight-bold d-flex align-items-center gap-1 mb-2">
                                <i class="bx bx-link text-warning"></i> Parent links
                            </label>
                        </div>
                    ` : ""}

                    <!-- Error state -->
                    <div class="create-error alert alert-danger d-none m-0"></div>
                </div>
                <div class="modal-footer border-top p-3 d-flex justify-content-between align-items-center">
                    <span class="destination-badge text-muted tiny font-weight-bold d-flex align-items-center gap-1" style="opacity: 0.85;">
                        <i class="bx bx-map-pin text-primary"></i> <span class="dest-label">Landing: ${escapeHtml(template.title)} Container</span>
                    </span>
                    <div class="d-flex align-items-center gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary close-btn">Cancel</button>
                        <button type="button" class="btn btn-sm btn-primary create-btn d-flex align-items-center gap-1" title="Cmd/Ctrl+Enter to create">
                            <i class="bx bx-plus"></i> Create ${modalTitle}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const closeButtons = modal.querySelectorAll(".close-btn");
    closeButtons.forEach((btn) => btn.addEventListener("click", closeModal));
    const tplSwitchButtons = modal.querySelectorAll(".tpl-switch-btn");
    tplSwitchButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const targetTpl = e.currentTarget.dataset.tpl;
        if (targetTpl && targetTpl !== templateId) {
          closeModal();
          showQuickCaptureModal(targetTpl, templateEngine, noteCreationEngine, onCreated, initialRelations, options);
        }
      });
    });
    function closeModal() {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
    const destLabel = modal.querySelector(".dest-label");
    function updateDestinationBadge() {
      if (!destLabel) return;
      const projectPicker = relPickers.get("project");
      const selectedProjectVal = projectPicker ? projectPicker.getValue() : null;
      if (isStoryOrEdit && !selectedProjectVal) {
        destLabel.textContent = "Destination: Projects / Active";
      } else if (selectedProjectVal) {
        const projCandidates = relationCandidates.get("project") || [];
        const match = projCandidates.find((c) => c.noteId === selectedProjectVal);
        destLabel.textContent = `Destination: Under ${match?.title || "Selected Project"}`;
      } else if (templateId === "task") {
        destLabel.textContent = "Destination: Tasks / Unassigned (+ Journal Clone)";
      } else if (templateId === "scratch") {
        destLabel.textContent = "Destination: Projects / Unassigned";
      } else {
        destLabel.textContent = `Destination: ${template?.title || modalTitle} Folder`;
      }
    }
    const attrPickers = /* @__PURE__ */ new Map();
    const relPickers = /* @__PURE__ */ new Map();
    modal.querySelectorAll(".attr-picker").forEach((placeholder) => {
      const attrName = placeholder.dataset.attrPicker;
      const attrDef = template.attributes.find((candidate) => candidate.name === attrName);
      if (!attrName || !attrDef) return;
      const isRelationPicker = attrDef.dataType === "relation" && Boolean(attrDef.targetTemplateId);
      const fallbackOptions = attrDef.name === "priority" ? ["medium", "high", "low"] : attrDef.name === "complexity" ? ["simple", "multi"] : attrDef.name === "kind" ? ["project", "edit", "client", "internal"] : attrDef.name === "status" ? templateId === "story" ? ["drafting", "review", "published"] : templateId === "edit" ? ["editing", "approved", "returned"] : templateId === "projectHub" ? ["active", "on_hold", "complete", "archived"] : ["todo", "in_progress", "done", "cancelled"] : [];
      const options2 = isRelationPicker ? (relationCandidates.get(attrName) || []).map((note) => ({
        value: note.noteId,
        label: note.title,
        icon: attrDef.targetTemplateId ? `bx-${templateEngine.getTemplate(attrDef.targetTemplateId)?.icon || "file"}` : "bx-file"
      })) : (attrDef.options || fallbackOptions).map((option) => ({
        value: option,
        label: formatOptionLabel(attrName, option)
      }));
      const picker = searchableSelect({
        id: `attr-${attrName}`,
        value: String(attrDef.defaultValue ?? ""),
        placeholder: isRelationPicker ? options2.length ? `Search ${templateEngine.getTemplate(attrDef.targetTemplateId)?.title || "notes"}\u2026` : "No matching notes found" : "Choose or search\u2026",
        options: options2
      });
      placeholder.replaceWith(picker.el);
      attrPickers.set(attrName, picker);
    });
    const relForm = modal.querySelector(".rel-form");
    for (const rel of template.relationships) {
      const candidates = relationCandidates.get(rel.relationName) ?? [];
      const field = document.createElement("div");
      field.className = "ns-field mb-2";
      const labelText = rel.isMulti ? `~${escapeHtml(rel.relationName)} (multi) &rarr; ${escapeHtml(rel.targetTemplateName)}` : `~${escapeHtml(rel.relationName)} &rarr; ${escapeHtml(rel.targetTemplateName)}`;
      const headerRow = document.createElement("div");
      headerRow.className = "d-flex justify-content-between align-items-center mb-1";
      headerRow.innerHTML = `<label class="form-label tiny text-muted font-weight-bold m-0">${labelText}</label>`;
      const targetTplId = rel.targetTemplateId;
      if (["organization", "person", "client", "companyOnBehalf", "employer"].includes(rel.relationName) || ["organization", "person"].includes(targetTplId)) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn-link btn-sm p-0 tiny text-decoration-none text-primary";
        addBtn.innerHTML = `<i class="bx bx-plus-circle"></i> New ${escapeHtml(rel.targetTemplateName)}`;
        addBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          const newTitle = globalThis.prompt ? globalThis.prompt(`Enter title for new ${rel.targetTemplateName}:`) : null;
          if (!newTitle || !newTitle.trim()) return;
          const entType = targetTplId === "person" ? "person" : "organization";
          const plan = noteCreationEngine.planNoteCreation({
            type: entType,
            title: newTitle.trim()
          });
          try {
            const res = api2 ? await materializeNoteCreation(plan, { api: api2 }) : void 0;
            const createdId = res ? res.noteId : `preview_${Date.now()}`;
            candidates.push({ noteId: createdId, title: newTitle.trim() });
            picker.setOptions?.(candidates.map((n) => ({ value: n.noteId, label: n.title })));
            picker.setValue(rel.isMulti ? [...Array.isArray(picker.getValue()) ? picker.getValue() : [], createdId] : createdId);
            updateDestinationBadge();
          } catch (err) {
            if (globalThis.alert) globalThis.alert(`Could not create ${rel.targetTemplateName}: ${err.message}`);
          }
        });
        headerRow.appendChild(addBtn);
      }
      field.appendChild(headerRow);
      if (rel.relationName === "project" && candidates.length > 0) {
        const chipsRow = document.createElement("div");
        chipsRow.className = "d-flex align-items-center gap-1 mb-1.5 flex-wrap project-quick-chips";
        chipsRow.innerHTML = `<span class="tiny text-muted me-1">Quick pick:</span>`;
        candidates.slice(0, 4).forEach((c) => {
          const chipBtn = document.createElement("button");
          chipBtn.type = "button";
          chipBtn.className = "btn btn-micro btn-outline-secondary";
          chipBtn.style.borderRadius = "10px";
          chipBtn.innerHTML = `<i class="bx bx-book"></i> ${escapeHtml(c.title)}`;
          chipBtn.addEventListener("click", () => {
            picker.setValue(c.noteId);
            updateDestinationBadge();
          });
          chipsRow.appendChild(chipBtn);
        });
        field.appendChild(chipsRow);
      }
      const initialVal = initialRelations && initialRelations[rel.relationName] ? initialRelations[rel.relationName] : rel.isMulti ? [] : "";
      const targetTpl = templateEngine.getTemplate(rel.targetTemplateId);
      const iconClass = targetTpl?.icon ? `bx-${targetTpl.icon}` : "bx-file";
      const picker = searchableSelect({
        id: `rel-${rel.relationName}`,
        value: initialVal,
        isMulti: rel.isMulti,
        placeholder: candidates.length ? `Search ${rel.targetTemplateName}\u2026` : `No existing ${rel.targetTemplateName} notes found`,
        options: candidates.map((n) => ({ value: n.noteId, label: n.title, icon: iconClass }))
      });
      field.appendChild(picker.el);
      relForm?.appendChild(field);
      relPickers.set(rel.relationName, picker);
    }
    updateDestinationBadge();
    const titleInput = modal.querySelector(".title-input");
    const createBtn = modal.querySelector(".create-btn");
    const errorBox = modal.querySelector(".create-error");
    setTimeout(() => titleInput?.focus(), 50);
    modal.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        createBtn.click();
      }
    });
    createBtn.addEventListener("click", async () => {
      const rawTitle = titleInput.value.trim() || `Untitled ${modalTitle}`;
      const attrInputs = modal.querySelectorAll(".attr-input");
      const attributes = {};
      attrInputs.forEach((input) => {
        const attrName = input.dataset.attr;
        if (attrName) attributes[attrName] = input.value;
      });
      for (const [attrName, picker] of attrPickers) {
        const value = picker.getValue();
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          attributes[attrName] = value;
        }
      }
      const relations = {};
      for (const [relationName, picker] of relPickers) {
        const value = picker.getValue();
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          relations[relationName] = value;
        }
      }
      const plan = noteCreationEngine.planNoteCreation({
        type: templateId,
        title: rawTitle,
        attributes,
        relations,
        mode: isEditMode ? "edit" : "project"
      });
      errorBox.classList.add("d-none");
      createBtn.disabled = true;
      createBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating\u2026';
      try {
        const result = api2 ? await materializeNoteCreation(plan, { api: api2 }) : void 0;
        if (result) api2?.showMessage?.(`Created "${result.title}".`);
        closeModal();
        onCreated?.({ plan, result });
      } catch (err) {
        errorBox.textContent = `Could not create the note: ${err.message}`;
        errorBox.classList.remove("d-none");
        createBtn.disabled = false;
        createBtn.innerHTML = `<i class="bx bx-plus"></i> Create ${escapeHtml(modalTitle)}`;
      }
    });
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

  // src/engine/runtimeModel.ts
  async function loadRuntimeModel(templateEngine, todayEngine, ifThenRuleEngine, settingsEngine, api2) {
    const [savedSpec, loadedSettings] = await Promise.all([
      loadYamlSpecification(api2).catch((error) => {
        console.warn(`[Ikmal Tools] Saved YAML could not be loaded; using built-ins: ${error}`);
        return null;
      }),
      loadAutomationSettings(api2).catch((error) => {
        console.warn(`[Ikmal Tools] Automation settings could not be loaded; using defaults: ${error}`);
        return { ...settingsEngine.getAll() };
      })
    ]);
    for (const key of Object.keys(loadedSettings)) {
      settingsEngine.set(key, loadedSettings[key]);
    }
    const yamlSpec = savedSpec?.trim() ? savedSpec : DEFAULT_STARTER_YAML_SPEC;
    if (savedSpec?.trim()) {
      try {
        const validation = parseAndApplyYamlSpec(
          savedSpec,
          new TodayEngine(),
          new TemplateEngine(),
          new IfThenRuleEngine()
        );
        if (!validation.success) {
          console.warn(`[Ikmal Tools] Saved YAML is invalid; using built-in model: ${validation.message}`);
          return { yamlSpec: DEFAULT_STARTER_YAML_SPEC };
        }
        const applied = parseAndApplyYamlSpec(savedSpec, todayEngine, templateEngine, ifThenRuleEngine);
        if (!applied.success) {
          console.warn(`[Ikmal Tools] Saved YAML could not be applied; using built-in model: ${applied.message}`);
          return { yamlSpec: DEFAULT_STARTER_YAML_SPEC };
        }
      } catch (error) {
        console.warn(`[Ikmal Tools] Saved YAML is invalid; using built-in model: ${error}`);
        return { yamlSpec: DEFAULT_STARTER_YAML_SPEC };
      }
    }
    return { yamlSpec };
  }

  // src/artifacts/notes-system-dashboard.jsx
  var escapeHtml2 = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
  function initNotesSystemDashboard(containerEl) {
    const templateEngine = new TemplateEngine();
    const relationshipEngine = new RelationshipEngine(templateEngine);
    const ifThenRuleEngine = new IfThenRuleEngine();
    const todayEngine = new TodayEngine();
    const settingsEngine = new SettingsEngine();
    const noteCreationEngine = new NoteCreationEngine(templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine);
    let activeTab = "today";
    let yamlEditorSpec;
    const frontendApi = typeof api !== "undefined" ? api : null;
    const modelReady = loadRuntimeModel(templateEngine, todayEngine, ifThenRuleEngine, settingsEngine, frontendApi);
    function renderMain() {
      containerEl.innerHTML = "";
      const shell = document.createElement("div");
      shell.className = "notes-system-shell";
      const nav = document.createElement("div");
      nav.className = "ns-tabs";
      nav.setAttribute("role", "tablist");
      const tabs = [
        { id: "today", label: "Today", icon: "home-alt" },
        { id: "templates", label: "Template Studio", icon: "layer" },
        { id: "settings", label: "Settings", icon: "slider-alt" }
      ];
      for (const t of tabs) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `ns-tab ${activeTab === t.id ? "active" : ""}`;
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", String(activeTab === t.id));
        btn.innerHTML = `<span class="bx bx-${t.icon}"></span> ${t.label}`;
        btn.addEventListener("click", () => {
          activeTab = t.id;
          renderMain();
        });
        nav.appendChild(btn);
      }
      shell.appendChild(nav);
      const contentArea = document.createElement("div");
      contentArea.className = "notes-system-content";
      try {
        if (activeTab === "today") {
          renderTodayHomepage(contentArea, todayEngine, templateEngine, async (templateId) => {
            await modelReady;
            return showQuickCaptureModal(templateId, templateEngine, noteCreationEngine, ({ plan, result }) => {
              if (result) {
                renderMain();
              } else {
                const cloneTarget = plan.autoCloneContainers.length ? plan.autoCloneContainers.join(", ") : plan.journalClone ? "Today's Journal" : "None";
                alert(`Preview only (no Trilium api present).

Formatted Title: ${plan.formattedTitle}
Labels: ${plan.labelsToCreate.map((l) => "#" + l.name + "=" + l.value).join(", ")}
Auto-Clone Target: ${cloneTarget}`);
              }
            }, void 0, { api: frontendApi });
          }, settingsEngine, { api: typeof api !== "undefined" ? api : null });
        } else if (activeTab === "templates") {
          renderTemplateStudio(contentArea, templateEngine, ifThenRuleEngine, () => {
            const spec = dumpYamlSpec(todayEngine.getLayout(), templateEngine, relationshipEngine, ifThenRuleEngine);
            yamlEditorSpec = spec;
            saveYamlSpecification(spec, frontendApi).then(() => renderMain()).catch((error) => console.warn(`[Ikmal Tools] Template changes could not be saved: ${error}`));
          }, frontendApi);
        } else if (activeTab === "settings") {
          renderSettingsStudio(contentArea, todayEngine, templateEngine, relationshipEngine, ifThenRuleEngine, settingsEngine, (yamlSpec) => {
            yamlEditorSpec = yamlSpec;
            return saveYamlSpecification(yamlSpec, frontendApi);
          }, yamlEditorSpec, frontendApi);
        }
      } catch (renderError) {
        contentArea.innerHTML = `
                <div class="card p-4 my-3 text-center border-danger">
                    <div class="card-body">
                        <i class="bx bx-error-circle text-danger display-4 mb-2"></i>
                        <h4 class="card-title text-danger">Widget Render Issue</h4>
                        <p class="card-text text-muted">${escapeHtml2(renderError?.message || "An unexpected rendering error occurred in this view.")}</p>
                        <button type="button" class="btn btn-outline-primary btn-sm mt-2" data-action="reload-widget">
                            <i class="bx bx-refresh"></i> Reload View
                        </button>
                    </div>
                </div>
            `;
        contentArea.querySelector('[data-action="reload-widget"]')?.addEventListener("click", () => renderMain());
      }
      shell.appendChild(contentArea);
      containerEl.appendChild(shell);
    }
    renderMain();
    modelReady.then(({ yamlSpec }) => {
      yamlEditorSpec = yamlSpec;
      renderMain();
    }).catch((error) => {
      console.warn(`[Ikmal Tools] Could not load the saved runtime model: ${error}`);
    });
  }
  if (typeof api !== "undefined" || typeof window !== "undefined") {
    const init = () => {
      const container = typeof api !== "undefined" && api.$container && (api.$container[0] || api.$container) || document.querySelector(".notes-system-root") || document.body;
      if (container) {
        initNotesSystemDashboard(container);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
