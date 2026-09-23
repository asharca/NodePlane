"""Real HTTP/DB functional tests against a DISPOSABLE local Encore application.

Start tests/fixtures/server.py first. No app API is mocked. Proxy transport,
subscription content, webhook delivery and SMTP delivery use loopback fixtures.
Run with NODEPLANE_E2E_DISPOSABLE=1 python3 tests/functional_api.py.
"""
from __future__ import annotations

import base64
import concurrent.futures
import json
import os
from pathlib import Path
import re
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid

ORIGIN = os.getenv("NODEPLANE_API_ORIGIN", "http://127.0.0.1:4000").rstrip("/")
FIXTURE = os.getenv("NODEPLANE_FIXTURE_ORIGIN", "http://127.0.0.1:18081").rstrip("/")
INVITE = os.getenv("REGISTER_INVITE_CODE", "ashark")
PASSWORD = "NodePlane-fixture-password-2026"
OUTPUT = Path("test-results/backend")
REQUESTS: list[dict] = []
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def require_disposable():
    if os.getenv("NODEPLANE_E2E_DISPOSABLE") != "1":
        raise SystemExit("Refusing writes: set NODEPLANE_E2E_DISPOSABLE=1 only for disposable test infrastructure.")
    for origin in (ORIGIN, FIXTURE):
        url = urllib.parse.urlsplit(origin)
        if url.scheme != "http" or url.hostname not in {"127.0.0.1", "localhost", "::1"} or url.username or url.password:
            raise SystemExit("Functional tests accept loopback HTTP origins only; never use production accounts.")


def http(method, path, payload=None, token=None, origin=ORIGIN, timeout=35):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(origin + path, data=data, headers=headers, method=method)
    try:
        with OPENER.open(req, timeout=timeout) as response:
            code, body = response.status, response.read()
    except urllib.error.HTTPError as error:
        code, body = error.code, error.read()
    if origin == ORIGIN:
        REQUESTS.append({"method": method, "path": path.split("?")[0], "status": code})
    text = body.decode(errors="replace")
    try:
        return code, json.loads(text)
    except ValueError:
        return code, text


def user():
    name = "np_test_" + uuid.uuid4().hex[:16]
    code, registered = http("POST", "/auth/register", {"username": name, "password": PASSWORD, "invite_code": INVITE})
    if code != 200:
        raise AssertionError(f"Fixture account registration: {code}, {registered}")
    code, session = http("POST", "/auth/login", {"username": name, "password": PASSWORD})
    if code != 200:
        raise AssertionError(f"Fixture account login: {code}, {session}")
    return name, registered["user_id"], session["token"]


