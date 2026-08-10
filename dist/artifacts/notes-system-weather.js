"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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

  // src/artifacts/notes-system-weather.jsx
  function initIkmalWeather(containerEl) {
    const todayEngine = new TodayEngine();
    const modelReady = loadRuntimeModel(
      new TemplateEngine(),
      todayEngine,
      new IfThenRuleEngine(),
      new SettingsEngine(),
      typeof api !== "undefined" ? api : null
    );
    const shell = document.createElement("div");
    shell.className = "notes-system-shell p-3";
    const { card } = section(shell, {
      title: "Ikmal Weather & Climate Card",
      description: "Live local weather, condition forecast, and moon phase illumination."
    });
    const weatherBox = document.createElement("div");
    weatherBox.className = "ns-card p-3 mt-2";
    weatherBox.innerHTML = '<div class="ns-empty">Loading weather settings\u2026</div>';
    async function renderWeather() {
      await modelReady;
      const configured = todayEngine.getLayout().weather;
      const phase = computeMoonPhase(/* @__PURE__ */ new Date());
      if (!hasLocation(configured)) {
        weatherBox.innerHTML = `<div class="d-flex align-items-center gap-2"><i class="bx bx-moon fs-2 text-warning"></i><div><h6 class="mb-0 fw-bold">Local Climate & Moon Phase</h6><small class="text-muted">${escapeHtml(phase.name)} (${Math.round(phase.illumination * 100)}% illuminated)</small></div></div><div class="alert alert-light border small text-muted mb-0 mt-3">Configure coordinates under Ikmal Package Settings to enable live Open-Meteo weather forecasts.</div>`;
        return;
      }
      weatherBox.innerHTML = '<div class="ns-empty">Loading local forecast\u2026</div>';
      try {
        const report = await fetchWeather(configured);
        weatherBox.innerHTML = `<div class="d-flex align-items-center justify-content-between mb-3"><div><h6 class="mb-0 fw-bold">${escapeHtml(configured.label || "Local weather")}</h6><div class="ns-meta">${escapeHtml(report.condition.label)} \xB7 ${report.temperature}${escapeHtml(report.temperatureUnit)} \xB7 wind ${report.windSpeed} ${escapeHtml(report.windUnit)}</div></div><i class="bx bx-${escapeHtml(report.condition.icon)} fs-2 text-warning"></i></div><div class="ns-meta">${report.days.map((day) => `${escapeHtml(day.date)}: ${day.high}\xB0 / ${day.low}\xB0`).join(" \xB7 ")}</div><div class="ns-meta mt-2">${escapeHtml(phase.name)} \xB7 ${Math.round(phase.illumination * 100)}% illuminated</div>`;
      } catch (error) {
        weatherBox.innerHTML = `<div class="alert alert-light border small text-muted mb-0">Could not load forecast: ${escapeHtml(error.message || error)}</div>`;
      }
    }
    card.appendChild(weatherBox);
    shell.appendChild(card);
    containerEl.appendChild(shell);
    renderWeather();
  }
  if (typeof api !== "undefined" || typeof window !== "undefined") {
    const init = () => {
      const container = typeof api !== "undefined" && api.$container && (api.$container[0] || api.$container) || document.querySelector(".ikmal-weather-root") || document.body;
      if (container) {
        initIkmalWeather(container);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
