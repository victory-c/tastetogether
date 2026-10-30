#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export QLOO_ENV_FILE="$PROJECT_ROOT/.env.local"

command -v python3 >/dev/null 2>&1 || {
  echo '需要 Python 3 才能运行此脚本。' >&2
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
    raise SystemExit('为避免覆盖其他文件，请先移除 .env.local 的符号链接。')
try:
    key = getpass.getpass('请输入 Qloo API key（输入不会显示）：').strip()
except (EOFError, KeyboardInterrupt):
    raise SystemExit('\n已取消，未保存。')
if not key or any(ord(char) < 32 or ord(char) == 127 for char in key):
    raise SystemExit('Key 为空或含有控制字符，未保存。')

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
print('已保存到项目 .env.local（仅当前用户可读写）。')
print('如果开发服务正在运行，请重启以加载新配置。')
PY
