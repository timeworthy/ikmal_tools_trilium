"""Archive old Community Packages artifacts without deleting user data.

This is the safe reset step before reinstalling substantially changed plugins.
Package notes remain recoverable in the hidden package tree, but all execution
labels are removed so old startup scripts, widgets, CSS, and handlers cannot
continue running alongside a new installation.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from etapi import Etapi  # noqa: E402


KNOWN_OWNERS = (
    "iansherr/ikmal_tools_trilium",
    "iansherr/ikmal_editor_trilium",
    "iansherr/trilium_diagnostics",
    "iansherr/languagetool",
    "iansherr/gmail-ingest",
    "iansherr/webserver",
    "iansherr/wordcount",
)
ACTIVATION_LABELS = {"run", "appCss", "widget", "customRequestHandler"}
COMMUNITY_PACKAGES_ROOT_ID = "M1qSmOJaJaSK"


def is_archived(note: dict) -> bool:
    note_id = note.get("noteId")
    return any(a.get("noteId") == note_id and a.get("name") == "archived"
               for a in note.get("attributes", []))


def package_artifact(note: dict) -> str | None:
    note_id = note.get("noteId")
    for attribute in note.get("attributes", []):
        if (attribute.get("noteId") == note_id
                and attribute.get("name") == "packageArtifact"):
            return attribute.get("value")
    return None


def remove_activation_labels(api: Etapi, note: dict) -> int:
    count = 0
    note_id = note.get("noteId")
    for attribute in note.get("attributes", []):
        if (attribute.get("noteId") == note_id
                and attribute.get("type") in {"label", "relation"}
                and attribute.get("name") in ACTIVATION_LABELS):
            api.delete_attribute(attribute["attributeId"])
            count += 1
    return count


def package_tree_notes(api: Etapi) -> list[dict]:
    """Walk the hidden package tree because normal search omits it."""
    notes: list[dict] = []
    pending = [COMMUNITY_PACKAGES_ROOT_ID]
    seen: set[str] = set()
    while pending:
        note_id = pending.pop()
        if note_id in seen:
            continue
        seen.add(note_id)
        note = api.get_note(note_id)
        notes.append(note)
        pending.extend(note.get("childNoteIds", []))
    return notes


def archive_owner(api: Etapi, owner: str) -> tuple[int, int]:
    notes = api.search(f'#packageOwner="{owner}"', include_archived=True)
    if not notes:
        notes = [note for note in package_tree_notes(api)
                 if any(a.get("noteId") == note.get("noteId")
                        and a.get("name") == "packageOwner"
                        and a.get("value") == owner
                        for a in note.get("attributes", []))]
    archived = 0
    labels_removed = 0
    for note in notes:
        if is_archived(note):
            continue
        artifact = package_artifact(note) or "unmarked"
        api.set_label(note["noteId"], "packageEnabled", "false")
        labels_removed += remove_activation_labels(api, note)
        api.set_label(note["noteId"], "archived", "")
        archived += 1
        print(f"  archived {owner}:{artifact} ({note['noteId']})")
    return archived, labels_removed


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: cleanup_plugin_artifacts.py URL TOKEN [OWNER ...]")
    api = Etapi(sys.argv[1], sys.argv[2])
    owners = tuple(sys.argv[3:]) or KNOWN_OWNERS
    total_notes = 0
    total_labels = 0
    for owner in owners:
        count, labels = archive_owner(api, owner)
        total_notes += count
        total_labels += labels
    print(f"Archived {total_notes} active package notes and removed {total_labels} activation labels.")


if __name__ == "__main__":
    main()
