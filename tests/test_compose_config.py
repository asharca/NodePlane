"""Validate the real Compose model; no live database or third-party packages."""
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SERVICES = ('auth', 'subscription', 'checker', 'scheduler', 'notify', 'settings')
ENV = {**os.environ, 'DB_USER': 'volume_test', 'DB_PASSWORD': 'ci-config-only',
       'JWT_SECRET': 'ci-config-only-jwt', 'REGISTER_INVITE_CODE': 'ci-config-only-invite',
       'NODEPLANE_IMAGE_PREFIX': 'ghcr.io/asharca/nodeplane', 'SUBS_CHECK_IMAGE_TAG': 'test'}


def config(env=ENV):
    return subprocess.run(['docker', 'compose', '--env-file', '/dev/null', '-f', str(ROOT / 'docker-compose.yml'),
                           'config', '--format', 'json'], env=env, capture_output=True, text=True, timeout=15)


class ComposeVolumeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = config()
        if result.returncode:
            raise AssertionError(result.stderr)
        cls.model = json.loads(result.stdout)
        cls.svc = cls.model['services']

    def test_postgres_major_and_correct_persistent_path(self):
        self.assertEqual(self.svc['postgres']['image'], 'postgres:17-alpine')
        self.assertEqual(self.svc['postgres']['volumes'][0]['source'], 'postgres_data')
        self.assertEqual(self.svc['postgres']['volumes'][0]['target'], '/var/lib/postgresql/data')
        self.assertEqual(self.svc['postgres']['volumes'][0]['type'], 'volume')

    def test_project_scoped_named_volumes(self):
        self.assertIn('postgres_data', self.model['volumes'])
        self.assertIn('nsq_data', self.model['volumes'])
        self.assertFalse(self.model['volumes']['postgres_data'].get('external', False))

    def test_no_repository_bind_mounts(self):
        for service in self.svc.values():
            self.assertTrue(all(v['type'] == 'volume' for v in service.get('volumes', [])))

    def test_database_and_queue_are_not_published(self):
        for name in ('postgres', 'nsq', 'migrator'):
            self.assertFalse(self.svc[name].get('ports'))
            self.assertEqual(set(self.svc[name]['networks']), {'data'})
        self.assertTrue(self.model['networks']['data']['internal'])

    def test_dependencies_fail_closed(self):
        self.assertEqual(self.svc['migrator']['depends_on']['postgres']['condition'], 'service_healthy')
        self.assertEqual(self.svc['backend']['depends_on']['migrator']['condition'], 'service_completed_successfully')
        self.assertEqual(self.svc['backend']['depends_on']['postgres']['condition'], 'service_healthy')

    def test_three_images_use_the_same_version(self):
        for name, suffix in [('backend', ''), ('frontend', '-frontend'), ('migrator', '-migrator')]:
            self.assertEqual(self.svc[name]['image'], 'ghcr.io/asharca/nodeplane' + suffix + ':test')

    def test_required_credentials_are_checked(self):
        for key in ('DB_PASSWORD', 'JWT_SECRET', 'REGISTER_INVITE_CODE'):
            with self.subTest(key=key):
                env = {**ENV, key: ''}
                result = config(env)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(key, result.stderr)

    def test_username_defaults_consistently(self):
        result = config({**ENV, 'DB_USER': ''})
        self.assertEqual(result.returncode, 0, result.stderr)
        svc = json.loads(result.stdout)['services']
        self.assertEqual(svc['postgres']['environment']['POSTGRES_USER'], 'nodeplane')
        for name in ('backend', 'migrator'):
            self.assertEqual(svc[name]['environment']['DB_USER'], 'nodeplane')

    def test_stale_external_db_host_cannot_override_internal_service(self):
        result = config({**ENV, 'DB_HOST': 'legacy.invalid:5432'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('legacy.invalid', result.stdout)
        infra = json.loads((ROOT / 'deploy/infra.config.json').read_text())
        self.assertEqual(infra['sql_servers'][0]['host'], 'postgres:5432')
        self.assertEqual(set(infra['sql_servers'][0]['databases']), set(SERVICES))

    def test_migrator_has_no_startup_download_or_unsafe_repair(self):
        text = (ROOT / 'deploy/migrate.sh').read_text()
        for fragment in ('wget ', 'curl ', 'apk ', 'migrate force', 'migrate drop'):
            self.assertNotIn(fragment, text)
        self.assertNotIn('${DB_PASSWORD}@', text)
        self.assertIn('PGPASSWORD="$DB_PASSWORD"', text)

    def test_all_service_migrations_are_in_the_image(self):
        text = (ROOT / 'deploy/migrator.Dockerfile').read_text()
        for name in SERVICES:
            self.assertIn(f'COPY services/{name}/migrations/ /migrations/{name}/', text)

    def test_migrator_metadata_uses_the_normalized_repository(self):
        env = {**os.environ, 'GITHUB_REPOSITORY': 'Asharca/NodePlane',
               'GITHUB_SHA': '985026b027cfac4383646ad85c32b84a3149bd8d',
               'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REF': 'refs/pull/9/merge'}
        result = subprocess.run(['bash', str(ROOT / '.github/scripts/image-metadata.sh')],
                                env=env, capture_output=True, text=True, timeout=5, check=True)
        values = dict(line.split('=', 1) for line in result.stdout.splitlines())
        self.assertEqual(values['migrator_image'], 'ghcr.io/asharca/nodeplane-migrator')
        self.assertEqual(values['publish'], 'false')

    def test_no_legacy_database_ip_in_runtime_configuration(self):
        for name in ('docker-compose.yml', 'deploy/infra.config.json', 'deploy/migrate.sh', '.env.example'):
            self.assertNotIn('10.0.10.114', (ROOT / name).read_text())


if __name__ == '__main__':
    unittest.main()
