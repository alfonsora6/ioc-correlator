"""Guard against UTF-16 / BOM / null bytes in versioned config text files.

Windows editors sometimes rewrite files as UTF-16LE (null bytes between ASCII
chars), which breaks Linux install.sh and makes Git treat files as binary.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Config / install paths that must stay UTF-8 without BOM (relative to repo root).
CONFIG_GLOBS = (
    ".env.example",
    "install.sh",
    "docker-compose.yml",
    "Makefile",
    ".gitattributes",
    ".editorconfig",
    ".gitignore",
    "scripts/*.sh",
    "*.md",
    "backend/**/*.md",
    "obsidian/**/*.md",
)

UTF16_LE_BOM = b"\xff\xfe"
UTF16_BE_BOM = b"\xfe\xff"
UTF8_BOM = b"\xef\xbb\xbf"


def _iter_config_files() -> list[Path]:
    found: set[Path] = set()
    for pattern in CONFIG_GLOBS:
        if any(ch in pattern for ch in "*?[]"):
            for path in REPO_ROOT.glob(pattern):
                if path.is_file():
                    found.add(path.resolve())
        else:
            path = REPO_ROOT / pattern
            if path.is_file():
                found.add(path.resolve())
    return sorted(found)


def test_versioned_config_files_are_utf8_without_utf16_or_nulls():
    files = _iter_config_files()
    assert files, f"No config files matched under {REPO_ROOT}"

    problems: list[str] = []
    for path in files:
        rel = path.relative_to(REPO_ROOT).as_posix()
        data = path.read_bytes()
        if not data:
            continue
        if data.startswith(UTF16_LE_BOM):
            problems.append(f"{rel}: starts with UTF-16LE BOM")
            continue
        if data.startswith(UTF16_BE_BOM):
            problems.append(f"{rel}: starts with UTF-16BE BOM")
            continue
        if data.startswith(UTF8_BOM):
            problems.append(f"{rel}: starts with UTF-8 BOM (expected UTF-8 without BOM)")
            continue
        if b"\x00" in data:
            problems.append(f"{rel}: contains null bytes (likely UTF-16)")
            continue
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as exc:
            problems.append(f"{rel}: not valid UTF-8 ({exc})")

    assert not problems, "Encoding problems:\n" + "\n".join(problems)
