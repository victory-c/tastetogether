#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export QLOO_ENV_FILE="$PROJECT_ROOT/.env.local"

command -v python3 >/dev/null 2>&1 || {
  echo 'Python 3 is required to run this script.' >&2
  exit 1
}

python3 - <<'PY'
import getpass
import json
import os
import re
import tempfile
from pathlib import Path

path = Path(os.environ['QLOO_ENV_FILE'])
if path.is_symlink():
    raise SystemExit('.env.local is a symlink; remove it first so another file is not overwritten.')
try:
    key = getpass.getpass('Enter your Qloo API key (input is hidden): ').strip()
except (EOFError, KeyboardInterrupt):
    raise SystemExit('\nCancelled. Nothing was saved.')
if not key or any(ord(char) < 32 or ord(char) == 127 for char in key):
    raise SystemExit('The key is empty or contains control characters. Nothing was saved.')

values = {
    'QLOO_API_KEY': key,
    'QLOO_API_URL': 'https://hackathon.api.qloo.com',
}
lines = path.read_text().splitlines() if path.exists() else []
pattern = re.compile(r'^\s*(?:export\s+)?(?:QLOO_API_KEY|QLOO_API_URL)\s*=')
lines = [line for line in lines if not pattern.match(line)]
lines.extend(f'{name}={json.dumps(value)}' for name, value in values.items())
fd, temporary = tempfile.mkstemp(prefix='.env.local.', dir=path.parent)
try:
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(lines) + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Saved to the project .env.local (readable and writable only by you).')
print('If the dev server is running, restart it to load the new key.')
PY
