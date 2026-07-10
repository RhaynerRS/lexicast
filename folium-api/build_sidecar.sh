#!/usr/bin/env bash
# Builds the folium-api sidecar binary consumed by the Tauri desktop app.
#
# Run this once before `npm run tauri build` (or `npm run tauri dev`) inside
# folium-ui/ so folium-ui/src-tauri/binaries/folium-api-<target-triple>
# exists for Tauri to bundle/spawn. Re-run whenever folium-api changes.
#
# Builds inside a python:3.12-slim container (same base as folium-api's own
# Dockerfile) rather than a local venv, since epub-translator doesn't yet
# support the newest CPython and the host's system Python may be too new.
set -euo pipefail
cd "$(dirname "$0")"

docker run --rm \
  -v "$(pwd):/build" \
  -w /build \
  python:3.12-slim \
  bash -c '
    set -euo pipefail
    apt-get update -qq && apt-get install -y -qq --no-install-recommends binutils
    pip install --no-cache-dir --quiet -r requirements.txt pyinstaller
    pyinstaller \
      --onefile \
      --name folium-api \
      --distpath dist \
      --workpath build \
      --specpath build \
      --collect-all epub_translator \
      --hidden-import uvicorn.logging \
      --hidden-import uvicorn.loops.auto \
      --hidden-import uvicorn.protocols.http.auto \
      --hidden-import uvicorn.protocols.websockets.auto \
      --hidden-import uvicorn.lifespan.on \
      sidecar_main.py
  '

TARGET_TRIPLE="$(rustc --print host-tuple)"
OUT_DIR="../folium-ui/src-tauri/binaries"
mkdir -p "$OUT_DIR"

cp "dist/folium-api" "$OUT_DIR/folium-api-${TARGET_TRIPLE}"
chmod +x "$OUT_DIR/folium-api-${TARGET_TRIPLE}"

echo "Sidecar binary ready: $OUT_DIR/folium-api-${TARGET_TRIPLE}"
