#!/bin/bash
# Turns on the LLM agent steps (vibe → Qloo tags, "why you'll both love it" copy) with YOUR Anthropic key.
# 1. reads the key with a hidden prompt and checks it with Anthropic (a free model lookup, no tokens);
# 2. saves it to the project .env.local for local dev;
# 3. optionally adds it to Vercel production as a Secret and redeploys, then runs one live match to confirm.
# The key is never printed, logged or passed as a command-line argument.
set -euo pipefail

SCOPE='victory-c-8190s-projects'
PROJECT='tastetogether'
PROD_URL='https://tastetogether.vercel.app'
MODEL="${ANTHROPIC_MODEL:-claude-haiku-5-5}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# Works from the main checkout or a worktree: .env.local lives in the main checkout.
GIT_COMMON="$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir)"
ENV_FILE="$(dirname -- "$GIT_COMMON")/.env.local"

for cmd in curl python3; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "$cmd is required to run this script." >&2
    exit 1
  }
done

read -rsp 'Paste your Anthropic API key (input is hidden): ' KEY || {
  echo
  echo 'Cancelled. Nothing was saved.' >&2
  exit 1
}
echo
KEY="${KEY//[[:space:]]/}"
if [[ ! "$KEY" =~ ^sk-ant-[A-Za-z0-9_-]+$ ]]; then
  echo 'That does not look like an Anthropic API key (it should start with sk-ant-). Nothing was saved.' >&2
  exit 1
fi

echo "Checking the key with Anthropic (model lookup, no tokens used)…"
status="$(printf 'x-api-key: %s\nanthropic-version: 2023-06-01\n' "$KEY" |
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H @- "https://api.anthropic.com/v1/models/$MODEL" || true)"
case "$status" in
  200) echo "  ✓ The key works and can use $MODEL." ;;
  401 | 403)
    echo "  ✗ Anthropic rejected the key (HTTP $status). Nothing was saved." >&2
    exit 1
    ;;
  404)
    echo "  ✗ The key works, but $MODEL is not available to it. Nothing was saved." >&2
    exit 1
    ;;
  *)
    echo "  ✗ Could not reach Anthropic to check the key (HTTP ${status:-none}). Nothing was saved." >&2
    exit 1
    ;;
esac

TT_KEY="$KEY" TT_ENV_FILE="$ENV_FILE" python3 - <<'PY'
import os
import re
import tempfile
from pathlib import Path

path = Path(os.path.realpath(os.environ['TT_ENV_FILE']))
lines = path.read_text().splitlines() if path.exists() else []
pattern = re.compile(r'^\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=')
lines = [line for line in lines if not pattern.match(line)]
lines.append(f'ANTHROPIC_API_KEY="{os.environ["TT_KEY"]}"')
fd, temporary = tempfile.mkstemp(prefix='.env.local.', dir=path.parent)
try:
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(lines) + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print(f'  ✓ Saved to {path} (readable only by you). Restart `npm run dev` if it is running.')
PY

read -rp 'Also add it to Vercel production and redeploy the live site? [Y/n] ' answer || answer=n
if [[ "$answer" =~ ^[Nn] ]]; then
  echo 'Done. Only local dev uses the key; the live site still uses fact templates.'
  exit 0
fi

command -v vercel >/dev/null 2>&1 || {
  echo 'The Vercel CLI is required for this step (brew install vercel-cli, then vercel login).' >&2
  exit 1
}

echo 'Adding ANTHROPIC_API_KEY to Vercel production (stored as a Secret)…'
printf '%s' "$KEY" | vercel env add ANTHROPIC_API_KEY production --sensitive --force --scope "$SCOPE" --project "$PROJECT"
unset KEY

echo 'Redeploying production so the new variable takes effect (about a minute)…'
# Capture the whole output first: piping into an early-exiting awk SIGPIPEs the CLI, which pipefail turns into a silent exit.
inspect="$(vercel inspect "$PROD_URL" --scope "$SCOPE" 2>&1)" || true
deployment="$(awk '$1 == "id" { print $2; exit }' <<<"$inspect")"
if [[ -z "$deployment" ]]; then
  echo "  ✗ Could not find the current production deployment. Redeploy from the Vercel dashboard instead." >&2
  exit 1
fi
vercel redeploy "$deployment" --target production --scope "$SCOPE" || {
  echo "  ✗ The redeploy failed. The key is saved; redeploy from the Vercel dashboard to apply it." >&2
  exit 1
}

echo 'Running one live match (Maya & Leo, vibe "cozy, not too loud") to confirm…'
curl -s -N -X POST "$PROD_URL/api/match" -H 'content-type: application/json' --max-time 60 --data @- <<'JSON' |
{"a":{"name":"Maya","interests":[{"id":"4BBEF799-A0C4-4110-AB01-39216993C312","name":"Taylor Swift","kind":"artist"},{"id":"A1407445-5676-4874-B796-3D81FDA62468","name":"Pride & Prejudice","kind":"movie"},{"id":"4C60FF74-A236-4488-8FB3-2FE43D1C79FB","name":"Gilmore Girls","kind":"tv_show"}]},"b":{"name":"Leo","interests":[{"id":"C915A918-39C5-47A3-A101-D9FA1DECBD9C","name":"Kendrick Lamar","kind":"artist"},{"id":"878A5D45-469C-4556-8494-963C2B1D3A95","name":"Dune: Part Two","kind":"movie"},{"id":"4C305B2F-5A46-4885-A6DA-5E22D11E86E0","name":"The Bear","kind":"tv_show"}]},"occasion":"date","priceMax":null,"mode":"three","vibe":"cozy, not too loud"}
JSON
  python3 -c '
import json, sys
llm = vibe = None
picks = []
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    event = json.loads(line)
    kind = event.get("type")
    if kind == "vibe":
        vibe = event.get("source")
    elif kind == "result":
        llm = (event.get("stats") or {}).get("llm")
        picks = [p.get("name") for p in event.get("picks") or []]
    elif kind == "narration":
        llm = event.get("llm")
    elif kind == "error" or "error" in event:
        sys.exit("  ✗ The match failed: " + str(event.get("message") or event.get("error")))
print("  picks:", ", ".join(picks[:3]) or "none")
print("  vibe read by:", "the LLM agent" if vibe == "agent" else "keyword fallback")
if llm and llm not in ("fallback", "pending"):
    print("  ✓ Explanations written by", llm, "- the LLM is live.")
elif llm in ("fallback", "pending"):
    sys.exit("  ✗ The site sees the key, but the LLM call failed, so it fell back to templates. Check the key in the Anthropic Console.")
else:
    sys.exit("  ✗ The live site does not see the key yet. Wait a minute and open " + "https://tastetogether.vercel.app/match?demo=maya-leo&go=1")
'
