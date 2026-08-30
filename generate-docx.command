#!/bin/zsh
set -e
SCRIPT_DIR="${0:A:h}"
BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
BUNDLED_MODULES="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"

if [[ -x "$BUNDLED_NODE" && -d "$BUNDLED_MODULES" ]]; then
  export NODE_PATH="$BUNDLED_MODULES"
  NODE_BIN="$BUNDLED_NODE"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "Node.js não foi encontrado. Instale Node.js 20 ou superior."
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 sessao.json [saida.docx]"
  exit 1
fi

exec "$NODE_BIN" "$SCRIPT_DIR/cli/generate-docx.cjs" "$@"
