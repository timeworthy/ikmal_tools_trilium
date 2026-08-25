#!/usr/bin/env python3
"""Docker Real-World End-to-End Test Suite.

Spins up an isolated Trilium container, initializes the database, configures ETAPI,
executes package installation, deploys bundles, executes live smoke tests, performs
chaos and defect injection, tests automated self-repair, and tests clean uninstallation.
"""

from __future__ import annotations

import base64
import datetime
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from tools.etapi import Etapi, EtapiError
import tools.cli_maintenance as maintenance
import tools.deploy_plugin_to_instance as deployer


class DockerRealWorldTest(unittest.TestCase):
    container_name: str
    temp_dir: str
    port: int = 38080
    base_url: str
    token_id: str = "dockertest1"
    secret: str = "SecDockerE2EToken12345678901234"
    full_token: str
    api: Etapi

    @classmethod
    def setUpClass(cls):
        try:
            subprocess.run(["docker", "info"], check=True, capture_output=True)
        except Exception:
            raise unittest.SkipTest("Docker is not available or daemon is not running")

        cls.temp_dir = tempfile.mkdtemp(prefix="trilium_docker_e2e_")
        cls.container_name = f"trilium_e2e_{int(time.time())}"
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.full_token = f"{cls.token_id}_{cls.secret}"

        # 1. Start container
        cmd = [
            "docker", "run", "-d",
            "--name", cls.container_name,
            "-p", f"{cls.port}:8080",
            "-v", f"{cls.temp_dir}:/home/node/trilium-data",
            "trilium-local-plugin-test:fixed"
        ]
        subprocess.run(cmd, check=True, capture_output=True)

        # 2. Wait for Trilium setup endpoint
        for _ in range(30):
            time.sleep(1)
            try:
                req = urllib.request.Request(f"{cls.base_url}/api/setup/status")
                with urllib.request.urlopen(req, timeout=2) as resp:
                    data = json.loads(resp.read())
                    if not data.get("isInitialized"):
                        body = json.dumps({"locale": "en"}).encode()
                        init_req = urllib.request.Request(
                            f"{cls.base_url}/api/setup/new-document",
                            data=body,
                            headers={"Content-Type": "application/json"},
                            method="POST"
                        )
                        urllib.request.urlopen(init_req, timeout=10)
                        break
            except Exception:
                pass

        time.sleep(2)

        # 3. Seed ETAPI token directly into SQLite database
        hash_val = base64.b64encode(hashlib.sha256(cls.secret.encode("utf-8")).digest()).decode("utf-8")
        insert_script = f"""
        const Database = require('better-sqlite3');
        const db = new Database('/home/node/trilium-data/document.db');
        const now = new Date().toISOString().replace('T', ' ');
        db.prepare('INSERT INTO etapi_tokens (etapiTokenId, name, tokenHash, utcDateCreated, utcDateModified, isDeleted) VALUES (?, ?, ?, ?, ?, 0)').run('{cls.token_id}', 'Docker E2E Token', '{hash_val}', now, now);
        db.close();
        """
        subprocess.run(["docker", "exec", cls.container_name, "node", "-e", insert_script], check=True, capture_output=True)

        # 4. Restart container to load token
        subprocess.run(["docker", "restart", cls.container_name], check=True, capture_output=True)

        # 5. Wait for ETAPI to become healthy
        cls.api = Etapi(cls.base_url, cls.full_token)
        for i in range(30):
            time.sleep(1)
            try:
                info = cls.api.app_info()
                if info.get("appVersion"):
                    break
            except Exception as e:
                if i == 29:
                    raise e

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "container_name"):
            subprocess.run(["docker", "rm", "-f", cls.container_name], capture_output=True)

    def test_01_etapi_connection_healthy(self):
        info = self.api.app_info()
        self.assertIsNotNone(info.get("appVersion"))
        self.assertIsNotNone(info.get("dbVersion"))

    def test_02_install_package_and_containers(self):
        # Run headless installer
        result = maintenance.cmd_install(self.api)
        self.assertIn(result, [0, maintenance.EXIT_OK], "Installer should exit 0")

        # Verify essential root notes exist
        self.assertIsNotNone(self.api.find_by_label("todayRoot"), "Expected #todayRoot note")
        self.assertIsNotNone(self.api.find_by_label("calendarRoot"), "Expected #calendarRoot note")
        self.assertIsNotNone(self.api.find_by_label("extConfig"), "Expected #extConfig note")

    def test_03_deploy_bundle_artifacts(self):
        # Run bundle deployer
        deployer.deploy(self.base_url, self.full_token)

        # Verify artifacts exist
        pkg_owner = "iansherr/ikmal_tools_trilium"
        notes = deployer.owned_artifacts(self.api, pkg_owner, "manifest")
        if not notes:
            notes = self.api.search(f'#packageOwner="{pkg_owner}"', include_archived=True)
        self.assertGreaterEqual(len(notes), 1, "Expected deployed package manifest artifact")

    def test_04_verification_passes_on_fresh_deploy(self):
        # Verify 0 defects
        errors = maintenance.cmd_verify(self.api)
        self.assertEqual(errors, 0, f"Verification expected 0 defects on fresh deploy, got {errors}")

    def test_05_chaos_defect_injection_and_self_repair(self):
        # 1. Chaos injection: Delete a container root and corrupt relations
        meeting_notes = self.api.search('#meetingRoot')
        self.assertGreaterEqual(len(meeting_notes), 1)
        meeting_id = meeting_notes[0]["noteId"]

        # Delete meeting container
        self.api.delete_note(meeting_id)

        # 2. Verify flags the defect
        errors = maintenance.cmd_verify(self.api)
        self.assertGreater(errors, 0, "Verify must detect missing container")

        # 3. Run automated repair
        repair_code = maintenance.cmd_repair(self.api)
        self.assertIn(repair_code, [0, maintenance.EXIT_OK])

        # 4. Verify post-repair is 100% clean
        post_errors = maintenance.cmd_verify(self.api)
        self.assertEqual(post_errors, 0, f"Post-repair must have 0 defects, got {post_errors}")

        # Ensure meetingRoot is restored
        restored = self.api.search('#meetingRoot')
        self.assertEqual(len(restored), 1)

    def test_06_uninstall_cleanly(self):
        # Test uninstallation
        uninstall_code = maintenance.cmd_uninstall(self.api)
        self.assertEqual(uninstall_code, 0)

        # Verify active package artifacts are disabled/archived
        enabled_notes = self.api.search('#packageOwner="iansherr/ikmal_tools_trilium" #packageEnabled')
        self.assertEqual(len(enabled_notes), 0, "Expected all package notes to be disabled")


if __name__ == "__main__":
    unittest.main()
