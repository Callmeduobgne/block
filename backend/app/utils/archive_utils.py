"""Utility helpers for handling archived chaincode source packages."""
from __future__ import annotations

import base64
import io
import os
import tarfile
import zipfile
import shutil
from typing import Iterable, Optional


ARCHIVE_PREFIXES = {
    "ARCHIVE_TGZ": "tgz",
    "ARCHIVE_TAR_GZ": "tgz",
    "ARCHIVE_ZIP": "zip",
}


def is_archive_source(source: str) -> bool:
    if not source:
        return False
    return any(source.startswith(prefix + ":") for prefix in ARCHIVE_PREFIXES)


def _decode_payload(source: str) -> tuple[str, bytes]:
    try:
        prefix, data = source.split(":", 1)
    except ValueError as exc:
        raise ValueError("Invalid archive payload format") from exc

    if prefix not in ARCHIVE_PREFIXES:
        raise ValueError(f"Unsupported archive prefix: {prefix}")

    try:
        decoded = base64.b64decode(data)
    except Exception as exc:  # pylint: disable=broad-except
        raise ValueError("Archive payload is not valid base64") from exc

    return ARCHIVE_PREFIXES[prefix], decoded


def extract_archive_source(source: str, destination: str, clean: bool = True) -> None:
    archive_type, payload = _decode_payload(source)

    if clean and os.path.exists(destination):
        shutil.rmtree(destination)

    os.makedirs(destination, exist_ok=True)

    stream = io.BytesIO(payload)
    if archive_type == "tgz":
        with tarfile.open(fileobj=stream, mode="r:gz") as tar:
            tar.extractall(destination)
    elif archive_type == "zip":
        with zipfile.ZipFile(stream) as zip_file:
            zip_file.extractall(destination)
    else:  # pragma: no cover - defensive clause
        raise ValueError(f"Unsupported archive type: {archive_type}")


def find_first_source_file(
    root: str,
    extensions: Iterable[str],
    preferred_dirs: Optional[Iterable[str]] = None,
) -> Optional[str]:
    ext_set = tuple(ext.lower() for ext in extensions)

    bases = []
    if preferred_dirs:
        for sub in preferred_dirs:
            candidate = os.path.join(root, sub)
            if os.path.isdir(candidate):
                bases.append(candidate)
    if not bases:
        bases = [root]

    for base in bases:
        for current_root, dirs, files in os.walk(base):
            # Skip node_modules or other heavy vendor directories
            dirs[:] = [d for d in dirs if d not in {"node_modules", "vendor", "__pycache__"}]

            for filename in files:
                lower = filename.lower()
                if any(lower.endswith(ext) for ext in ext_set):
                    if "contract" in lower:
                        return os.path.join(current_root, filename)
                    return os.path.join(current_root, filename)

    return None

