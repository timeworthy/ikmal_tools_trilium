#!/usr/bin/env python3
"""Export the installed extension as importable Trilium zips.

Export is per-subtree, so this writes one zip per container into dist/. Import
each from Trilium's note context menu (Import into note).

    python3 tools/export_package.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from etapi import Etapi, EtapiError
except ImportError:
    from tools.etapi import Etapi, EtapiError

DIST = Path(__file__).resolve().parents[1] / "dist"
VERSION = "1.0.34"

PACKAGE_MARKERS = ("templateRoot", "dashboardRoot", "scriptRoot")

CONTAINERS = (
    ("calendarRoot", "Journal"),
    ("todayRoot", "Today"),
    ("projectRoot", "Projects"),
    ("activeProjectRoot", "Active"),
    ("archiveProjectRoot", "Archive"),
    ("unassignedRoot", "Unassigned"),
    ("taskRoot", "Tasks"),
    ("meetingRoot", "Meetings"),
    ("peopleRoot", "People"),
    ("orgRoot", "Organizations"),
    ("topicRoot", "Topics"),
    ("templateRoot", "Templates"),
    ("extConfig", "Config"),
    ("storyDraftRoot", "Drafts"),
    ("emailRoot", "Emails"),
    ("dashboardRoot", "Dashboards"),
)


def export_subtree(api: Etapi, note_id: str, destination: Path) -> int:
    """Download one subtree as a zip. Returns bytes written."""
    request = urllib.request.Request(
        f"{api.url}/etapi/notes/{note_id}/export?format=html",
        headers={"Authorization": api.token},
    )
    try:
        with urllib.request.urlopen(request) as response:
            payload = response.read()
    except urllib.error.HTTPError as error:
        raise EtapiError(f"export {note_id} -> {error.code}") from error

    destination.write_bytes(payload)
    return len(payload)


def export_package(api: Etapi) -> int:
    """Export subtrees and generate manifest.json."""
    DIST.mkdir(exist_ok=True)
    info = api.app_info()

    manifest = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "triliumVersion": info["appVersion"],
        "extensionVersion": VERSION,
        "subtrees": [],
        "requiredContainers": [
            {"title": title, "label": marker}
            for marker, title in CONTAINERS
            if marker not in PACKAGE_MARKERS
        ],
    }

    print(f"Trilium {info['appVersion']} -> {DIST}\n")
    for marker in PACKAGE_MARKERS:
        note_id = api.find_by_label(marker)
        if note_id is None:
            print(f"skipped   #{marker} (not installed)")
            continue

        title = api.get_note(note_id)["title"]
        filename = f"{title.lower().replace(' ', '-')}.zip"
        size = export_subtree(api, note_id, DIST / filename)
        manifest["subtrees"].append(
            {"marker": marker, "title": title, "file": filename}
        )
        print(f"exported  {title:15} {size:7}b  {filename}")

    (DIST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nWrote {len(manifest['subtrees'])} zips + manifest.json")
    return 0


def main() -> int:
    try:
        api = Etapi.from_env()
        return export_package(api)
    except EtapiError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
