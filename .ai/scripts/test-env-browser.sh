#!/bin/sh
# om-prepare-test-env: the agent-browser command of the test environment (.ai/browsers/agent-browser.md).
# history:
#   2026-10-27 generated: TMPDIR=/tmp, because a long TMPDIR makes Chrome's singleton socket path
#              too long; --no-sandbox, because Ubuntu 23.10+ blocks the unprivileged user
#              namespaces of Chrome's sandbox (Playwright launches Chromium the same way)
set -eu
BIN=$(command -v agent-browser 2>/dev/null ||
  find "${XDG_CACHE_HOME:-$HOME/.cache}/agent-tools/agent-browser/v0.35.2" -name "agent-browser-*" -type f 2>/dev/null | head -1)
[ -n "$BIN" ] || { echo "agent-browser is not installed (.ai/browsers/agent-browser.md)" >&2; exit 1; }
export TMPDIR=/tmp
export AGENT_BROWSER_ARGS="${AGENT_BROWSER_ARGS:---no-sandbox}"
exec "$BIN" "$@"
