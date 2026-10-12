#!/usr/bin/env python3
"""Import the example macros from data/example_macros.json into a Trilium instance.

Idempotent: a macro whose title already exists under #ikmalMacro is left alone, so
your edits survive a re-run. Uses TRILIUM_URL / TRILIUM_TOKEN (or dev/.env).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from etapi import Etapi  # noqa: E402

EXAMPLES = Path(__file__).resolve().parents[1] / "data" / "example_macros.json"


def import_examples(api: Etapi, examples: list[dict], parent: str = "root") -> list[str]:
    existing = {note["title"] for note in api.search("#ikmalMacro")}
    created = []
    for example in examples:
        if example["title"] in existing:
            continue
        note_id = api.create_note(parent, example["title"], example["body"])
        api.add_label(note_id, "ikmalMacro")
        for name, value in example["labels"]:
            api.add_label(note_id, name, value)
        created.append(example["title"])
    return created


def main() -> int:
    created = import_examples(Etapi.from_env(), json.loads(EXAMPLES.read_text()))
    print("Created: " + ", ".join(created) if created else "Nothing to import; all examples already exist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
