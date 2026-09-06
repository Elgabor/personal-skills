#!/usr/bin/env python3
"""Check the explicit public path list and common accidental private content."""
from pathlib import Path
import json, re, subprocess, sys

root = Path(__file__).resolve().parents[1]
allowed = set(json.loads((root / "public-files.json").read_text())["files"])
result = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root, check=True, capture_output=True)
visible = set(result.stdout.decode().strip("\0").split("\0")) - {""}
errors = ["Unlisted path: " + p for p in sorted(visible - allowed)]
for name in sorted(allowed):
    path = root / name
    if Path(name).is_absolute() or ".." in Path(name).parts:
        errors.append("Invalid manifest path")
        continue
    if any(part.startswith(".env") or part in {"memories", "sessions", "chats", ".codex", ".claude", ".pi"} for part in Path(name).parts) or path.suffix in {".pem", ".key", ".p12", ".pfx", ".db"}:
        errors.append("Private path: " + name)
        continue  # Never inspect possible credential files.
    if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):
        errors.append("Missing, linked, or escaped path: " + name)
        continue
    content = path.read_bytes()
    if len(content) > 2_000_000:
        errors.append("File needs manual size review: " + name)
        continue
    # Report paths only, never print matched content.
    patterns = [rb"/Users/[a-zA-Z][a-zA-Z0-9._-]*/", rb"/home/[a-zA-Z][a-zA-Z0-9._-]*/", rb"-----BEGIN [A-Z ]*PRIVATE KEY-----", rb"gh[pousr]_[A-Za-z0-9]{30,}", rb"sk-[A-Za-z0-9_-]{30,}"]
    if any(re.search(pattern, content) for pattern in patterns):
        errors.append("Potential private content: " + name)
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"Publication preflight passed: {len(allowed)} explicitly listed files. Manual diff/license review still required.")
