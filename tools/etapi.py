"""Minimal ETAPI client for applying the extension to a Trilium instance.

Uses only the standard library so the tooling has no install step. This is the
Trilium counterpart to what ``obsidian_plugin/install.sh`` does for a vault:
everything here is idempotent, so re-running an apply converges rather than
duplicating.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEV_ENV = Path(__file__).resolve().parents[1] / "dev" / ".env"


class EtapiError(RuntimeError):
    """An ETAPI request failed."""


def load_dev_env() -> None:
    """Load ``dev/.env`` into os.environ if it exists.

    Real environment variables win, so CI or a different instance can override
    the local dev credentials without editing the file.
    """
    if not DEV_ENV.exists():
        return
    for line in DEV_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


class Etapi:
    """Thin wrapper over the Trilium ETAPI endpoints this project needs."""

    def __init__(self, url: str, token: str) -> None:
        self.url = url.rstrip("/")
        self.token = token

    @classmethod
    def from_env(cls) -> "Etapi":
        """Build a client from TRILIUM_URL / TRILIUM_TOKEN."""
        load_dev_env()
        url = os.environ.get("TRILIUM_URL")
        token = os.environ.get("TRILIUM_TOKEN")
        if not url or not token:
            raise EtapiError(
                "TRILIUM_URL and TRILIUM_TOKEN must be set "
                f"(looked for {DEV_ENV} and the environment)"
            )
        return cls(url, token)

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            f"{self.url}{path}",
            data=data,
            method=method,
            headers={
                "Authorization": self.token,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise EtapiError(f"{method} {path} -> {error.code}: {detail}") from error
        except urllib.error.URLError as error:
            raise EtapiError(f"{method} {path} -> unreachable: {error.reason}") from error
        return json.loads(raw) if raw else {}

    # ---- notes ----

    def app_info(self) -> dict:
        """Return instance metadata; the cheapest way to verify connectivity."""
        return self._request("GET", "/etapi/app-info")

    def search(
        self,
        query: str,
        include_archived: bool = False,
        ancestor_note_id: str | None = None,
    ) -> list[dict]:
        """Run a Trilium search query and return the matching notes."""
        params = {"search": query}
        if include_archived:
            params["includeArchivedNotes"] = "true"
        if ancestor_note_id is not None:
            params["ancestorNoteId"] = ancestor_note_id
        encoded = urllib.parse.urlencode(params)
        return self._request("GET", f"/etapi/notes?{encoded}").get("results", [])

    def get_note(self, note_id: str) -> dict:
        return self._request("GET", f"/etapi/notes/{note_id}")

    def get_branch(self, branch_id: str) -> dict:
        return self._request("GET", f"/etapi/branches/{branch_id}")

    def set_branch_position(self, branch_id: str, position: int) -> None:
        self._request("PATCH", f"/etapi/branches/{branch_id}", {"notePosition": position})

    def refresh_note_ordering(self, parent_note_id: str) -> None:
        self._request("POST", f"/etapi/refresh-note-ordering/{parent_note_id}")

    def create_note(
        self,
        parent_note_id: str,
        title: str,
        content: str = "",
        note_type: str = "text",
        mime: str | None = None,
    ) -> str:
        """Create a note and return its noteId."""
        body = {
            "parentNoteId": parent_note_id,
            "title": title,
            "type": note_type,
            "content": content,
        }
        if mime is not None:
            body["mime"] = mime
        created = self._request("POST", "/etapi/create-note", body)
        return created["note"]["noteId"]

    def get_content(self, note_id: str) -> str:
        """Return a note's raw content.

        Content is not JSON, so it bypasses the usual request helper.
        """
        request = urllib.request.Request(
            f"{self.url}/etapi/notes/{note_id}/content",
            headers={"Authorization": self.token},
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.read().decode()
        except urllib.error.HTTPError as error:
            raise EtapiError(f"GET content {note_id} -> {error.code}") from error

    def set_content(self, note_id: str, content: str) -> None:
        request = urllib.request.Request(
            f"{self.url}/etapi/notes/{note_id}/content",
            data=content.encode(),
            method="PUT",
            headers={
                "Authorization": self.token,
                "Content-Type": "text/plain",
            },
        )
        try:
            urllib.request.urlopen(request)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise EtapiError(f"PUT content {note_id} -> {error.code}: {detail}") from error

    def set_mime(self, note_id: str, mime: str) -> None:
        """Change a note's MIME without changing its title, type, or content."""
        self._request("PATCH", f"/etapi/notes/{note_id}", {"mime": mime})

    def get_attachments(self, note_id: str) -> list[dict]:
        return self._request("GET", f"/etapi/notes/{note_id}/attachments")

    def create_attachment(
        self,
        note_id: str,
        title: str,
        content: str,
        role: str = "viewConfig",
        mime: str = "application/json",
    ) -> str:
        attachment = self._request(
            "POST",
            "/etapi/attachments",
            {
                "ownerId": note_id,
                "role": role,
                "mime": mime,
                "title": title,
                "position": 0,
                "content": content,
            },
        )
        return attachment["attachmentId"]

    def get_attachment_content(self, attachment_id: str) -> str:
        request = urllib.request.Request(
            f"{self.url}/etapi/attachments/{attachment_id}/content",
            headers={"Authorization": self.token},
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.read().decode()
        except urllib.error.HTTPError as error:
            raise EtapiError(f"GET attachment {attachment_id} -> {error.code}") from error

    def set_attachment_content(self, attachment_id: str, content: str) -> None:
        request = urllib.request.Request(
            f"{self.url}/etapi/attachments/{attachment_id}/content",
            data=content.encode(),
            method="PUT",
            headers={
                "Authorization": self.token,
                "Content-Type": "text/plain",
            },
        )
        try:
            urllib.request.urlopen(request)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise EtapiError(
                f"PUT attachment {attachment_id} -> {error.code}: {detail}"
            ) from error

    def set_title(self, note_id: str, title: str) -> None:
        self._request("PATCH", f"/etapi/notes/{note_id}", {"title": title})

    def set_type(self, note_id: str, note_type: str) -> None:
        """Change a note's type, e.g. text -> book to render it as a collection."""
        self._request("PATCH", f"/etapi/notes/{note_id}", {"type": note_type})

    def delete_note(self, note_id: str) -> None:
        self._request("DELETE", f"/etapi/notes/{note_id}")

    def move_note(self, note_id: str, parent_note_id: str) -> None:
        """Move a note's root-tree branch under another parent.

        Trilium models placement as branches. Creating the new branch first
        keeps the note alive while the old branch is removed.
        """
        note = self.get_note(note_id)
        if parent_note_id in note.get("parentNoteIds", []):
            return

        self._request(
            "POST",
            "/etapi/branches",
            {
                "noteId": note_id,
                "parentNoteId": parent_note_id,
                "prefix": "",
                "notePosition": 0,
                "isExpanded": False,
            },
        )

        for branch_id in note.get("parentBranchIds", []):
            branch = self._request("GET", f"/etapi/branches/{branch_id}")
            if branch.get("parentNoteId") != parent_note_id:
                self._request("DELETE", f"/etapi/branches/{branch_id}")

    def ensure_note_is_present_in_parent(
        self, note_id: str, parent_note_id: str, prefix: str = ""
    ) -> bool:
        """Add a branch under ``parent_note_id`` without removing other branches."""
        note = self.get_note(note_id)
        if parent_note_id in note.get("parentNoteIds", []):
            return False
        self._request(
            "POST",
            "/etapi/branches",
            {
                "noteId": note_id,
                "parentNoteId": parent_note_id,
                "prefix": prefix,
                "notePosition": 0,
                "isExpanded": False,
            },
        )
        return True

    # ---- attributes ----

    def add_label(self, note_id: str, name: str, value: str = "") -> None:
        """Add a label unless this note already owns one with the same name and value.

        Unlike set_label this allows repeated names, e.g. two `run` labels.
        """
        for attribute in self.get_note(note_id).get("attributes", []):
            if (
                attribute.get("noteId") == note_id
                and attribute["type"] == "label"
                and attribute["name"] == name
                and attribute.get("value", "") == value
            ):
                return
        self._request(
            "POST",
            "/etapi/attributes",
            {"noteId": note_id, "type": "label", "name": name, "value": value},
        )

    def set_label(
        self,
        note_id: str,
        name: str,
        value: str = "",
        inheritable: bool = False,
    ) -> None:
        """Create or update a label so repeated applies converge."""
        for attribute in self.get_note(note_id).get("attributes", []):
            # ETAPI includes inherited attributes in a note response. An
            # inherited label is not owned by this note and must be shadowed
            # with a new label rather than patched in place.
            if (
                attribute.get("noteId") != note_id
                or attribute["type"] != "label"
                or attribute["name"] != name
            ):
                continue
            if (
                attribute.get("value", "") == value
                and bool(attribute.get("isInheritable", False)) == inheritable
            ):
                return
            if attribute.get("value", "") == value:
                # ETAPI versions differ in which attribute properties they
                # allow through PATCH. Recreate only when changing the
                # inheritance flag; this is safe for schema definitions and
                # avoids relying on a version-specific PATCH shape.
                self.delete_attribute(attribute["attributeId"])
                self._request(
                    "POST",
                    "/etapi/attributes",
                    {
                        "noteId": note_id,
                        "type": "label",
                        "name": name,
                        "value": value,
                        "isInheritable": inheritable,
                    },
                )
                return
            changes = {"value": value}
            self._request(
                "PATCH",
                f"/etapi/attributes/{attribute['attributeId']}",
                changes,
            )
            return

        self._request(
            "POST",
            "/etapi/attributes",
            {
                "noteId": note_id,
                "type": "label",
                "name": name,
                "value": value,
                "isInheritable": inheritable,
            },
        )

    def set_relation(
        self,
        note_id: str,
        name: str,
        target_note_id: str,
        inheritable: bool = False,
    ) -> None:
        """Create or repoint a relation so repeated applies converge."""
        for attribute in self.get_note(note_id).get("attributes", []):
            # As with labels, inherited relations appear in GET /notes/{id}
            # but belong to the template/ancestor note.
            if (
                attribute.get("noteId") != note_id
                or attribute["type"] != "relation"
                or attribute["name"] != name
            ):
                continue
            if attribute.get("value") == target_note_id:
                return
            # Trilium does not allow changing a relation's target via PATCH;
            # only its position is patchable. Replace the owned relation.
            self.delete_attribute(attribute["attributeId"])
            self._request(
                "POST",
                "/etapi/attributes",
                {
                    "noteId": note_id,
                    "type": "relation",
                    "name": name,
                    "value": target_note_id,
                    "isInheritable": inheritable,
                },
            )
            return

        self._request(
            "POST",
            "/etapi/attributes",
            {
                "noteId": note_id,
                "type": "relation",
                "name": name,
                "value": target_note_id,
                "isInheritable": inheritable,
            },
        )

    def delete_attribute(self, attribute_id: str) -> None:
        self._request("DELETE", f"/etapi/attributes/{attribute_id}")

    def set_attribute_position(self, attribute_id: str, position: int) -> None:
        """Move an owned attribute into a deterministic promoted-field order."""
        self._request(
            "PATCH",
            f"/etapi/attributes/{attribute_id}",
            {"position": position},
        )

    def find_one(
        self,
        query: str,
        include_archived: bool = False,
        ancestor_note_id: str | None = None,
    ) -> str | None:
        """Return the single noteId matching a search, or None.

        Marker labels are how the applier recognises notes it created on a
        previous run, so a duplicate is a real error rather than something to
        silently pick the first of.
        """
        matches = self.search(
            query,
            include_archived=include_archived,
            ancestor_note_id=ancestor_note_id,
        )
        if not matches:
            return None
        if len(matches) > 1:
            titles = ", ".join(f"{m['title']} ({m['noteId']})" for m in matches)
            raise EtapiError(f"{query} is ambiguous — found {len(matches)}: {titles}")
        return matches[0]["noteId"]

    def find_by_label(self, name: str, value: str | None = None) -> str | None:
        """Return the noteId carrying a marker label, or None."""
        query = f"#{name}" if value is None else f'#{name}="{value}"'
        note_id = self.find_one(query, include_archived=True)
        if note_id is not None:
            return note_id

        # The built-in User Hidden subtree is excluded from normal search. It
        # is the safe home for implementation roots, so search it explicitly.
        return self.find_one(
            query,
            include_archived=True,
            ancestor_note_id="_userHidden",
        )
