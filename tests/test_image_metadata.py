"""Regression tests for the actual script used by both container build jobs."""
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".github/scripts/image-metadata.sh"
SHA = "70be0fa86d73e3279617ccb6b34758853773b8ba"


class ImageMetadataTests(unittest.TestCase):
    def execute(self, **overrides):
        env = {**os.environ, "REGISTRY": "ghcr.io", "GITHUB_REPOSITORY": "asharca/NodePlane",
               "GITHUB_SHA": SHA, "GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/main"}
        env.update(overrides)
        return subprocess.run(["bash", str(SCRIPT)], env=env, text=True,
                              capture_output=True, timeout=5, check=False)

    def metadata(self, **overrides):
        result = self.execute(**overrides)
        self.assertEqual(result.returncode, 0, result.stderr)
        return dict(line.split("=", 1) for line in result.stdout.splitlines())

    def test_mixed_case_repository_regression(self):
        result = self.metadata()
        self.assertEqual(result["backend_image"], "ghcr.io/asharca/nodeplane")
        self.assertEqual(result["frontend_image"], "ghcr.io/asharca/nodeplane-frontend")
        self.assertEqual(result["sha_tag"], SHA)
        self.assertEqual(result["release_tag"], "latest")
        self.assertEqual(result["publish"], "true")

    def test_lowercase_repository_is_unchanged(self):
        self.assertEqual(self.metadata(GITHUB_REPOSITORY="asharca/nodeplane")["backend_image"],
                         "ghcr.io/asharca/nodeplane")

    def test_owner_is_also_normalized(self):
        self.assertEqual(self.metadata(GITHUB_REPOSITORY="OtherOwner/NodePlane")["backend_image"],
                         "ghcr.io/otherowner/nodeplane")

    def test_release_tag_case_is_preserved(self):
        result = self.metadata(GITHUB_REF="refs/tags/v1.2.3-RC.1")
        self.assertEqual(result["release_tag"], "v1.2.3-RC.1")
        self.assertEqual(result["publish"], "true")

    def test_pull_request_never_publishes_or_uses_latest(self):
        result = self.metadata(GITHUB_EVENT_NAME="pull_request", GITHUB_REF="refs/pull/8/merge")
        self.assertEqual(result["publish"], "false")
        self.assertEqual(result["release_tag"], f"ci-{SHA[:12]}")

    def test_non_push_events_never_publish(self):
        for event in ("pull_request_target", "workflow_dispatch", "workflow_run"):
            with self.subTest(event=event):
                self.assertEqual(self.metadata(GITHUB_EVENT_NAME=event)["publish"], "false")

    def test_feature_branches_and_unmatched_tags_never_publish(self):
        for ref in ("refs/heads/feature", "refs/tags/preview", "refs/tags/v1"):
            with self.subTest(ref=ref):
                self.assertEqual(self.metadata(GITHUB_REF=ref)["publish"], "false")

    def test_invalid_repository_is_rejected(self):
        for repo in ("", "asharca", "asharca/NodePlane:bad", "asharca/NodePlane\npublish=true"):
            with self.subTest(repo=repo):
                self.assertNotEqual(self.execute(GITHUB_REPOSITORY=repo).returncode, 0)

    def test_invalid_sha_and_registry_are_rejected(self):
        self.assertNotEqual(self.execute(GITHUB_SHA="short").returncode, 0)
        self.assertNotEqual(self.execute(REGISTRY="ghcr.io\npublish=true").returncode, 0)

    def test_invalid_release_tag_is_rejected(self):
        self.assertNotEqual(self.execute(GITHUB_REF="refs/tags/v1.2.3/invalid").returncode, 0)


if __name__ == "__main__":
    unittest.main()
