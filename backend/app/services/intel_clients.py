import base64
import ipaddress
from typing import Any
from urllib.parse import quote

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.services.ioc_detect import detect_ioc


def _retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(exc, (httpx.ConnectError, httpx.ReadTimeout))


@retry(
    retry=retry_if_exception(_retryable),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def _get(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
) -> httpx.Response:
    r = await client.get(url, headers=headers or {}, params=params)
    r.raise_for_status()
    return r


def _vt_url_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode()).decode().strip("=")


def _score_from_vt_stats(stats: dict[str, Any]) -> int:
    malicious = int(stats.get("malicious", 0) or 0)
    suspicious = int(stats.get("suspicious", 0) or 0)
    undetected = int(stats.get("undetected", 0) or 0)
    total = malicious + suspicious + undetected + int(stats.get("harmless", 0) or 0)
    if total <= 0:
        return 0
    return min(100, int(round(100 * (malicious * 1.0 + suspicious * 0.5) / max(total, 1))))


async def query_virustotal(api_key: str, ioc_raw: str) -> dict[str, Any]:
    try:
        ioc_type, value = detect_ioc(ioc_raw)
    except ValueError as e:
        return {"provider": "virustotal", "available": False, "error": str(e), "score": None}

    if "." in api_key or len(api_key) > 80:
        headers = {"Authorization": f"Bearer {api_key}"}
    else:
        headers = {"x-apikey": api_key}
    async with httpx.AsyncClient(timeout=45.0) as client:
        if ioc_type == "ip":
            url = f"https://www.virustotal.com/api/v3/ip_addresses/{value}"
        elif ioc_type == "domain":
            url = f"https://www.virustotal.com/api/v3/domains/{value}"
        elif ioc_type == "hash":
            url = f"https://www.virustotal.com/api/v3/files/{value}"
        elif ioc_type == "url":
            uid = _vt_url_id(value)
            url = f"https://www.virustotal.com/api/v3/urls/{uid}"
        else:
            return {"provider": "virustotal", "available": False, "error": "unsupported", "score": None}

        try:
            resp = await _get(client, url, headers)
            data = resp.json().get("data", {})
            attrs = data.get("attributes", {})
            stats = attrs.get("last_analysis_stats", {}) or {}
            score = _score_from_vt_stats(stats)
            return {
                "provider": "virustotal",
                "available": True,
                "score": score,
                "raw": {
                    "last_analysis_stats": stats,
                    "reputation": attrs.get("reputation"),
                    "country": attrs.get("country"),
                    "as_owner": attrs.get("as_owner"),
                },
            }
        except httpx.HTTPStatusError as e:
            return {
                "provider": "virustotal",
                "available": False,
                "error": str(e.response.status_code),
                "score": None,
            }


async def query_abuseipdb(api_key: str, ioc_raw: str) -> dict[str, Any]:
    try:
        ioc_type, value = detect_ioc(ioc_raw)
    except ValueError as e:
        return {"provider": "abuseipdb", "available": False, "error": str(e), "score": None}

    if ioc_type != "ip":
        return {"provider": "abuseipdb", "available": False, "error": "ip_only", "score": None}

    headers = {"Key": api_key, "Accept": "application/json"}
    params = {"ipAddress": value, "maxAgeInDays": "90"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await _get(client, "https://api.abuseipdb.com/api/v2/check", headers, params)
            data = r.json().get("data", {})
            score = int(data.get("abuseConfidenceScore") or 0)
            return {
                "provider": "abuseipdb",
                "available": True,
                "score": min(100, max(0, score)),
                "raw": {
                    "abuseConfidenceScore": score,
                    "countryCode": data.get("countryCode"),
                    "isp": data.get("isp"),
                    "totalReports": data.get("totalReports"),
                },
            }
        except httpx.HTTPStatusError as e:
            return {"provider": "abuseipdb", "available": False, "error": str(e.response.status_code), "score": None}


async def query_shodan(api_key: str, ioc_raw: str) -> dict[str, Any]:
    try:
        ioc_type, value = detect_ioc(ioc_raw)
    except ValueError as e:
        return {"provider": "shodan", "available": False, "error": str(e), "score": None}

    if ioc_type != "ip":
        return {"provider": "shodan", "available": False, "error": "ip_only", "score": None}

    url = f"https://api.shodan.io/shodan/host/{value}"
    params = {"key": api_key}
    async with httpx.AsyncClient(timeout=40.0) as client:
        try:
            r = await _get(client, url, params=params)
            data = r.json()
            ports = data.get("ports") or []
            vulns = data.get("vulns") or []
            if isinstance(vulns, dict):
                vuln_len = len(vulns)
            else:
                vuln_len = len(vulns) if isinstance(vulns, list) else 0
            base = min(40, len(ports) * 3)
            vuln_bonus = min(60, vuln_len * 10)
            score = min(100, base + vuln_bonus)
            return {
                "provider": "shodan",
                "available": True,
                "score": score,
                "raw": {
                    "ports": ports[:50],
                    "vulns": list(vulns.keys())[:20] if isinstance(vulns, dict) else vulns[:20] if isinstance(vulns, list) else vulns,
                    "org": data.get("org"),
                    "country_name": data.get("country_name"),
                    "os": data.get("os"),
                },
            }
        except httpx.HTTPStatusError as e:
            return {"provider": "shodan", "available": False, "error": str(e.response.status_code), "score": None}


def _otx_path(ioc_type: str, value: str) -> str | None:
    if ioc_type == "ip":
        try:
            ipaddress.ip_address(value)
        except ValueError:
            return None
        fam = ipaddress.ip_address(value).version
        section = "IPv6" if fam == 6 else "IPv4"
        return f"https://otx.alienvault.com/api/v1/indicators/{section}/{value}/general"
    if ioc_type == "domain":
        return f"https://otx.alienvault.com/api/v1/indicators/domain/{value}/general"
    if ioc_type == "url":
        return f"https://otx.alienvault.com/api/v1/indicators/url/{quote(value, safe='')}/general"
    if ioc_type == "hash":
        return f"https://otx.alienvault.com/api/v1/indicators/file/{value}/general"
    return None


async def query_otx(api_key: str, ioc_raw: str) -> dict[str, Any]:
    try:
        ioc_type, value = detect_ioc(ioc_raw)
    except ValueError as e:
        return {"provider": "otx", "available": False, "error": str(e), "score": None}

    path = _otx_path(ioc_type, value)
    if not path:
        return {"provider": "otx", "available": False, "error": "unsupported", "score": None}

    headers = {"X-OTX-API-KEY": api_key}
    async with httpx.AsyncClient(timeout=35.0) as client:
        try:
            r = await _get(client, path, headers)
            data = r.json()
            pulse = (data.get("pulse_info") or {}).get("count") or 0
            reputation = int(data.get("reputation") or 0)
            score = min(100, int(pulse) * 5 + max(0, reputation))
            return {
                "provider": "otx",
                "available": True,
                "score": score,
                "raw": {
                    "pulse_count": pulse,
                    "reputation": reputation,
                    "country_name": data.get("country_name"),
                },
            }
        except httpx.HTTPStatusError as e:
            return {"provider": "otx", "available": False, "error": str(e.response.status_code), "score": None}
