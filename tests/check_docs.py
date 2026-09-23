"""Validate local documentation links and README screenshots without network access."""
from pathlib import Path
import re
import struct
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
DOCS = [ROOT / 'README.md', ROOT / 'docs/testing.md', ROOT / 'frontend/README.md']
count = 0
for doc in DOCS:
    text = doc.read_text(encoding='utf-8')
    links = re.findall(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', text)
    links += re.findall(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\']', text)
    for link in links:
        parsed = urllib.parse.urlsplit(link)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        target = (doc.parent / urllib.parse.unquote(parsed.path)).resolve()
        if not target.is_relative_to(ROOT) or not target.exists():
            raise SystemExit(f'Broken local documentation link: {doc.relative_to(ROOT)} -> {link}')
        count += 1

screenshots = ['workspace-light', 'workspace-dark', 'login-light', 'workspace-mobile', 'create-group-dialog', 'settings-small-mobile']
for name in screenshots:
    file = ROOT / 'docs/screenshots' / f'{name}.png'
    data = file.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        raise SystemExit(f'Invalid PNG screenshot: {file.name}')
    width, height = struct.unpack('>II', data[16:24])
    if width < 300 or height < 300:
        raise SystemExit(f'Screenshot unexpectedly small: {file.name}: {width}x{height}')
    print(f'PNG OK {file.name}: {width}x{height}')

readme = (ROOT / 'README.md').read_text(encoding='utf-8')
if '测试数据' not in readme or 'REST API Starter' in readme:
    raise SystemExit('README must describe NodePlane and label its demonstration data')
print(f'Documentation OK: {count} local references and {len(screenshots)} permanent screenshots')
