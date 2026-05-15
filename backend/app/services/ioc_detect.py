import ipaddress
import re
from urllib.parse import urlparse

_HASH_MD5 = re.compile(r"^[a-fA-F0-9]{32}$")
_HASH_SHA1 = re.compile(r"^[a-fA-F0-9]{40}$")
_HASH_SHA256 = re.compile(r"^[a-fA-F0-9]{64}$")
_DOMAIN_LIKE = re.compile(
    r"^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$"
)


def detect_ioc(raw: str) -> tuple[str, str]:
    """Return (ioc_type, normalized_value). Types: hash, ip, url, domain."""
    s = raw.strip()
    if not s:
        raise ValueError("Empty IOC")

    if _HASH_MD5.match(s) or _HASH_SHA1.match(s) or _HASH_SHA256.match(s):
        return "hash", s.lower()

    if s.lower().startswith(("http://", "https://")):
        return "url", s

    try:
        ipaddress.ip_address(s)
        return "ip", s
    except ValueError:
        pass

    host = s
    if "/" in s:
        parsed = urlparse(f"//{s}" if "://" not in s else s)
        host = parsed.hostname or s.split("/")[0]

    if host and _DOMAIN_LIKE.match(host):
        return "domain", host.lower()

    if "/" in s or "." in s:
        return "url", s if "://" in s else f"http://{s}"

    raise ValueError("Could not detect IOC type")


def extract_iocs_from_text(text: str) -> list[str]:
    found: set[str] = set()
    for pattern in (
        r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b",
        r"\b(?:[a-fA-F0-9]{1,4}:){2,7}[a-fA-F0-9]{1,4}\b",
        r"\b[a-fA-F0-9]{32}\b",
        r"\b[a-fA-F0-9]{40}\b",
        r"\b[a-fA-F0-9]{64}\b",
        r"https?://[^\s\"'<>]+",
        r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b",
    ):
        for m in re.finditer(pattern, text):
            val = m.group(0)
            if len(val) > 2040:
                continue
            found.add(val)
    return list(found)
