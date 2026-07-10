"""Entry point for the PyInstaller-frozen binary bundled as the Tauri
desktop app's sidecar (see folium-api/build_sidecar.sh).

Defaults to a local Ollama provider so the bundled API boots with zero setup
(no API key required); drop a `.env` file next to the executable to point it
at a different provider or override any other setting from config.py.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def _executable_dir() -> Path:
    return Path(sys.executable).resolve().parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip()


def main() -> None:
    bundle_dir = _executable_dir()
    # Set before importing app.config (which reads env vars at import time).
    os.environ.setdefault("LLM_PROVIDER", "ollama")
    os.environ.setdefault("STORAGE_DIR", str(bundle_dir / "data"))
    _load_dotenv(bundle_dir / ".env")

    import uvicorn

    from app.main import app

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
