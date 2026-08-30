#!/bin/zsh
set -e
APP_DIR="${0:A:h:h}"
BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
BUNDLED_MODULES="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ -x "$BUNDLED_NODE" && -d "$BUNDLED_MODULES" ]]; then
  export NODE_PATH="$BUNDLED_MODULES"
  exec "$BUNDLED_NODE" "$APP_DIR/native-host/host.cjs"
fi
exec node "$APP_DIR/native-host/host.cjs"
