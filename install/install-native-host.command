#!/bin/zsh
set -e
APP_DIR="${0:A:h:h}"
HOST_NAME="com.chronoclick.recorder"
HOST_PATH="$APP_DIR/native-host/native-host.command"
EXTENSION_ID="jlfmfpdjanjbjbmhgefhmgpnnabjiiho"
CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"

chmod +x "$HOST_PATH" "$APP_DIR/generate-docx.command"
mkdir -p "$CHROME_DIR" "$EDGE_DIR"

manifest="{\"name\":\"$HOST_NAME\",\"description\":\"Host local do ChronoClick Recorder\",\"path\":\"$HOST_PATH\",\"type\":\"stdio\",\"allowed_origins\":[\"chrome-extension://$EXTENSION_ID/\"]}"
printf '%s\n' "$manifest" > "$CHROME_DIR/$HOST_NAME.json"
printf '%s\n' "$manifest" > "$EDGE_DIR/$HOST_NAME.json"

echo "Host ChronoClick instalado para Chrome e Edge."
echo "Pasta de projetos: $HOME/sistemas/cronoPrint"
echo "Recarregue a extensão no navegador."