class FunctionalAPI(unittest.TestCase):
    def setUp(self):
        self.username, self.uid, self.token = user()

    def api(self, method, path, payload=None, *, expected=200, token=None):
        code, result = http(method, path, payload, self.token if token is None else token)
        expected = (expected,) if isinstance(expected, int) else expected
        self.assertIn(code, expected, f"{method} {path}: {code} {result}")
        return result

    def group(self, kind="subscription", name="Functional group"):
        return self.api("POST", "/subscriptions", {"kind": kind, "name": name, "url": FIXTURE + "/subscription.yaml"})

    def import_nodes(self, group, content=None, append=False):
        port = urllib.parse.urlsplit(FIXTURE).port
        if content is None:
            content = f'proxies:\n  - {{name: "Fixture Alpha", type: http, server: 127.0.0.1, port: {port}}}\n'
        return self.api("POST", f'/subscription/{group["id"]}/import-nodes', {"content": content, "append": append})

    def nodes(self, group):
        return self.api("GET", f'/subscription/{group["id"]}/nodes')["nodes"]

    def configure(self, **changes):
        settings = self.api("GET", "/settings")
        settings.update({"speed_test_url": FIXTURE + "/download", "upload_test_url": FIXTURE + "/upload", "latency_test_url": FIXTURE + "/health"})
        settings.update(changes)
        return self.api("PUT", "/settings", settings)

    def rule(self, key="fixture"):
        return self.api("POST", "/platform-rules", {"name": "Fixture rule", "key": key, "enabled": True, "rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200, "body_contains": ["available"]}, "sort_order": 100})

    def wait_job(self, group, job_id):
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            jobs = self.api("GET", f'/check/{group["id"]}/jobs?limit=100&offset=0')["jobs"]
            job = next((j for j in jobs if j["id"] == job_id), None)
            if job and job["status"] in {"completed", "failed"}:
                return job
            time.sleep(0.1)
        self.fail(f"Check job did not finish within its test deadline: {job_id}")

    def run_check(self, group, **options):
        params = {"speed_test": False, "upload_speed_test": False, "media_apps": [], "debug": False, **options}
        job_id = self.api("POST", f'/check/{group["id"]}', params)["job_id"]
        job = self.wait_job(group, job_id)
        self.assertEqual(job["status"], "completed", job)
        result = self.api("GET", f'/check/{group["id"]}/results?job_id={job_id}')
        return job, result

    def test_auth_validation_duplicate_and_invalid_credentials(self):
        for payload in ({"username": "", "password": PASSWORD, "invite_code": INVITE}, {"username": "x", "password": "", "invite_code": INVITE}, {"username": "x", "password": PASSWORD, "invite_code": "wrong"}):
            with self.subTest(payload=payload["username"]):
                self.api("POST", "/auth/register", payload, expected=400)
        self.api("POST", "/auth/register", {"username": self.username, "password": PASSWORD, "invite_code": INVITE}, expected=409)
        self.api("POST", "/auth/login", {"username": self.username, "password": "wrong"}, expected=401)
        self.api("POST", "/auth/login", {"username": "does-not-exist", "password": PASSWORD}, expected=401)
        self.assertEqual(self.api("GET", "/auth/me")["user_id"], self.uid)

    def test_all_protected_routes_require_authentication(self):
        for file in Path("services").rglob("*.go"):
            for method, template in re.findall(r'//encore:api auth[^\n]*method=(\w+) path=(\S+)', file.read_text()):
                path = re.sub(r':\w+', "00000000-0000-0000-0000-000000000000", template)
                with self.subTest(endpoint=method + " " + template):
                    status, _ = http(method, path, {} if method not in {"GET", "HEAD"} else None)
                    self.assertEqual(status, 401)
        self.api("GET", "/auth/me", token="invalid-token", expected=401)

    def test_remember_me_token_expiry(self):
        for remember, duration in ((False, 86400), (True, 30 * 86400)):
            with self.subTest(remember=remember):
                data = self.api("POST", "/auth/login", {"username": self.username, "password": PASSWORD, "remember": remember})
                encoded = data["token"].split(".")[1]
                claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
                self.assertEqual(claims["sub"], self.uid)
                self.assertAlmostEqual(claims["exp"] - claims["iat"], duration, delta=2)

    def test_profile_and_password_persist(self):
        updated = {"username": self.username + "_new", "email": "fixture@example.invalid", "display_name": "Functional account"}
        self.api("PATCH", "/auth/profile", updated)
        me = self.api("GET", "/auth/me")
        for field, value in updated.items():
            self.assertEqual(me[field], value)
        self.api("PATCH", "/auth/profile", {**updated, "email": "not-email"}, expected=400)
        self.api("POST", "/auth/change-password", {"current_password": "wrong", "new_password": PASSWORD + "new"}, expected=(400, 401))
        self.api("POST", "/auth/change-password", {"current_password": PASSWORD, "new_password": PASSWORD + "new"})
        self.api("POST", "/auth/login", {"username": updated["username"], "password": PASSWORD}, expected=401)
        self.api("POST", "/auth/login", {"username": updated["username"], "password": PASSWORD + "new"})

    def test_group_crud_and_export_preferences(self):
        group = self.group()
        gid = group["id"]
        self.assertEqual(self.api("GET", f"/subscriptions/{gid}")["name"], group["name"])
        updated = self.api("PUT", f"/subscriptions/{gid}", {"name": "Renamed", "enabled": False, "cron_expr": "0 4 * * *", "export_sort": "latency_asc", "export_include_dead": True})
        self.assertEqual(updated["name"], "Renamed")
        self.assertFalse(updated["enabled"])
        self.assertTrue(updated["export_include_dead"])
        self.assertEqual(updated["export_sort"], "latency_asc")
        updated = self.api("PUT", f"/subscriptions/{gid}", {"clear_cron_expr": True, "export_sort": "invalid"})
        self.assertIsNone(updated["cron_expr"])
        self.assertEqual(updated["export_sort"], "speed_desc")
        self.api("DELETE", f"/subscriptions/{gid}")
        self.api("GET", f"/subscriptions/{gid}", expected=404)
        self.api("DELETE", f"/subscriptions/{gid}", expected=404)
        self.assertEqual(self.api("GET", "/subscriptions")["subscriptions"], [])

    def test_direct_group_and_invalid_subscription(self):
        self.api("POST", "/subscriptions", {"kind": "subscription", "name": "Empty", "url": " "}, expected=400)
        group = self.group("node")
        self.assertEqual(group["url"], "")
        self.assertIsNone(group["cron_expr"])
        self.import_nodes(group)
        self.assertEqual(len(self.nodes(group)), 1)
        self.api("POST", f'/subscription/{group["id"]}/refresh', expected=400)
        self.assertFalse(self.api("POST", f'/subscription/{group["id"]}/test-fetch')["ok"])

    def test_refresh_dry_run_and_fetch_proxy(self):
        group = self.group()
        base = f'/subscription/{group["id"]}'
        dry = self.api("POST", base + "/test-fetch")
        self.assertTrue(dry["ok"])
        self.assertEqual(dry["count"], 2)
        self.assertEqual(self.nodes(group), [], "A dry-run must not modify node storage")
        self.assertEqual(self.api("POST", base + "/refresh")["count"], 2)
        self.assertEqual(len(self.nodes(group)), 2)
        proxy = {"type": "http", "name": "Fixture proxy", "server": "127.0.0.1", "port": urllib.parse.urlsplit(FIXTURE).port}
        self.api("PUT", f'/subscriptions/{group["id"]}/fetch-proxy', {"config": "invalid-json"}, expected=400)
        self.api("PUT", f'/subscriptions/{group["id"]}/fetch-proxy', {"config": json.dumps(proxy)})
        self.assertTrue(self.api("POST", base + "/test-fetch")["ok"])
        cleared = self.api("PUT", f'/subscriptions/{group["id"]}/fetch-proxy', {"config": ""})
        self.assertFalse(cleared.get("fetch_proxy_config"))

    def test_failed_refresh_preserves_existing_nodes(self):
        group = self.group()
        self.import_nodes(group)
        before = self.nodes(group)
        self.api("PUT", f'/subscriptions/{group["id"]}', {"url": FIXTURE + "/broken.yaml"})
        self.assertFalse(self.api("POST", f'/subscription/{group["id"]}/test-fetch')["ok"])
        self.api("POST", f'/subscription/{group["id"]}/refresh', expected=503)
        self.assertEqual(self.nodes(group), before)

    def test_import_replace_append_validation_and_node_toggle(self):
        group = self.group()
        self.import_nodes(group)
        self.import_nodes(group, 'proxies:\n  - {name: Added, type: ss, server: 192.0.2.1, port: 8388, cipher: aes-128-gcm, password: fixture}\n', append=True)
        nodes = self.nodes(group)
        self.assertEqual(len(nodes), 2)
        node = nodes[0]
        self.api("PATCH", f'/nodes/{node["node_id"]}', {"enabled": False})
        self.assertFalse(next(n for n in self.nodes(group) if n["node_id"] == node["node_id"])["enabled"])
        endpoint = f'/subscription/{group["id"]}/import-nodes'
        self.api("POST", endpoint, {"content": "not-a-node", "append": False}, expected=400)
        self.assertEqual(len(self.nodes(group)), 2)
        multi = 'proxies:\n  - {name: A, type: http, server: localhost, port: 80}\n  - {name: B, type: http, server: localhost, port: 81}\n'
        self.api("POST", endpoint, {"content": multi, "append": True}, expected=400)
        self.assertEqual(len(self.nodes(group)), 2)
        self.import_nodes(group)
        self.assertEqual(len(self.nodes(group)), 1)

    def test_subscription_and_node_cross_tenant_access(self):
        group = self.group()
        self.import_nodes(group)
        node_id = self.nodes(group)[0]["node_id"]
        _, _, other = user()
        gid = group["id"]
        for method, path, data in [("GET", f"/subscriptions/{gid}", None), ("PUT", f"/subscriptions/{gid}", {"name": "stolen"}), ("DELETE", f"/subscriptions/{gid}", None), ("GET", f"/subscription/{gid}/nodes", None), ("POST", f"/subscription/{gid}/refresh", None), ("POST", f"/subscription/{gid}/test-fetch", None), ("POST", f"/subscription/{gid}/import-nodes", {"content": "x"}), ("PATCH", f"/nodes/{node_id}", {"enabled": False}), ("POST", f"/check/{gid}", {"media_apps": []}), ("PUT", f"/subscriptions/{gid}/fetch-proxy", {"config": ""})]:
            with self.subTest(endpoint=method + path):
                self.api(method, path, data, token=other, expected=(403, 404))
        self.assertEqual(self.api("GET", "/subscriptions", token=other)["subscriptions"], [])
        self.assertEqual(self.api("GET", f"/subscriptions/{gid}")["name"], group["name"])
        self.assertTrue(self.nodes(group)[0]["enabled"])

    def test_settings_roundtrip_isolation_and_export_tags(self):
        saved = self.configure(email_config={"smtp_host": "127.0.0.1", "smtp_port": 18082, "smtp_user": "", "smtp_pass": "", "from": "fixture@example.invalid"}, export_tags={"show_country": True, "show_speed": False, "platforms": [{"key": "custom_fixture", "label": "TEST", "enabled": True}]})
        loaded = self.api("GET", "/settings")
        self.assertEqual(loaded["speed_test_url"], saved["speed_test_url"])
        self.assertEqual(loaded["email_config"], saved["email_config"])
        self.assertTrue(loaded["export_tags"]["show_country"])
        self.assertFalse(loaded["export_tags"]["show_speed"])
        self.assertIn({"key": "custom_fixture", "label": "TEST", "enabled": True}, loaded["export_tags"]["platforms"])
        _, _, other = user()
        self.assertEqual(self.api("GET", "/settings", token=other)["speed_test_url"], "")

    def test_api_key_read_is_stable_and_rotation_revokes_old_key(self):
        key = self.api("GET", "/settings/api-key")["api_key"]
        self.assertEqual(self.api("GET", "/settings/api-key")["api_key"], key)
        rotated = self.api("POST", "/settings/api-key/regenerate")["api_key"]
        self.assertNotEqual(rotated, key)
        self.api("GET", f"/export/all?token={key}", expected=401)
        self.api("GET", f"/export/all?token={rotated}")

    def test_concurrent_api_key_reads_do_not_rotate_keys(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(lambda _: http("GET", "/settings/api-key", token=self.token), range(8)))
        self.assertTrue(all(status == 200 for status, _ in responses), responses)
        self.assertEqual(len({body["api_key"] for _, body in responses}), 1, "Concurrent reads must return the same persisted API key")

    def test_scheduler_crud_and_options(self):
        group = self.group()
        payload = {"subscription_id": group["id"], "cron_expr": "0 0 1 1 *", "options": {"speed_test": False, "upload_speed_test": True, "media_apps": [], "debug": True}}
        job = self.api("POST", "/scheduler", payload)
        stored = self.api("GET", "/scheduler")["jobs"][0]
        self.assertEqual(stored["id"], job["id"])
        self.assertFalse(stored["speed_test"])
        self.assertTrue(stored["upload_speed_test"])
        self.assertTrue(stored["debug"])
        self.assertFalse(self.api("PATCH", f'/scheduler/{job["id"]}', {"enabled": False})["enabled"])
        self.assertTrue(self.api("PATCH", f'/scheduler/{job["id"]}', {"enabled": True})["enabled"])
        self.api("DELETE", f'/scheduler/{job["id"]}')
        self.assertEqual(self.api("GET", "/scheduler")["jobs"], [])
        self.api("DELETE", f'/scheduler/{job["id"]}', expected=404)

    def test_scheduler_upsert_returns_persisted_id_and_created_at(self):
        group = self.group()
        first = self.api("POST", "/scheduler", {"subscription_id": group["id"], "cron_expr": "0 0 1 1 *"})
        edited = self.api("POST", "/scheduler", {"subscription_id": group["id"], "cron_expr": "0 1 1 1 *"})
        stored = self.api("GET", "/scheduler")["jobs"]
        self.assertEqual(len(stored), 1)
        self.assertEqual(edited["id"], first["id"])
        self.assertEqual(edited["id"], stored[0]["id"])
        self.assertEqual(edited["created_at"], stored[0]["created_at"])
        self.api("PATCH", f'/scheduler/{edited["id"]}', {"enabled": False})

    def test_scheduler_invalid_and_foreign_requests(self):
        direct = self.group("node")
        self.api("POST", "/scheduler", {"subscription_id": direct["id"], "cron_expr": "0 0 1 1 *"}, expected=400)
        group = self.group()
        self.api("POST", "/scheduler", {"subscription_id": group["id"], "cron_expr": "invalid"}, expected=400)
        job = self.api("POST", "/scheduler", {"subscription_id": group["id"], "cron_expr": "0 0 1 1 *"})
        _, _, other = user()
        self.assertEqual(self.api("GET", "/scheduler", token=other)["jobs"], [])
        self.api("PATCH", f'/scheduler/{job["id"]}', {"enabled": False}, token=other, expected=404)
        self.api("DELETE", f'/scheduler/{job["id"]}', token=other, expected=404)
        self.api("POST", "/scheduler", {"subscription_id": group["id"], "cron_expr": "0 0 1 1 *"}, token=other, expected=404)
        self.assertTrue(self.api("GET", "/scheduler")["jobs"][0]["enabled"])

    def test_rules_seed_crud_and_reset(self):
        seeded = self.api("GET", "/platform-rules")["rules"]
        self.assertGreater(len(seeded), 0)
        again = self.api("GET", "/platform-rules")["rules"]
        self.assertEqual({r["id"] for r in seeded}, {r["id"] for r in again})
        custom = self.rule()
        changed = {**custom, "name": "Renamed rule", "enabled": False, "sort_order": 42}
        edited = self.api("PUT", f'/platform-rules/{custom["id"]}', changed)
        self.assertEqual(edited["name"], changed["name"])
        self.assertFalse(edited["enabled"])
        self.api("POST", f'/platform-rule-reset/{custom["id"]}', expected=400)
        builtin = seeded[0]
        self.api("PUT", f'/platform-rules/{builtin["id"]}', {**builtin, "name": "Customized", "enabled": False})
        reset = self.api("POST", f'/platform-rule-reset/{builtin["id"]}')
        self.assertEqual(reset["definition"], builtin["definition"])
        self.assertEqual(reset["name"], builtin["name"])
        self.assertFalse(reset["customized"])
        self.assertFalse(reset["enabled"])
        self.api("DELETE", f'/platform-rules/{custom["id"]}')
        self.assertNotIn(custom["id"], [r["id"] for r in self.api("GET", "/platform-rules")["rules"]])

    def test_rules_invalid_type_and_cross_tenant(self):
        rule = self.rule()
        self.api("POST", "/platform-rules", {**rule, "key": "invalid", "rule_type": "unsupported"}, expected=400)
        self.api("POST", "/platform-rules", {**rule, "key": " "}, expected=400)
        _, _, other = user()
        self.api("PUT", f'/platform-rules/{rule["id"]}', rule, token=other, expected=404)
        self.api("DELETE", f'/platform-rules/{rule["id"]}', token=other, expected=404)
        self.api("POST", f'/platform-rule-reset/{rule["id"]}', token=other, expected=404)
        self.assertNotIn(rule["id"], [r["id"] for r in self.api("GET", "/platform-rules", token=other)["rules"]])

    def test_all_five_rule_engines_success_and_failure(self):
        definitions = {"condition": {"url": FIXTURE + "/platform", "status_code": 200, "body_contains": ["available"]}, "js": {"code": "return true;"}, "ts": {"code": "const ok: boolean = true; return ok;"}, "lua": {"code": "return true"}, "tengo": {"code": "output = true"}}
        for kind, definition in definitions.items():
            with self.subTest(engine=kind):
                result = self.api("POST", "/platform-rules/test", {"rule_type": kind, "definition": definition})
                self.assertTrue(result["ok"], result)
                self.assertIn("trace", result)
        failed = self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 418}})
        self.assertFalse(failed["ok"])
        failed = self.api("POST", "/platform-rules/test", {"rule_type": "js", "definition": {"code": "throw new Error('fixture error');"}})
        self.assertFalse(failed["ok"])
        self.assertIn("fixture error", failed["error"])
        self.api("POST", "/platform-rules/test", {"rule_type": "unknown", "definition": {}}, expected=400)

    def test_new_nodes_are_available_to_rule_testing_before_first_check(self):
        group = self.group()
        self.import_nodes(group)
        node = self.nodes(group)[0]
        picker = self.api("GET", "/platform-rules/test-nodes")["nodes"]
        self.assertIn(node["node_id"], [n["id"] for n in picker])
        _, _, other = user()
        self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": node["node_id"]}, token=other, expected=404)
        self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": "missing-test-node"}, expected=404)
        self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": "00000000-0000-0000-0000-000000000000"}, expected=404)
        result = self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": node["node_id"]})
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["node_name"], node["node_name"])

    def test_check_full_pipeline_progress_results_and_partial_recheck(self):
        self.configure()
        self.rule()
        group = self.group()
        self.api("POST", f'/subscription/{group["id"]}/refresh')
        job, result = self.run_check(group, speed_test=True, upload_speed_test=True, media_apps=["fixture"], debug=True)
        self.assertEqual(job["total"], 2)
        self.assertEqual(job["available"], 2)
        self.assertEqual(len(result["results"]), 2)
        for node in result["results"]:
            self.assertTrue(node["alive"])
            self.assertGreater(node["speed_kbps"], 0)
            self.assertGreater(node["upload_speed_kbps"], 0)
            self.assertTrue(node["platforms"]["fixture"]["unlocked"])
        status, sse = http("GET", f'/check/{job["id"]}/progress', token=self.token)
        self.assertEqual(status, 200)
        self.assertIn('"done":true', sse)
        summary = self.api("GET", "/check-summaries")["jobs"][group["id"]]
        self.assertEqual(summary["id"], job["id"])
        nodes = self.nodes(group)
        partial, _ = self.run_check(group, node_ids=[nodes[0]["node_id"]])
        self.assertEqual(partial["total"], 1)
        self.assertEqual(len(self.nodes(group)), 2)
        self.assertTrue(all(n["speed_kbps"] > 0 for n in self.nodes(group)), "A latency-only recheck must inherit prior speeds")
        self.assertEqual(len(self.api("GET", f'/check/{group["id"]}/jobs?limit=1&offset=0')["jobs"]), 1)
        self.assertEqual(len(self.api("GET", f'/check/{group["id"]}/jobs?limit=1&offset=1')["jobs"]), 1)

    def test_check_duplicate_rejection_cancellation_and_live_sse(self):
        self.configure(latency_test_url=FIXTURE + "/slow")
        group = self.group()
        self.import_nodes(group)
        job = self.api("POST", f'/check/{group["id"]}', {"speed_test": False, "media_apps": []})["job_id"]
        self.api("POST", f'/check/{group["id"]}', {"speed_test": False, "media_apps": []}, expected=400)
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            stream = pool.submit(http, "GET", f"/check/{job}/progress", None, self.token)
            # Wait until the worker is registered, not merely until POST returns.
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                jobs = self.api("GET", f'/check/{group["id"]}/jobs')["jobs"]
                if jobs[0]["status"] == "running":
                    break
                time.sleep(0.05)
            self.api("DELETE", f"/check/{job}")
            ended = self.wait_job(group, job)
            self.assertEqual(ended["status"], "failed")
            status, body = stream.result(timeout=10)
            self.assertEqual(status, 200)
            self.assertIn('"done":true', body)
        self.api("DELETE", f"/check/{job}", expected=404)

    def test_check_history_and_results_are_tenant_scoped(self):
        self.configure()
        group = self.group()
        self.import_nodes(group)
        job, _ = self.run_check(group)
        _, _, other = user()
        self.assertEqual(self.api("GET", f'/check/{group["id"]}/jobs', token=other)["jobs"], [])
        self.api("GET", f'/check/{group["id"]}/results?job_id={job["id"]}', token=other, expected=404)
        self.api("DELETE", f'/check/{job["id"]}', token=other, expected=404)
        self.assertEqual(self.api("GET", "/check-summaries", token=other)["jobs"], {})

    def test_export_formats_preferences_logs_and_foreign_token(self):
        self.configure()
        group = self.group()
        self.import_nodes(group)
        self.run_check(group)
        key = self.api("GET", "/settings/api-key")["api_key"]
        prefix = f'/export/{group["id"]}?token={key}'
        clash = self.api("GET", prefix + "&target=clash")
        self.assertIn("Fixture Alpha", clash)
        routeros = self.api("GET", prefix + "&target=routeros&list=np_test")
        self.assertIn("127.0.0.1", routeros)
        self.assertIn("np_test", routeros)
        # HTTP proxy URIs are intentionally not one of the four supported
        # base64 encodings; validate the envelope without claiming parity.
        encoded = self.api("GET", prefix + "&target=base64")
        base64.b64decode(encoded, validate=True)
        self.assertIn("Fixture Alpha", self.api("GET", f"/export/all?token={key}"))
        logs = self.api("GET", f'/export-logs/{group["id"]}')["logs"]
        self.assertGreaterEqual(len(logs), 1)
        node = self.nodes(group)[0]
        self.api("PATCH", f'/nodes/{node["node_id"]}', {"enabled": False})
        self.assertNotIn("Fixture Alpha", self.api("GET", prefix))
        self.api("GET", f'/export/{group["id"]}', expected=401)
        _, _, other = user()
        other_key = self.api("GET", "/settings/api-key", token=other)["api_key"]
        self.api("GET", f'/export/{group["id"]}?token={other_key}', expected=404)

    def test_notification_crud_webhook_delivery_and_failure(self):
        channel = self.api("POST", "/notify/channels", {"name": "Fixture webhook", "type": "webhook", "config": {"url": FIXTURE + "/hook", "headers": {"X-NodePlane-Test": self.uid}}, "platform_alerts": ["netflix"], "on_check_complete": False})
        cid = channel["id"]
        sent = self.api("POST", f"/notify/channels/{cid}/test", {"report_type": "check"})
        self.assertTrue(sent["ok"], sent)
        _, events = http("GET", "/events", origin=FIXTURE)
        self.assertTrue(any(e.get("test_header") == self.uid and e["type"] == "webhook" for e in events["events"]))
        self.assertTrue(self.api("POST", f"/notify/channels/{cid}/test", {"report_type": "platform_alert"})["ok"])
        self.api("PUT", f"/notify/channels/{cid}", {"config": {"url": FIXTURE + "/fail"}})
        failed = self.api("POST", f"/notify/channels/{cid}/test", {"report_type": "check"})
        self.assertFalse(failed["ok"])
        self.assertIn("503", failed["error"])
        self.api("POST", f"/notify/channels/{cid}/test", {"report_type": "unknown"}, expected=400)
        self.api("DELETE", f"/notify/channels/{cid}")
        self.assertEqual(self.api("GET", "/notify/channels")["channels"], [])

    def test_notification_partial_update_preserves_platform_alerts(self):
        channel = self.api("POST", "/notify/channels", {"name": "Keep alerts", "type": "webhook", "config": {"url": FIXTURE + "/hook"}, "platform_alerts": ["netflix", "openai"]})
        edited = self.api("PUT", f'/notify/channels/{channel["id"]}', {"enabled": False})
        self.assertFalse(edited["enabled"])
        self.assertEqual(edited["platform_alerts"], ["netflix", "openai"])
        cleared = self.api("PUT", f'/notify/channels/{channel["id"]}', {"platform_alerts": []})
        self.assertEqual(cleared["platform_alerts"], [])

    def test_notification_smtp_delivery_and_invalid_configuration(self):
        self.configure(email_config={"smtp_host": "127.0.0.1", "smtp_port": 18082, "smtp_user": "", "smtp_pass": "", "from": "fixture@example.invalid"})
        channel = self.api("POST", "/notify/channels", {"name": "Fixture email", "type": "email", "config": {"to_email": self.uid + "@example.invalid"}})
        result = self.api("POST", f'/notify/channels/{channel["id"]}/test', {"report_type": "check"})
        self.assertTrue(result["ok"], result)
        _, events = http("GET", "/events", origin=FIXTURE)
        self.assertTrue(any(e["type"] == "email" and self.uid in e["message"] for e in events["events"]))
        self.api("POST", "/notify/channels", {"name": "invalid", "type": "unknown", "config": {}}, expected=400)
        self.api("POST", "/notify/channels", {"name": "invalid", "type": "webhook", "config": {}, "unlock_cron": "invalid"}, expected=400)
        telegram = self.api("POST", "/notify/channels", {"name": "No real Telegram", "type": "telegram", "config": {}})
        self.assertFalse(self.api("POST", f'/notify/channels/{telegram["id"]}/test', {"report_type": "check"})["ok"])

    def test_notification_cross_tenant_access(self):
        channel = self.api("POST", "/notify/channels", {"name": "Owned", "type": "webhook", "config": {"url": FIXTURE + "/hook"}})
        _, _, other = user()
        self.assertEqual(self.api("GET", "/notify/channels", token=other)["channels"], [])
        for method, suffix, data in (("PUT", "", {"name": "stolen"}), ("DELETE", "", None), ("POST", "/test", {"report_type": "check"})):
            with self.subTest(method=method):
                self.api(method, f'/notify/channels/{channel["id"]}' + suffix, data, token=other, expected=404)
        self.assertEqual(self.api("GET", "/notify/channels")["channels"][0]["name"], "Owned")


    def test_network_unlock_and_unlock_notification(self):
        # CI redirects ip-api.com to a loopback fixture; only user-owned local
        # rules are enabled here. No real platform service is contacted.
        for rule in self.api("GET", "/platform-rules")["rules"]:
            self.api("PUT", f'/platform-rules/{rule["id"]}', {**rule, "enabled": False})
        self.rule("local_fixture")
        result = self.api("GET", "/network-unlock")
        self.assertTrue(result["platforms"]["local_fixture"]["unlocked"])
        self.assertEqual(set(result["platforms"]), {"local_fixture"})
        self.assertEqual(result["ip"], "192.0.2.10")
        channel = self.api("POST", "/notify/channels", {"name": "Unlock fixture", "type": "webhook", "config": {"url": FIXTURE + "/hook"}})
        self.assertTrue(self.api("POST", f'/notify/channels/{channel["id"]}/test', {"report_type": "unlock"})["ok"])


    def test_real_cron_trigger_and_automatic_completion_notification(self):
        self.configure()
        group = self.group(name="Automatic fixture")
        self.api("POST", "/notify/channels", {"name": "Automatic report", "type": "webhook", "config": {"url": FIXTURE + "/hook", "headers": {"X-NodePlane-Test": self.uid}}, "on_check_complete": True})
        schedule = self.api("POST", "/scheduler", {"subscription_id": group["id"], "cron_expr": "* * * * *", "options": {"speed_test": False, "upload_speed_test": False, "media_apps": []}})
        try:
            deadline = time.monotonic() + 85
            completed = None
            while time.monotonic() < deadline:
                jobs = self.api("GET", f'/check/{group["id"]}/jobs')["jobs"]
                completed = next((job for job in jobs if job["status"] == "completed"), None)
                if completed:
                    break
                time.sleep(0.25)
            self.assertIsNotNone(completed, "The real Cron callback did not complete a check")
            self.assertEqual(completed["available"], 2)
            self.assertEqual(len(self.nodes(group)), 2)
            deadline = time.monotonic() + 10
            delivered = False
            while time.monotonic() < deadline:
                _, events = http("GET", "/events", origin=FIXTURE)
                delivered = any(e["type"] == "webhook" and e.get("test_header") == self.uid for e in events["events"])
                if delivered:
                    break
                time.sleep(0.1)
            self.assertTrue(delivered, "Check completion did not reach the automatic notification subscriber")
        finally:
            self.api("DELETE", f'/scheduler/{schedule["id"]}')



if __name__ == "__main__":
    require_disposable()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(FunctionalAPI)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    inventory = []
    for source in Path("services").rglob("*.go"):
        for access, method, template in re.findall(r'//encore:api (auth|public)(?: raw)?[^\n]*method=(\w+) path=(\S+)', source.read_text()):
            regex = "^" + re.sub(r':\w+', "[^/]+", template) + "$"
            hits = [r for r in REQUESTS if r["method"] == method and re.match(regex, r["path"])]
            inventory.append({"endpoint": method + " " + template, "access": access, "statuses_observed": sorted({r["status"] for r in hits}), "successful_request_observed": any(200 <= r["status"] < 300 for r in hits)})
    report = {"backend": "real Encore HTTP endpoints and PostgreSQL; external services are loopback fixtures", "tests_run": result.testsRun, "failures": [test.id() for test, _ in result.failures], "errors": [test.id() for test, _ in result.errors], "skipped": [test.id() for test, _ in result.skipped], "endpoint_inventory": inventory}
    (OUTPUT / "functional-api.json").write_text(json.dumps(report, indent=2) + "\n")
    raise SystemExit(0 if result.wasSuccessful() else 1)
