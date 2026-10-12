"""Offline regression tests for the small ETAPI client."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))

from etapi import Etapi  # noqa: E402


class AttributeUpdateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.api = Etapi("http://example.test", "token")
        self.api.get_note = Mock(return_value={"attributes": []})
        self.api._request = Mock(return_value={})
        self.api.delete_attribute = Mock()

    def test_relation_retarget_deletes_and_recreates_owned_relation(self):
        self.api.get_note.return_value = {
            "attributes": [{
                "attributeId": "old",
                "noteId": "note",
                "type": "relation",
                "name": "dateTemplate",
                "value": "old-template",
            }],
        }

        self.api.set_relation("note", "dateTemplate", "new-template")

        self.api.delete_attribute.assert_called_once_with("old")
        self.api._request.assert_called_once_with(
            "POST",
            "/etapi/attributes",
            {
                "noteId": "note",
                "type": "relation",
                "name": "dateTemplate",
                "value": "new-template",
                "isInheritable": False,
            },
        )

    def test_inherited_relation_is_shadowed_instead_of_retargeted(self):
        self.api.get_note.return_value = {
            "attributes": [{
                "attributeId": "template-relation",
                "noteId": "template",
                "type": "relation",
                "name": "project",
                "value": "old-project",
            }],
        }

        self.api.set_relation("note", "project", "new-project")

        self.api.delete_attribute.assert_not_called()
        self.api._request.assert_called_once()
        self.assertEqual(self.api._request.call_args.args[0], "POST")

    def test_inherited_label_is_shadowed_instead_of_patched(self):
        self.api.get_note.return_value = {
            "attributes": [{
                "attributeId": "template-label",
                "noteId": "template",
                "type": "label",
                "name": "status",
                "value": "draft",
            }],
        }

        self.api.set_label("note", "status", "done")

        self.api._request.assert_called_once_with(
            "POST",
            "/etapi/attributes",
            {
                "noteId": "note",
                "type": "label",
                "name": "status",
                "value": "done",
                "isInheritable": False,
            },
        )

    def test_add_label_keeps_existing_run_label_and_adds_a_second(self):
        self.api.get_note.return_value = {
            "attributes": [{
                "attributeId": "run1", "noteId": "note", "type": "label",
                "name": "run", "value": "frontendStartup",
            }],
        }

        self.api.add_label("note", "run", "mobileStartup")

        self.api.delete_attribute.assert_not_called()
        self.api._request.assert_called_once_with(
            "POST",
            "/etapi/attributes",
            {"noteId": "note", "type": "label", "name": "run", "value": "mobileStartup"},
        )

    def test_add_label_is_idempotent_for_an_owned_duplicate(self):
        self.api.get_note.return_value = {
            "attributes": [{
                "attributeId": "run2", "noteId": "note", "type": "label",
                "name": "run", "value": "mobileStartup",
            }],
        }

        self.api.add_label("note", "run", "mobileStartup")

        self.api._request.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
