#!/usr/bin/env python3
"""Real, destructive-to-fixtures-only Compose regression; never uses a user project.

Build/load the three images first. This always creates a random np-volume-ci-*
project and removes ONLY that project's containers and volumes in finally.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/compose'
SERVICES = ('auth', 'subscription', 'checker', 'scheduler', 'notify', 'settings')


def main() -> None:
    if os.environ.get('NODEPLANE_COMPOSE_TEST_DISPOSABLE') != '1':
        raise SystemExit('Refusing: set NODEPLANE_COMPOSE_TEST_DISPOSABLE=1 for disposable CI only')
    prefix = os.environ.get('NODEPLANE_IMAGE_PREFIX')
    tag = os.environ.get('SUBS_CHECK_IMAGE_TAG')
    if not prefix or not tag or tag == 'latest':
        raise SystemExit('Provide exact, already-built image prefix and immutable test tag (not latest)')
    project = 'np-volume-ci-' + secrets.token_hex(6)
    OUT.mkdir(parents=True, exist_ok=True)
    checks: list[str] = []
    password = "CI-only:@/%?=&+'\\" + secrets.token_hex(12)
    env = {**os.environ, 'DB_USER': 'volume_owner', 'DB_PASSWORD': password,
           'JWT_SECRET': secrets.token_hex(32), 'REGISTER_INVITE_CODE': secrets.token_hex(16),
           'BASE_URL': 'http://localhost/api', 'COMPOSE_PROJECT_NAME': project,
           'COMPOSE_IGNORE_ORPHANS': 'true'}
    for key in ('COMPOSE_FILE', 'COMPOSE_PROFILES', 'DOCKER_CONTEXT', 'DB_HOST'):
        env.pop(key, None)
    # Only the production Compose file and an image/published-port override exist
    # in this directory; /deploy and /services are intentionally NOT mounted.
    temp = Path(tempfile.mkdtemp(prefix=project + '-'))
    shutil.copy2(ROOT / 'docker-compose.yml', temp / 'compose.yml')
    (temp / 'override.yml').write_text('''services:
  migrator:
    pull_policy: never
  backend:
    pull_policy: never
  frontend:
    pull_policy: never
    ports: !override
      - "127.0.0.1::3000"
''')
    base = ['docker', 'compose', '--env-file', '/dev/null', '--project-directory', str(temp),
            '-p', project, '-f', str(temp / 'compose.yml'), '-f', str(temp / 'override.yml')]

    def run(args: list[str], *, check: bool = True, timeout: int = 120) -> subprocess.CompletedProcess:
        result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
        # No real secrets or tokens are used by this isolated harness.
        with (OUT / 'commands.log').open('a') as log:
            log.write('$ ' + ' '.join(args).replace(password, '[REDACTED]') + '\n')
            log.write((result.stdout + result.stderr).replace(password, '[REDACTED]') + '\n')
        if check and result.returncode:
            raise AssertionError(f'Command failed (exit {result.returncode}): {args[:4]}; see commands.log')
        return result

    def dc(*args: str, **kwargs) -> subprocess.CompletedProcess:
        return run([*base, *args], **kwargs)

    def sql(database: str, query: str) -> str:
        return dc('exec', '-T', 'postgres', 'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
                  '-U', env['DB_USER'], '-d', database, '-c', query).stdout.strip()

    def state(service: str) -> dict:
        cid = dc('ps', '--all', '--quiet', service).stdout.strip()
        return json.loads(run(['docker', 'inspect', cid]).stdout)[0] if cid else {}

    def passed(name: str) -> None:
        checks.append(name)
        print('PASS ' + name, flush=True)
        (OUT / 'report.json').write_text(json.dumps({'project': project, 'checks': checks,
                                                     'completed': False}, indent=2) + '\n')

    origin = ''

    def request(method: str, path: str, data=None, token: str | None = None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(origin + '/api' + path,
                                     data=None if data is None else json.dumps(data).encode(),
                                     headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read())

    def start_stack() -> None:
        nonlocal origin
        dc('up', '-d', timeout=150)
        origin = 'http://' + dc('port', 'frontend', '3000').stdout.strip()
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen(origin + '/login', timeout=3) as response:
                    assert response.status == 200
                try:
                    request('GET', '/auth/me')
                except urllib.error.HTTPError as error:
                    if error.code == 401:
                        return
            except (OSError, AssertionError):
                pass
            time.sleep(1)
        raise AssertionError('Frontend + real backend did not become ready within 60 seconds')

    try:
        dc('config', '--quiet')
        dc('up', '-d', '--wait', 'postgres', 'nsq', timeout=150)
        dc('run', '--rm', 'migrator', timeout=150)
        for service in SERVICES:
            files = (ROOT / 'services' / service / 'migrations').glob('*.up.sql')
            expected = max(int(re.match(r'(\d+)', p.name)[1]) for p in files)
            assert sql(service, 'SELECT version FROM schema_migrations') == str(expected), service
            assert sql(service, 'SELECT dirty FROM schema_migrations') == 'f', service
        passed('fresh volume creates and migrates all six databases at expected versions')
        passed('migration authenticates with literal reserved characters in password, on internal-only network')

        dc('run', '--rm', 'migrator')
        passed('repeated initialization and up migrations are idempotent')

        bad = dc('run', '--rm', '-e', 'DB_PASSWORD=deliberately-wrong', 'migrator', check=False)
        assert bad.returncode != 0, 'Wrong password must fail'
        assert 'All migrations complete' not in bad.stdout
        passed('wrong password fails without reporting successful migration')

        # Fault injection is strictly inside the random disposable project.
        sql('auth', 'UPDATE schema_migrations SET dirty = true')
        blocked = dc('up', '-d', 'backend', check=False)
        assert blocked.returncode != 0, 'Dirty migration must block Compose startup'
        assert not state('backend').get('State', {}).get('Running', False)
        assert sql('auth', 'SELECT dirty FROM schema_migrations') == 't'
        passed('dirty migration blocks backend and is not automatically forced or cleared')
        sql('auth', 'UPDATE schema_migrations SET dirty = false')
        dc('rm', '-sf', 'migrator')
        start_stack()
        passed('production images start through actual Compose with no repository bind mounts')

        login_params = {'username': 'volume_test', 'password': secrets.token_hex(16), 'remember': False}
        account = request('POST', '/auth/register', {**login_params, 'invite_code': env['REGISTER_INVITE_CODE']})
        login = request('POST', '/auth/login', login_params)
        assert login['user_id'] == account['user_id']
        group = request('POST', '/subscriptions', {'kind': 'node', 'name': 'Persistent volume fixture', 'url': ''}, login['token'])
        assert group['id']
        passed('real frontend API proxy registers, logs in and writes an owned group')

        mounts = state('postgres')['Mounts']
        volume = next(m['Name'] for m in mounts if m['Destination'] == '/var/lib/postgresql/data')
        assert volume.startswith(project + '_'), 'Never operate on a pre-existing user volume'
        dc('down', '--timeout', '20')  # Deliberately NO --volumes here.
        run(['docker', 'volume', 'inspect', volume])
        start_stack()
        assert any(m.get('Name') == volume for m in state('postgres')['Mounts'])
        again = request('POST', '/auth/login', login_params)
        assert again['user_id'] == account['user_id']
        groups = request('GET', '/subscriptions', token=again['token'])['subscriptions']
        assert any(g['id'] == group['id'] for g in groups)
        passed('down/up recreates containers while retaining account and group on the same named volume')

        for service in SERVICES:
            assert sql(service, 'SELECT dirty FROM schema_migrations') == 'f'
        passed('all six migration ledgers remain clean after container recreation')
        (OUT / 'report.json').write_text(json.dumps({'project': project, 'checks': checks,
                                                   'passed': len(checks), 'completed': True}, indent=2) + '\n')
    except Exception as error:
        (OUT / 'report.json').write_text(json.dumps({'project': project, 'checks': checks,
                                                   'completed': False, 'error': str(error)}, indent=2) + '\n')
        raise
    finally:
        try:
            try:
                dc('logs', '--no-color', check=False, timeout=30)
            except (OSError, subprocess.TimeoutExpired):
                pass
            # The random prefix and immutable image requirement are enforced above.
            dc('down', '--volumes', '--remove-orphans', '--timeout', '10', check=False, timeout=60)
        finally:
            shutil.rmtree(temp, ignore_errors=True)


if __name__ == '__main__':
    main()
