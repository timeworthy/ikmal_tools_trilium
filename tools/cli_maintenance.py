#!/usr/bin/env python3
"""CLI Maintenance Tool for Ikmal Tools Trilium Plugin.

Provides headless install, repair, verification, and uninstallation commands
over Trilium's REST API (ETAPI). Maintains full feature parity with original
python appliers (apply_skeleton, apply_templates, apply_collections, apply_scripts).

Usage:
    python3 tools/cli_maintenance.py verify
    python3 tools/cli_maintenance.py repair
    python3 tools/cli_maintenance.py install
    python3 tools/cli_maintenance.py uninstall
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from etapi import Etapi, EtapiError
    import deploy_plugin_to_instance as deployer
except ImportError:
    from tools.etapi import Etapi, EtapiError
    import tools.deploy_plugin_to_instance as deployer


def _descendants(api: Etapi, root_id: str) -> list[str]:
    """Return a stable, cycle-safe preorder walk rooted at ``root_id``."""
    result: list[str] = []
    pending = [root_id]
    seen: set[str] = set()
    while pending:
        note_id = pending.pop(0)
        if not note_id or note_id in seen:
            continue
        seen.add(note_id)
        result.append(note_id)
        try:
            child_ids = api.get_note(note_id).get("childNoteIds", [])
        except Exception:
            child_ids = []
        pending.extend(child_ids)
    return result

# Kept in lockstep with `trilium-package.json` by a package manifest test, so
# the version this tool stamps on #extConfig matches what the deploy tool
# stamps on every artifact.
VERSION = "1.0.33"

CONTAINERS = [
    ("calendarRoot", "Journal", "root", "book", {"datePattern": "{isoDate} - {weekDay}", "iconClass": "bx bx-calendar"}),
    ("todayRoot", "Today", "root", "render", {"iconClass": "bx bx-sun"}),
    ("projectRoot", "Projects", "root", "book", {"iconClass": "bx bx-book"}),
    ("activeProjectRoot", "Active", "projectRoot", "book", {"iconClass": "bx bx-folder-open", "projectArea": "active"}),
    ("archiveProjectRoot", "Archive", "projectRoot", "book", {"iconClass": "bx bx-archive", "projectArea": "archive", "projectArchive": ""}),
    ("unassignedRoot", "Unassigned", "projectRoot", "book", {"iconClass": "bx bx-inbox"}),
    ("taskRoot", "Tasks", "root", "search", {"iconClass": "bx bx-check-square", "searchString": "#extTask AND #!doneDate orderBy #dueDate", "viewType": "board"}),
    ("meetingRoot", "Meetings", "root", "search", {"iconClass": "bx bx-calendar-event", "searchString": "#extMeeting AND #startDate orderBy #startDate", "viewType": "calendar"}),
    ("peopleRoot", "People", "root", "book", {"iconClass": "bx bx-group"}),
    ("orgRoot", "Organizations", "root", "book", {"iconClass": "bx bx-buildings"}),
    ("topicRoot", "Topics", "root", "book", {"iconClass": "bx bx-purchase-tag"}),
    ("templateRoot", "Templates", "_userHidden", "book", {"iconClass": "bx bx-copy", "subtreeHidden": ""}),
    ("extConfig", "Config", "_userHidden", "text", {"iconClass": "bx bx-cog", "extensionVersion": VERSION}),
    ("storyDraftRoot", "Drafts", "_userHidden", "book", {"iconClass": "bx bx-file"}),
    ("emailRoot", "Emails", "_userHidden", "book", {"iconClass": "bx bx-envelope"}),
    ("dashboardRoot", "Dashboards", "root", "book", {"iconClass": "bx bx-dashboard", "viewType": "dashboard"}),
]

# Attribute definition schemas
DUE_DATE = {"label:dueDate": "promoted,alias=Due,single,date"}
PRIORITY = {"label:priority": "promoted,alias=Priority,single,text"}
DURATION = {"label:duration": "promoted,alias=Duration,single,text"}
COMPLEXITY = {"label:complexity": "promoted,alias=Complexity,single,text"}
STATUS = {"label:status": "promoted,alias=Status,single,text"}
DONE_DATE = {"label:doneDate": "promoted,alias=Done,single,date"}
CLIENT = {"relation:client": "promoted,alias=Client,single"}
ON_BEHALF = {"relation:companyOnBehalf": "promoted,alias=On behalf of,single"}
PROJECT_REL = {"relation:project": "promoted,alias=Project,single"}
TOPICS = {"relation:topic": "promoted,alias=Topics,multi"}
TOPIC_ALIAS = {"relation:aliasOf": "promoted,alias=Canonical topic,single"}
RELATED_HUBS = {"relation:relatedHub": "promoted,alias=Related Hubs,multi"}
WRITER = {"relation:writer": "promoted,alias=Writer,single"}
CURRENT_ROUND = {"label:currentRound": "promoted,alias=Current round,single,number"}
NEXT_ACTION = {"label:nextAction": "promoted,alias=Next action,single,text"}

DAILY_NOTE_CONTENT = (
    "<style>.daily-note h2{margin:1.5rem 0 .55rem}.daily-note h2:first-child{margin-top:0}"
    ".daily-note p{min-height:1.4em}</style>"
    "<div class='daily-note'>"
    "<h2>Notes</h2><p></p>"
    "</div>"
)

STORY_DRAFT_CONTENT = (
    "<h2>HED</h2><ul><li></li><li></li><li></li></ul>"
    "<h2>DEK</h2><ul><li></li><li></li><li></li></ul>"
    "<h2>BYLINE</h2><p>By Ian Sherr (+1 415.347.6397)</p>"
    "<h2>STORYBODY</h2><p></p><p>--ENDIT--</p>"
)

REPORTING_NOTES_CONTENT = (
    "<h2>LINKS</h2><ul><li></li></ul>"
    "<h2>OPEN QUESTIONS</h2><ul><li></li></ul>"
    "<h2>IDEA / ANGLE</h2><p></p>"
    "<h2>REPORTING NOTES</h2><p></p>"
    "<div class='reporting-note-actions-placeholder' "
    "data-reporting-note-actions='true'></div>"
)

TEMPLATES_DETAILED = [
    {
        "title": "Daily Note",
        "marker": "daily",
        "content": DAILY_NOTE_CONTENT,
        "definitions": {},
        "labels": {"extTemplate": "daily", "template": "", "noteType": "daily"},
    },
    {
        "title": "Task",
        "marker": "task",
        "content": (
            "<h2>Overview</h2><p></p>"
            "<h2>Task Details</h2>"
            "<h3>Primary Task</h3><ul><li></li></ul>"
            "<h3>Sub-tasks</h3><ul><li></li><li></li><li></li></ul>"
            "<h3>Related Information</h3><p></p>"
            "<h3>Context</h3><p></p>"
            "<h3>Dependencies</h3><ul><li></li></ul>"
            "<h3>Acceptance Criteria</h3><ul><li></li><li></li><li></li></ul>"
            "<h2>Notes</h2><p></p>"
            "<h2>Links</h2><ul><li></li></ul>"
        ),
        "definitions": {**DUE_DATE, **PRIORITY, **DURATION, **COMPLEXITY, **STATUS, **DONE_DATE, **PROJECT_REL, **TOPICS},
        "labels": {"extTemplate": "task", "template": "", "noteType": "task", "extTask": "", "noteGroup": "task"},
    },
    {
        "title": "Project Task",
        "marker": "projectTask",
        "content": (
            "<h2>Project Overview</h2><p></p>"
            "<h2>Scope &amp; Objectives</h2>"
            "<h3>Primary Objective</h3><p></p>"
            "<h3>Success Metrics</h3><ul><li></li><li></li><li></li></ul>"
            "<h2>Task Breakdown</h2>"
            "<h3>Phase 1: Planning &amp; Setup</h3><ul><li></li><li></li><li></li></ul>"
            "<h3>Phase 2: Development</h3><ul><li></li><li></li><li></li></ul>"
            "<h3>Phase 3: Testing &amp; Validation</h3><ul><li></li><li></li><li></li></ul>"
            "<h3>Phase 4: Deployment &amp; Documentation</h3><ul><li></li><li></li><li></li></ul>"
            "<h2>Dependencies &amp; Blockers</h2>"
            "<h3>Prerequisites</h3><ul><li></li><li></li></ul>"
            "<h3>Potential Blockers</h3><ul><li></li><li></li></ul>"
            "<h2>Resources &amp; Stakeholders</h2><p></p>"
            "<h2>Timeline</h2><p></p>"
            "<h2>Progress Tracking</h2><p></p>"
            "<h2>Notes &amp; Updates</h2><p></p>"
            "<h2>Related Documents</h2><ul><li></li></ul>"
        ),
        "definitions": {**DUE_DATE, **PRIORITY, **DURATION, **COMPLEXITY, **STATUS, **DONE_DATE, **PROJECT_REL, **TOPICS},
        "labels": {"extTemplate": "projectTask", "template": "", "noteType": "projectTask", "extTask": "", "noteGroup": "task"},
    },
    {
        "title": "Meeting",
        "marker": "meeting",
        "content": (
            "<h2>Meeting Details</h2><p></p>"
            "<h2>Attendees</h2><ul><li></li><li></li></ul>"
            "<h2>Important Mentions</h2><ul><li></li><li></li></ul>"
            "<h2>Agenda &amp; Questions</h2><ul><li></li></ul>"
            "<h2>Notes</h2><p></p>"
            "<h2>Follow-up Actions</h2><ul><li></li></ul>"
            "<h2>Transcript</h2><p></p>"
        ),
        "definitions": {
            "label:startDate": "promoted,alias=Meeting date,single,date",
            "label:startTime": "promoted,alias=Start time,single,text",
            "relation:attendee": "promoted,alias=Attendees,multi",
            "relation:organization": "promoted,alias=Organization,multi",
            **PROJECT_REL,
            **TOPICS,
        },
        "labels": {"extTemplate": "meeting", "template": "", "noteType": "meeting", "extMeeting": "", "noteGroup": "meeting"},
    },
    {
        "title": "Meeting Prep",
        "marker": "meetingPrep",
        "content": (
            "<h2>Purpose</h2><p></p>"
            "<h2>Attendees</h2><ul><li></li></ul>"
            "<h2>Agenda</h2><ul><li></li></ul>"
            "<h2>Questions</h2><ul><li></li></ul>"
            "<h2>Pre-meeting Notes</h2><p></p>"
        ),
        "definitions": {
            "label:startDate": "promoted,alias=Meeting date,single,date",
            "relation:attendee": "promoted,alias=Attendees,multi",
            **PROJECT_REL,
            **TOPICS,
        },
        "labels": {"extTemplate": "meetingPrep", "template": "", "noteType": "meetingPrep", "extMeeting": "", "noteGroup": "meeting"},
    },
    {
        "title": "Story Draft",
        "marker": "storyDraft",
        "content": STORY_DRAFT_CONTENT,
        "definitions": {
            **CLIENT,
            **ON_BEHALF,
            "label:round": "promoted,alias=Round,single,number",
            **STATUS,
            **DONE_DATE,
            **PROJECT_REL,
            **TOPICS,
        },
        "labels": {"extTemplate": "storyDraft", "template": "", "noteType": "storyDraft", "extStoryDraft": "", "noteGroup": "draft"},
    },
    {
        "title": "Reporting Notes",
        "marker": "reportingNotes",
        "content": REPORTING_NOTES_CONTENT,
        "definitions": {**CLIENT, **ON_BEHALF, **PROJECT_REL, **TOPICS},
        "labels": {"extTemplate": "reportingNotes", "template": "", "noteType": "reportingNotes", "extReportingNotes": "", "noteGroup": "reporting"},
    },
    {
        "title": "Email Draft",
        "marker": "emailDraft",
        "content": (
            "<h2>Links</h2><ul><li></li></ul>"
            "<h2>Open Questions</h2><ul><li></li></ul>"
            "<h2>Subject</h2><p></p>"
            "<h2>Body</h2><p></p>"
            "<h2>Reply / Follow-up Notes</h2><p></p>"
        ),
        "definitions": {**CLIENT, **ON_BEHALF, **STATUS, **PROJECT_REL, **TOPICS},
        "labels": {"extTemplate": "emailDraft", "template": "", "noteType": "emailDraft", "extEmailDraft": "", "noteGroup": "email"},
    },
    {
        "title": "Person",
        "marker": "person",
        "content": (
            "<h2>Notes</h2><p></p>"
            "<h2>Meetings &amp; Mentions</h2><p></p>"
        ),
        "definitions": {
            "label:jobTitle": "promoted,alias=Job focus,single,text",
            "relation:employer": "promoted,alias=Employer,multi,inverse=staff",
            **PROJECT_REL,
            **TOPICS,
        },
        "labels": {"extTemplate": "person", "template": "", "noteType": "person", "noteGroup": "people"},
    },
    {
        "title": "Organization",
        "marker": "organization",
        "content": (
            "<h2>Notes</h2><p></p>"
            "<h2>Meetings</h2><p></p>"
            "<h2>Current People</h2><ul><li></li></ul>"
            "<h2>Past People</h2><ul><li></li></ul>"
        ),
        "definitions": {
            "label:location": "promoted,alias=Location,single,text",
            "label:ticker": "promoted,alias=Ticker,single,text",
            "relation:staff": "promoted,alias=People,multi,inverse=employer",
            **PROJECT_REL,
            **TOPICS,
        },
        "labels": {"extTemplate": "organization", "template": "", "noteType": "organization", "noteGroup": "organization"},
    },
    {
        "title": "Project Hub",
        "marker": "projectHub",
        "content": (
            "<h2>Status</h2><p></p>"
            "<h2>Next Step</h2><p></p>"
            "<h2>Decisions &amp; notes</h2><p></p>"
        ),
        "definitions": {
            "label:kind": "promoted,alias=Kind,single,text",
            **STATUS,
            **NEXT_ACTION,
            **CLIENT,
            **ON_BEHALF,
            "label:startDate": "promoted,alias=Started,single,date",
            **WRITER,
            **CURRENT_ROUND,
            **RELATED_HUBS,
            **TOPICS,
        },
        "labels": {"extTemplate": "projectHub", "template": "", "noteType": "projectHub", "noteGroup": "project"},
    },
    {
        "title": "Topic",
        "marker": "topic",
        "content": (
            "<h2>About this topic</h2><p></p>"
            "<h2>Notes</h2><p>Notes related to this topic appear in the backlinks panel.</p>"
        ),
        "definitions": {**TOPIC_ALIAS},
        "labels": {"extTemplate": "topic", "template": "", "noteType": "topic", "extTopic": "", "noteGroup": "topic"},
    },
]

TEMPLATES = [(t["title"], t["marker"], f"{t['title']} template", t["labels"]) for t in TEMPLATES_DETAILED]


def ensure_containers(api: Etapi) -> int:
    created = 0
    for marker, title, parent_marker, note_type, labels in CONTAINERS:
        existing = api.find_by_label(marker)
        if existing:
            continue
        parent_id = "root"
        if parent_marker != "root":
            if parent_marker.startswith("_"):
                parent_id = parent_marker
            else:
                parent_note = api.find_by_label(parent_marker)
                if parent_note:
                    parent_id = parent_note
        note_id = api.create_note(
            parent_note_id=parent_id,
            title=title,
            content=f"<p>{title} container managed by Ikmal Tools.</p>",
            note_type=note_type or "book",
        )
        api.set_label(note_id, marker)
        for k, v in labels.items():
            inheritable = k in ("projectArea", "projectArchive")
            api.set_label(note_id, k, v, inheritable=inheritable)
        created += 1

    proj_root = api.find_by_label("projectRoot")
    if proj_root:
        proj_defs = {
            "label:currentRound": "promoted,alias=Latest round,single,number",
            "label:status": "promoted,alias=Status,single,text",
            "label:nextAction": "promoted,alias=Next action,single,text",
        }
        for name, val in proj_defs.items():
            api.set_label(proj_root, name, val)
        api.set_label(proj_root, "viewType", "table")
def ensure_templates(api: Etapi) -> int:
    templates_root = api.find_by_label("templateRoot")
    if not templates_root:
        return 0
    created = 0
    for tpl in TEMPLATES_DETAILED:
        existing = None
        for child_id in api.get_note(templates_root).get("childNoteIds", []):
            for attr in api.get_note(child_id).get("attributes", []):
                if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == tpl["marker"]:
                    existing = child_id
                    break

        if not existing:
            existing = api.create_note(
                parent_note_id=templates_root,
                title=tpl["title"],
                content=tpl["content"],
                note_type="text",
            )
            created += 1
        else:
            note = api.get_note(existing)
            if note["title"] != tpl["title"]:
                api.set_title(existing, tpl["title"])
            if not api.get_content(existing):
                api.set_content(existing, tpl["content"])

        for name, val in tpl["definitions"].items():
            api.set_label(existing, name, val, inheritable=False)

        for pos, name in zip(range(30, 30 + 10 * len(tpl["definitions"]), 10), tpl["definitions"]):
            attr = next(
                (a for a in api.get_note(existing).get("attributes", [])
                 if a.get("noteId") == existing and a.get("name") == name),
                None,
            )
            if attr is not None and attr.get("position") != pos:
                try:
                    api.set_attribute_position(attr["attributeId"], pos)
                except Exception:
                    pass

        for k, v in tpl["labels"].items():
            api.set_label(existing, k, v, inheritable=False)
    return created


def reattach_existing_templates(api: Etapi) -> int:
    """Reconnect preserved extension notes to freshly installed templates."""
    templates_root = api.find_by_label("templateRoot")
    if not templates_root:
        return 0
    template_ids = {}
    for tpl in TEMPLATES_DETAILED:
        existing = None
        for child_id in api.get_note(templates_root).get("childNoteIds", []):
            for attr in api.get_note(child_id).get("attributes", []):
                if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == tpl["marker"]:
                    existing = child_id
                    break
        if existing:
            template_ids[tpl["marker"]] = existing

    roots = [
        api.find_by_label(marker)
        for marker in (
            "projectRoot", "meetingRoot", "taskRoot", "storyDraftRoot",
            "emailRoot", "peopleRoot", "orgRoot", "topicRoot",
        )
    ]
    reattached = 0
    for root_id in roots:
        if not root_id:
            continue
        for note_id in _descendants(api, root_id):
            try:
                note = api.get_note(note_id)
            except Exception:
                continue
            marker = next(
                (
                    attribute.get("value") for attribute in note.get("attributes", [])
                    if attribute.get("noteId") == note_id
                    and attribute.get("name") == "noteType"
                    and attribute.get("value") in template_ids
                ),
                None,
            )
            template_id = template_ids.get(marker)
            if not template_id:
                continue
            has_current_template = any(
                attribute.get("type") == "relation"
                and attribute.get("name") == "template"
                and attribute.get("value") == template_id
                for attribute in note.get("attributes", [])
            )
            if has_current_template:
                continue
            api.set_relation(note_id, "template", template_id)
            reattached += 1
    return reattached


def ensure_date_template_wiring(api: Etapi) -> bool:
    journal = api.find_by_label("calendarRoot")
    templates_root = api.find_by_label("templateRoot")
    if not journal or not templates_root:
        return False
    daily_template = None
    for child_id in api.get_note(templates_root).get("childNoteIds", []):
        for attr in api.get_note(child_id).get("attributes", []):
            if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == "daily":
                daily_template = child_id
                break
    if not daily_template:
        return False

    has_date_tpl = any(
        a.get("type") == "relation" and a.get("name") == "dateTemplate" and a.get("value") == daily_template
        for a in api.get_note(journal).get("attributes", [])
    )
    if not has_date_tpl:
        api.set_relation(journal, "dateTemplate", daily_template)
        return True
    return False


def ensure_saved_searches(api: Etapi) -> int:
    dashboards_root = api.find_by_label("dashboardRoot")
    if not dashboards_root:
        return 0
    created = 0
    for title, marker, search_str, labels in SAVED_SEARCHES:
        existing = None
        for child_id in api.get_note(dashboards_root).get("childNoteIds", []):
            for attr in api.get_note(child_id).get("attributes", []):
                if attr.get("noteId") == child_id and attr.get("name") == "extView" and attr.get("value") == marker:
                    existing = child_id
                    break
        if not existing:
            existing = api.create_note(
                parent_note_id=dashboards_root,
                title=title,
                note_type="search",
            )
            api.set_label(existing, "extView", marker)
            created += 1
        api.set_label(existing, "searchString", search_str)
        api.set_label(existing, "extBaseSearch", search_str)
        for k, v in labels.items():
            api.set_label(existing, k, v)
    return created


DEFAULT_DASHBOARD_LAYOUT = {
    "taskCalendar": {"x": 0, "y": 0, "w": 6, "h": 6},
    "meetingCalendar": {"x": 6, "y": 0, "w": 6, "h": 6},
    "dueSoon": {"x": 0, "y": 6, "w": 4, "h": 4},
    "openTasks": {"x": 4, "y": 6, "w": 4, "h": 5},
    "upcomingMeetings": {"x": 8, "y": 6, "w": 4, "h": 5},
    "openDrafts": {"x": 0, "y": 11, "w": 4, "h": 5},
    "openEmails": {"x": 4, "y": 11, "w": 4, "h": 5},
    "awaitingReplies": {"x": 8, "y": 11, "w": 4, "h": 5},
    "followUpsDue": {"x": 0, "y": 16, "w": 4, "h": 5},
    "activeProjects": {"x": 4, "y": 16, "w": 4, "h": 5},
    "highPriority": {"x": 8, "y": 16, "w": 4, "h": 5},
    "overdue": {"x": 0, "y": 21, "w": 4, "h": 5},
    "recentlyTouched": {"x": 4, "y": 21, "w": 8, "h": 5},
}


def ensure_dashboard_layout(api: Etapi) -> bool:
    """Create or update the native viewConfig attachment 'dashboard.json' on dashboardRoot."""
    dashboard_id = api.find_by_label("dashboardRoot")
    if not dashboard_id:
        return False

    try:
        attachments = api.get_attachments(dashboard_id)
    except EtapiError:
        attachments = []

    attachment = next(
        (a for a in attachments if a.get("role") == "viewConfig" and a.get("title") == "dashboard.json"),
        None,
    )

    saved_search_map = {}
    try:
        dashboard_note = api.get_note(dashboard_id)
    except EtapiError:
        return False

    for child_id in dashboard_note.get("childNoteIds", []):
        try:
            child = api.get_note(child_id)
        except EtapiError:
            continue
        for attr in child.get("attributes", []):
            if attr.get("noteId") == child_id and attr.get("name") == "extView":
                saved_search_map[attr.get("value")] = child_id

    widgets = {}
    for marker, geom in DEFAULT_DASHBOARD_LAYOUT.items():
        if marker in saved_search_map:
            widgets[saved_search_map[marker]] = geom

    filter_id = next(
        (
            child_id for child_id in dashboard_note.get("childNoteIds", [])
            if any(a.get("noteId") == child_id and a.get("name") == "extDashboardFilters" for a in (api.get_note(child_id).get("attributes", []) if child_id else []))
        ),
        None,
    )
    if filter_id and filter_id not in widgets:
        bottom = max((g["y"] + g["h"] for g in widgets.values() if isinstance(g, dict)), default=0)
        widgets[filter_id] = {"x": 0, "y": bottom, "w": 12, "h": 3}

    layout = {"widgets": widgets}
    layout_json = json.dumps(layout, separators=(",", ":"))

    if not attachment:
        api.create_attachment(
            note_id=dashboard_id,
            title="dashboard.json",
            content=layout_json,
            role="viewConfig",
            mime="application/json",
        )
        return True
    else:
        try:
            existing_layout = json.loads(api.get_attachment_content(attachment["attachmentId"]))
        except Exception:
            existing_layout = {}
        existing_widgets = existing_layout.get("widgets", {})
        if not isinstance(existing_widgets, dict):
            existing_widgets = {}
        updated = False
        for note_id, geom in widgets.items():
            if note_id not in existing_widgets:
                existing_widgets[note_id] = geom
                updated = True
        if updated:
            existing_layout["widgets"] = existing_widgets
            api.set_attachment_content(
                attachment["attachmentId"],
                json.dumps(existing_layout, separators=(",", ":")),
            )
            return True
    return False


def ensure_event_hooks(api: Etapi) -> int:
    """Wire backend sync and repair event relations onto container roots."""
    wired = 0

    # Project metadata sync
    proj_sync = api.search('#packageArtifact="notes-system-project-metadata-sync"')
    if not proj_sync:
        proj_sync = api.search('#extScript="projectMetadataSync"')
    if proj_sync:
        script_id = proj_sync[0]["noteId"]
        project_root = api.find_by_label("projectRoot")
        if project_root:
            note = api.get_note(project_root)
            for rel in ("runOnNoteCreation", "runOnNoteChange", "runOnAttributeChange", "runOnAttributeCreation"):
                for attr in note.get("attributes", []):
                    if (
                        attr.get("noteId") == project_root
                        and attr.get("type") == "relation"
                        and attr.get("name") == rel
                        and attr.get("value") != script_id
                    ):
                        try:
                            api.delete_attribute(attr["attributeId"])
                        except Exception:
                            pass
                if not any(
                    a.get("noteId") == project_root
                    and a.get("type") == "relation"
                    and a.get("name") == rel
                    and a.get("value") == script_id
                    for a in api.get_note(project_root).get("attributes", [])
                ):
                    api.set_relation(project_root, rel, script_id, inheritable=True)
                    wired += 1

    # Daily note repair
    daily_repair = api.search('#packageArtifact="notes-system-daily-note-repair"')
    if not daily_repair:
        daily_repair = api.search('#extScript="dailyNoteRepair"')
    if daily_repair:
        script_id = daily_repair[0]["noteId"]
        calendar_root = api.find_by_label("calendarRoot")
        if calendar_root:
            note = api.get_note(calendar_root)
            for rel in ("runOnNoteCreation", "runOnNoteChange"):
                for attr in note.get("attributes", []):
                    if (
                        attr.get("noteId") == calendar_root
                        and attr.get("type") == "relation"
                        and attr.get("name") == rel
                        and attr.get("value") != script_id
                    ):
                        try:
                            api.delete_attribute(attr["attributeId"])
                        except Exception:
                            pass
                if not any(
                    a.get("noteId") == calendar_root
                    and a.get("type") == "relation"
                    and a.get("name") == rel
                    and a.get("value") == script_id
                    for a in api.get_note(calendar_root).get("attributes", [])
                ):
                    api.set_relation(calendar_root, rel, script_id, inheritable=True)
                    wired += 1

    # Topic association sync
    topic_sync = api.search('#packageArtifact="notes-system-topic-association-sync"')
    if not topic_sync:
        topic_sync = api.search('#extScript="topicAssociationSync"')
    if topic_sync:
        script_id = topic_sync[0]["noteId"]
        work_roots = (
            "meetingRoot", "taskRoot", "storyDraftRoot", "emailRoot",
            "unassignedRoot", "peopleRoot", "orgRoot", "topicRoot",
        )
        for marker in work_roots:
            root_id = api.find_by_label(marker)
            if not root_id:
                continue
            note = api.get_note(root_id)
            for rel in ("runOnAttributeCreation", "runOnAttributeChange", "runOnNoteCreation", "runOnNoteChange"):
                for attr in note.get("attributes", []):
                    if (
                        attr.get("noteId") == root_id
                        and attr.get("type") == "relation"
                        and attr.get("name") == rel
                        and attr.get("value") != script_id
                    ):
                        try:
                            api.delete_attribute(attr["attributeId"])
                        except Exception:
                            pass
                if not any(
                    a.get("noteId") == root_id
                    and a.get("type") == "relation"
                    and a.get("name") == rel
                    and a.get("value") == script_id
                    for a in api.get_note(root_id).get("attributes", [])
                ):
                    api.set_relation(root_id, rel, script_id, inheritable=True)
                    wired += 1

    return wired


def migrate_project_hubs_to_areas(api: Etapi) -> int:
    """Move legacy direct-child hubs under projectRoot into Active or Archive."""
    project_root = api.find_by_label("projectRoot")
    active_root = api.find_by_label("activeProjectRoot")
    archive_root = api.find_by_label("archiveProjectRoot")
    if not project_root or not active_root or not archive_root:
        return 0

    moved = 0
    for note_id in list(api.get_note(project_root).get("childNoteIds", [])):
        if note_id in (active_root, archive_root, api.find_by_label("unassignedRoot")):
            continue
        try:
            note = api.get_note(note_id)
        except EtapiError:
            continue
        is_hub = any(
            a.get("noteId") == note_id and a.get("name") in ("noteType", "extTemplate") and a.get("value") == "projectHub"
            for a in note.get("attributes", [])
        )
        if not is_hub:
            continue

        status = next(
            (a.get("value") for a in note.get("attributes", []) if a.get("noteId") == note_id and a.get("name") == "status"),
            "active",
        )
        archived = any(
            a.get("noteId") == note_id and a.get("name") == "archived" and a.get("value", "") != "false"
            for a in note.get("attributes", [])
        )
        destination = archive_root if archived or status == "complete" else active_root
        api.move_note(note_id, destination)
        moved += 1
    return moved


def reconcile_project_hub_statuses(api: Etapi) -> int:
    """Align hub status with the latest edit-round state after an upgrade/repair."""
    project_root = api.find_by_label("projectRoot")
    if not project_root:
        return 0

    updated = 0
    for hub_id in _descendants(api, project_root):
        if hub_id == project_root:
            continue
        try:
            hub = api.get_note(hub_id)
        except EtapiError:
            continue
        if not any(
            a.get("noteId") == hub_id and a.get("name") in ("noteType", "extTemplate") and a.get("value") == "projectHub"
            for a in hub.get("attributes", [])
        ):
            continue

        rounds = []
        for child_id in hub.get("childNoteIds", []):
            try:
                child = api.get_note(child_id)
            except EtapiError:
                continue
            if not any(
                a.get("name") in ("noteType", "extTemplate", "extStoryDraft") and a.get("value") in ("storyDraft", "story", "edit", "")
                for a in child.get("attributes", [])
            ):
                continue
            round_val = next((a.get("value") for a in child.get("attributes", []) if a.get("name") == "round"), None)
            try:
                round_num = int(round_val)
            except (TypeError, ValueError):
                continue
            rounds.append((round_num, child))

        if not rounds:
            continue
        latest = max(rounds, key=lambda item: item[0])[1]
        latest_status = next((a.get("value") for a in latest.get("attributes", []) if a.get("name") == "status"), None)
        expected = "complete" if latest_status in ("done", "approved", "published") else "active"
        current = next((a.get("value") for a in hub.get("attributes", []) if a.get("noteId") == hub_id and a.get("name") == "status"), None)
        if current != expected:
            api.set_label(hub_id, "status", expected)
            updated += 1
    return updated


def ensure_project_hub_icons(api: Etapi) -> int:
    """Make Project and Edit hubs visually distinct in the tree."""
    project_root = api.find_by_label("projectRoot")
    if not project_root:
        return 0

    updated = 0
    for note_id in _descendants(api, project_root):
        if note_id == project_root:
            continue
        try:
            note = api.get_note(note_id)
        except EtapiError:
            continue
        if not any(
            a.get("name") in ("noteType", "extTemplate") and a.get("value") == "projectHub"
            for a in note.get("attributes", [])
        ):
            continue
        kind = next((a.get("value") for a in note.get("attributes", []) if a.get("name") == "kind" and a.get("value") in ("project", "edit")), "project")
        expected_icon = "bx bx-edit-alt" if kind == "edit" else "bx bx-book"
        owned_icon = next((a for a in note.get("attributes", []) if a.get("noteId") == note_id and a.get("name") == "iconClass"), None)
        if not owned_icon or owned_icon.get("value") != expected_icon:
            api.set_label(note_id, "iconClass", expected_icon)
            updated += 1
        api.set_label(note_id, "extHubIcon", kind)
    return updated


def ensure_project_hub_dashboards(api: Etapi) -> int:
    """Ensure every existing Project Hub has one render-note Project Dashboard."""
    project_root = api.find_by_label("projectRoot")
    if not project_root:
        return 0

    dashboard_code = None
    dash_search = api.search('#packageArtifact="notes-system-project-dashboard"')
    if not dash_search:
        dash_search = api.search('#extScript="hubDashboardMarkup"')
    if dash_search:
        dashboard_code = dash_search[0]["noteId"]
    if not dashboard_code:
        return 0

    created = 0
    for hub_id in _descendants(api, project_root):
        if hub_id == project_root:
            continue
        try:
            hub = api.get_note(hub_id)
        except EtapiError:
            continue
        is_hub = any(
            a.get("noteId") == hub_id and a.get("name") in ("noteType", "extTemplate") and a.get("value") == "projectHub"
            for a in hub.get("attributes", [])
        )
        if not is_hub:
            continue

        existing_dashboard = None
        for child_id in hub.get("childNoteIds", []):
            try:
                child = api.get_note(child_id)
            except EtapiError:
                continue
            if any(a.get("noteId") == child_id and a.get("name") in ("extHubDashboard", "extProjectDashboard") for a in child.get("attributes", [])):
                existing_dashboard = child_id
                break
        if existing_dashboard:
            api.set_title(existing_dashboard, f"Dashboard: {hub.get('title', 'Project')}")
            continue

        dash_id = api.create_note(
            parent_note_id=hub_id,
            title=f"Dashboard: {hub.get('title', 'Project')}",
            note_type="render",
        )
        api.set_relation(dash_id, "renderNote", dashboard_code)
        api.set_label(dash_id, "extHubDashboard", "projectHub")
        created += 1
    return created


def remove_retired_daily_sections(api: Etapi) -> int:
    """Remove retired Open Tasks and Day start sections from daily notes."""
    # A missing #templateRoot only costs us the daily-template pass. The journal
    # sweep below is keyed off #calendarRoot and must still run.
    templates_root = api.find_by_label("templateRoot")

    daily_id = None
    if templates_root:
        for child_id in api.get_note(templates_root).get("childNoteIds", []):
            for attr in api.get_note(child_id).get("attributes", []):
                if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == "daily":
                    daily_id = child_id
                    break

    def clean(content: str) -> str:
        content = re.sub(
            r"<h2>Open Tasks</h2>\s*<section\b[^>]*data-extension-open-tasks=['\"]true['\"][\s\S]*?</section>",
            "",
            content,
            flags=re.IGNORECASE,
        )
        # Only drop the retired heading when its section is provably empty --
        # nothing but blank paragraphs before the next heading or the end of
        # the note. Removing it unconditionally would orphan anything a user
        # had written under "Day start" into the preceding section.
        return re.sub(
            r"<h2>Day start</h2>\s*(?:<p>(?:\s|&nbsp;|<br\s*/?>)*</p>\s*)*(?=<h[1-6]\b|</div>\s*\Z|\Z)",
            "",
            content,
            flags=re.IGNORECASE,
        )

    updated = 0
    if daily_id:
        content = api.get_content(daily_id)
        cleaned = clean(content)
        if cleaned != content:
            api.set_content(daily_id, cleaned)
            updated += 1

    journal_id = api.find_by_label("calendarRoot")
    if journal_id:
        for result in api.search("#dateNote", ancestor_note_id=journal_id, include_archived=True):
            note_id = result["noteId"]
            content = api.get_content(note_id)
            cleaned = clean(content)
            if cleaned != content:
                api.set_content(note_id, cleaned)
                updated += 1
    return updated


def migrate_legacy_entity_labels(api: Etapi) -> tuple[int, int]:
    """Convert legacy text entity fields to Organization relations where an Organization exists."""
    org_root = api.find_by_label("orgRoot")
    working_roots = [api.find_by_label(m) for m in ("projectRoot", "storyDraftRoot", "emailRoot") if api.find_by_label(m)]
    if not org_root or not working_roots:
        return 0, 0

    working_ids = {nid for r in working_roots for nid in _descendants(api, r)}
    organizations = {}
    for nid in _descendants(api, org_root):
        if nid == org_root:
            continue
        try:
            n = api.get_note(nid)
            organizations[n["title"].strip().casefold()] = nid
        except EtapiError:
            pass

    converted = 0
    overridden = 0
    for nid in working_ids:
        try:
            note = api.get_note(nid)
        except EtapiError:
            continue
        for legacy_name, (rel_name, override_name) in [
            ("client", ("client", "clientOverride")),
            ("companyOnBehalf", ("companyOnBehalf", "companyOnBehalfOverride")),
        ]:
            legacy = next(
                (a for a in note.get("attributes", []) if a.get("noteId") == nid and a.get("name") == legacy_name),
                None,
            )
            if legacy is None:
                continue
            val = (legacy.get("value") or "").strip()
            if not val:
                try:
                    api.delete_attribute(legacy["attributeId"])
                except Exception:
                    pass
                continue
            has_rel = any(a.get("noteId") == nid and a.get("type") == "relation" and a.get("name") == rel_name for a in note.get("attributes", []))
            if not has_rel:
                target_id = organizations.get(val.casefold())
                if target_id:
                    api.set_relation(nid, rel_name, target_id)
                    converted += 1
                else:
                    api.set_label(nid, override_name, val)
                    overridden += 1
            try:
                api.delete_attribute(legacy["attributeId"])
            except Exception:
                pass
    return converted, overridden


def ensure_project_reporting_notes(api: Etapi) -> int:
    """Add the Reporting Notes companion to older project hubs."""
    project_root = api.find_by_label("projectRoot")
    templates_root = api.find_by_label("templateRoot")
    if not project_root or not templates_root:
        return 0

    reporting_template = None
    for child_id in api.get_note(templates_root).get("childNoteIds", []):
        for attr in api.get_note(child_id).get("attributes", []):
            if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == "reportingNotes":
                reporting_template = child_id
                break

    if not reporting_template:
        return 0

    created = 0
    for hub_id in _descendants(api, project_root):
        if hub_id == project_root:
            continue
        try:
            hub = api.get_note(hub_id)
        except EtapiError:
            continue
        is_hub = any(
            a.get("noteId") == hub_id and a.get("name") in ("noteType", "extTemplate") and a.get("value") == "projectHub"
            for a in hub.get("attributes", [])
        )
        kind = next((a.get("value") for a in hub.get("attributes", []) if a.get("noteId") == hub_id and a.get("name") == "kind"), "project")
        if not is_hub or kind != "project":
            continue

        existing_note_id = next(
            (
                child_id for child_id in hub.get("childNoteIds", [])
                if any(a.get("noteId") == child_id and a.get("name") in ("noteType", "extReportingNotes") for a in api.get_note(child_id).get("attributes", []))
            ),
            None,
        )
        expected_title = f"{hub.get('title', 'Project')} — Reporting Notes"
        if existing_note_id:
            existing_note = api.get_note(existing_note_id)
            if existing_note.get("title") == "Reporting Notes":
                api.set_title(existing_note_id, expected_title)
            if existing_note.get("title") == expected_title:
                api.set_label(existing_note_id, "extReportingTitleManaged")
            continue

        reporting_content = (
            "<h2>LINKS</h2><ul><li></li></ul>"
            "<h2>OPEN QUESTIONS</h2><ul><li></li></ul>"
            "<h2>IDEA / ANGLE</h2><p></p>"
            "<h2>REPORTING NOTES</h2><p></p>"
            "<div class='reporting-note-actions-placeholder' data-reporting-note-actions='true'></div>"
        )
        note_id = api.create_note(
            parent_note_id=hub_id,
            title=expected_title,
            content=reporting_content,
        )
        api.set_relation(note_id, "template", reporting_template)
        api.set_relation(note_id, "project", hub_id)
        api.set_label(note_id, "noteType", "reportingNotes")
        api.set_label(note_id, "noteGroup", "reporting")
        api.set_label(note_id, "extReportingNotes")
        api.set_label(note_id, "extReportingTitleManaged")
        created += 1
    return created


def restore_today_branches(api: Etapi, target_date: str | None = None) -> int:
    """Repair extension items which lost their Journal branch when a day was deleted."""
    journal_id = api.find_by_label("calendarRoot")
    if not journal_id:
        return 0
    today = target_date or date.today().isoformat()
    day_id = None
    for result in api.search("#dateNote", ancestor_note_id=journal_id, include_archived=True):
        note = api.get_note(result["noteId"])
        if any(
            a.get("noteId") == result["noteId"] and a.get("type") == "label" and a.get("name") == "dateNote" and a.get("value") == today
            for a in note.get("attributes", [])
        ):
            day_id = result["noteId"]
            break
    if not day_id:
        return 0

    candidates = {}
    for query in ("#extTask", "#extMeeting", "#extStoryDraft", "#extReportingNotes", "#extEmailDraft", "#extScratch", '#noteGroup="people"', '#noteGroup="organization"'):
        for result in api.search(query):
            candidates[result["noteId"]] = result

    restored = 0
    for note_id, result in candidates.items():
        if str(result.get("dateCreated", ""))[:10] != today:
            continue
        if api.ensure_note_is_present_in_parent(note_id, day_id):
            restored += 1
    return restored


def repair_existing_day_note_templates(api: Etapi) -> int:
    """Attach the daily template to pre-existing calendar notes when missing."""
    journal_id = api.find_by_label("calendarRoot")
    templates_root = api.find_by_label("templateRoot")
    if not journal_id or not templates_root:
        return 0

    daily_template_id = None
    for child_id in api.get_note(templates_root).get("childNoteIds", []):
        for attr in api.get_note(child_id).get("attributes", []):
            if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == "daily":
                daily_template_id = child_id
                break

    if not daily_template_id:
        return 0

    repaired = 0
    for result in api.search("#dateNote", ancestor_note_id=journal_id, include_archived=True):
        note_id = result["noteId"]
        owned_template = any(
            attribute.get("noteId") == note_id
            and attribute.get("type") == "relation"
            and attribute.get("name") == "template"
            for attribute in api.get_note(note_id).get("attributes", [])
        )
        if owned_template:
            continue
        api.set_relation(note_id, "template", daily_template_id)
        repaired += 1
    return repaired


def run_full_reconciliation_and_repairs(api: Etapi) -> list[str]:
    results = []
    moved = migrate_project_hubs_to_areas(api)
    if moved:
        results.append(f"migrated {moved} Project Hub(s) into Active/Archive")

    icons = ensure_project_hub_icons(api)
    if icons:
        results.append(f"updated {icons} Project Hub icon(s)")

    statuses = reconcile_project_hub_statuses(api)
    if statuses:
        results.append(f"reconciled {statuses} Project Hub status(es)")

    reporting = ensure_project_reporting_notes(api)
    if reporting:
        results.append(f"created {reporting} missing Reporting Notes companion(s)")

    dashboards = ensure_project_hub_dashboards(api)
    if dashboards:
        results.append(f"created {dashboards} missing Project Hub Dashboard(s)")

    retired_sections = remove_retired_daily_sections(api)
    if retired_sections:
        results.append(f"removed retired daily-note sections from {retired_sections} note(s)")

    converted, overridden = migrate_legacy_entity_labels(api)
    if converted or overridden:
        results.append(f"migrated {converted} entity relation(s), {overridden} text override(s)")

    branches = restore_today_branches(api)
    if branches:
        results.append(f"repaired {branches} daily note branch(es)")

    repaired_tpls = repair_existing_day_note_templates(api)
    if repaired_tpls:
        results.append(f"repaired {repaired_tpls} existing day note template relation(s)")

    reattached = reattach_existing_templates(api)
    if reattached:
        results.append(f"reattached {reattached} preserved note template relation(s)")

    if ensure_dashboard_layout(api):
        results.append("attached/updated native dashboard.json viewConfig layout geometry")

    hooks_wired = ensure_event_hooks(api)
    if hooks_wired:
        results.append(f"wired {hooks_wired} backend event hook relation(s)")

    return results


def verify(api: Etapi) -> list[str]:
    """Run structural health checks on Trilium instance."""
    problems = []

    for marker, title, _, _, _ in CONTAINERS:
        if api.find_by_label(marker) is None:
            problems.append(f"missing container #{marker} ({title})")

    templates_root = api.find_by_label("templateRoot")
    if not templates_root:
        problems.append("missing #templateRoot")
    else:
        for title, marker, _, _ in TEMPLATES:
            found = False
            for child_id in api.get_note(templates_root).get("childNoteIds", []):
                for attr in api.get_note(child_id).get("attributes", []):
                    if attr.get("noteId") == child_id and attr.get("name") == "extTemplate" and attr.get("value") == marker:
                        found = True
                        break
            if not found:
                problems.append(f"missing template #{marker} ({title})")

    journal = api.find_by_label("calendarRoot")
    if journal:
        relations = [
            a for a in api.get_note(journal).get("attributes", [])
            if a.get("type") == "relation" and a.get("name") == "dateTemplate"
        ]
        if not relations:
            problems.append("journal has no ~dateTemplate — day notes will be un-templated")

    config = api.find_by_label("extConfig")
    if config:
        installed = next(
            (
                a.get("value")
                for a in api.get_note(config).get("attributes", [])
                if a.get("name") == "extensionVersion"
            ),
            None,
        )
        if installed != VERSION:
            problems.append(f"extension version is {installed or 'unset'} (expected {VERSION})")

    for title, marker, search_str, _ in SAVED_SEARCHES:
        try:
            api.search(search_str)
        except EtapiError as err:
            problems.append(f"saved search for #{marker} ('{title}') is invalid: {err}")

    return problems


def record_migration_log(api: Etapi, action: str, details: str) -> None:
    config = api.find_by_label("extConfig")
    if not config:
        return
    log_note = api.find_by_label("extMigrationLog")
    entry = f"<p><strong>[{action.upper()}]</strong>: {details}</p>"
    if not log_note:
        log_note = api.create_note(
            parent_note_id=config,
            title="Migration Log",
            content=f"<h2>Ikmal System Migration Audit Trail</h2>{entry}",
            note_type="text",
        )
        api.set_label(log_note, "extMigrationLog")
    else:
        current = api.get_content(log_note)
        api.set_content(log_note, f"{current}\n{entry}")


def cmd_verify(api: Etapi) -> int:
    print(f"Checking Ikmal Tools v{VERSION} health...")
    problems = verify(api)
    if problems:
        for p in problems:
            print(f"  ❌ FAIL: {p}", file=sys.stderr)
        return 1
    print("  ✓ All 100% structural verification checks passed.")
    return 0


def cmd_install(api: Etapi) -> int:
    print(f"Installing Ikmal Tools v{VERSION}...")
    created = ensure_containers(api)
    print(f"  ✓ Containers verified ({created} created).")
    tpl_created = ensure_templates(api)
    print(f"  ✓ Note templates verified ({tpl_created} created).")
    wired = ensure_date_template_wiring(api)
    if wired:
        print("  ✓ Wired ~dateTemplate on Journal.")
    searches_created = ensure_saved_searches(api)
    print(f"  ✓ Saved searches verified ({searches_created} created).")

    repair_summary = run_full_reconciliation_and_repairs(api)
    for line in repair_summary:
        print(f"  ✓ {line}")

    try:
        deployer.deploy(url=api.url, token=api.token)
        print("  ✓ Package artifacts & backend event hooks deployed successfully.")
    except Exception as err:
        print(f"  ❌ Deployment failed: {err}", file=sys.stderr)
        return 1

    problems = verify(api)
    if problems:
        for p in problems:
            print(f"  ⚠️ Warning: {p}")

    record_migration_log(api, "install", f"Installed v{VERSION} successfully with {len(repair_summary)} repair/migration step(s).")
    print("\nInstallation complete. Reload Trilium browser window.")
    return 0


def cmd_repair(api: Etapi) -> int:
    print(f"Repairing Ikmal Tools v{VERSION}...")
    created = ensure_containers(api)
    print(f"  ✓ Containers checked ({created} created).")
    tpl_created = ensure_templates(api)
    print(f"  ✓ Templates checked ({tpl_created} created).")
    ensure_date_template_wiring(api)
    searches_created = ensure_saved_searches(api)
    print(f"  ✓ Saved searches checked ({searches_created} created).")

    repair_summary = run_full_reconciliation_and_repairs(api)
    for line in repair_summary:
        print(f"  ✓ {line}")

    try:
        deployer.deploy(url=api.url, token=api.token)
        print("  ✓ Package artifacts & backend event hooks redeployed.")
    except Exception as err:
        print(f"  ❌ Artifact repair failed: {err}", file=sys.stderr)
        return 1

    problems = verify(api)
    if problems:
        for p in problems:
            print(f"  ❌ FAIL: {p}", file=sys.stderr)
        return 1

    record_migration_log(api, "repair", f"Repaired v{VERSION} successfully with {len(repair_summary)} repair/migration step(s).")
    print("  ✓ All structural repair checks passed.")
    return 0


def cmd_uninstall(api: Etapi) -> int:
    print(f"Uninstalling Ikmal Tools v{VERSION}...")
    manifest_notes = api.search('#packageOwner="iansherr/ikmal_tools_trilium"')
    count = 0
    for note in manifest_notes:
        try:
            api.delete_attribute_by_name(note["noteId"], "packageEnabled")
            api.set_label(note["noteId"], "archived", "")
            count += 1
        except Exception:
            pass
    print(f"  ✓ Archived {count} package note artifacts.")
    record_migration_log(api, "uninstall", f"Uninstalled v{VERSION}.")
    print("Uninstallation complete.")
def cmd_export(api: Etapi) -> int:
    try:
        import export_package as exporter
    except ImportError:
        import tools.export_package as exporter
    print(f"Exporting Ikmal Tools v{VERSION} package zips...")
    return exporter.export_package(api)


def main() -> int:
    parser = argparse.ArgumentParser(description="Ikmal Tools CLI Maintenance Tool")
    parser.add_argument("command", choices=["install", "repair", "verify", "uninstall", "export"])
    parser.add_argument("--url", help="Trilium ETAPI URL (default: TRILIUM_URL env var)")
    parser.add_argument("--token", help="Trilium ETAPI Token (default: TRILIUM_TOKEN env var)")
    args = parser.parse_args()

    try:
        api = Etapi.from_env()
        if args.url:
            api.url = args.url.rstrip("/")
        if args.token:
            api.token = args.token
    except EtapiError as err:
        print(f"Error initializing ETAPI connection: {err}", file=sys.stderr)
        return 1

    if args.command == "verify":
        return cmd_verify(api)
    elif args.command == "install":
        return cmd_install(api)
    elif args.command == "repair":
        return cmd_repair(api)
    elif args.command == "uninstall":
        return cmd_uninstall(api)
    elif args.command == "export":
        return cmd_export(api)
    return 0


if __name__ == "__main__":
    sys.exit(main())
