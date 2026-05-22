from typing import Any

import httpx

from app.services.aggregate import severity_from_score
from app.services.intel_clients import _score_from_vt_stats

VT_BASE = "https://www.virustotal.com/api/v3"
VT_DIRECT_MAX_BYTES = 32 * 1024 * 1024
VT_ABSOLUTE_MAX_BYTES = 650 * 1024 * 1024


class VtFileError(Exception):
    def __init__(self, code: str, message: str = "", status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message or code)


def vt_headers(api_key: str) -> dict[str, str]:
    if "." in api_key or len(api_key) > 80:
        return {"Authorization": f"Bearer {api_key}"}
    return {"x-apikey": api_key}


def _parse_engine_results(results: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not results:
        return []
    engines: list[dict[str, Any]] = []
    for name, entry in results.items():
        if not isinstance(entry, dict):
            continue
        engines.append(
            {
                "engine": name,
                "category": entry.get("category") or "undetected",
                "result": entry.get("result"),
                "method": entry.get("method"),
            }
        )
    engines.sort(key=lambda e: (e["category"] != "malicious", e["category"] != "suspicious", e["engine"]))
    return engines


def _pick_filename(attrs: dict[str, Any], filename: str | None = None) -> str | None:
    if filename:
        return filename
    if attrs.get("meaningful_name"):
        return str(attrs["meaningful_name"])
    names = attrs.get("names")
    if isinstance(names, list) and len(names) > 0:
        return str(names[0])
    return None


def format_file_report(
    sha256: str,
    attrs: dict[str, Any],
    *,
    filename: str | None = None,
    analysis_id: str | None = None,
) -> dict[str, Any]:
    stats = attrs.get("last_analysis_stats") or attrs.get("stats") or {}
    results = attrs.get("last_analysis_results") or attrs.get("results") or {}
    score = _score_from_vt_stats(stats)
    malicious = int(stats.get("malicious", 0) or 0)
    suspicious = int(stats.get("suspicious", 0) or 0)
    undetected = int(stats.get("undetected", 0) or 0)
    harmless = int(stats.get("harmless", 0) or 0)
    total_engines = malicious + suspicious + undetected + harmless + int(stats.get("timeout", 0) or 0)

    return {
        "sha256": sha256,
        "filename": _pick_filename(attrs, filename),
        "analysis_id": analysis_id,
        "score": score,
        "severity": severity_from_score(score),
        "stats": {
            "malicious": malicious,
            "suspicious": suspicious,
            "undetected": undetected,
            "harmless": harmless,
            "total": total_engines,
        },
        "detections": f"{malicious + suspicious}/{total_engines}" if total_engines else "0/0",
        "engines": _parse_engine_results(results if isinstance(results, dict) else None),
        "provider": "virustotal",
    }


def _vt_error_message(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        err = body.get("error")
        if isinstance(err, dict) and err.get("message"):
            return str(err["message"])
        if isinstance(body.get("message"), str):
            return body["message"]
    except Exception:
        pass
    text = (resp.text or "").strip()
    return text[:300] if text else f"VirusTotal HTTP {resp.status_code}"


async def _handle_vt_response(resp: httpx.Response) -> dict[str, Any]:
    if resp.status_code == 429:
        raise VtFileError("rate_limit", "VirusTotal rate limit exceeded", 429)
    if resp.status_code == 404:
        raise VtFileError("not_found", status_code=404)
    if resp.status_code >= 400:
        raise VtFileError("vt_error", _vt_error_message(resp), resp.status_code)
    return resp.json()


def _sha256_from_analysis_attrs(attrs: dict[str, Any]) -> str | None:
    meta = attrs.get("meta")
    if isinstance(meta, dict):
        file_info = meta.get("file_info")
        if isinstance(file_info, dict) and file_info.get("sha256"):
            return str(file_info["sha256"]).lower()
    if isinstance(attrs.get("sha256"), str):
        return attrs["sha256"].lower()
    return None


async def lookup_file(api_key: str, sha256: str) -> dict[str, Any]:
    sha256 = sha256.lower().strip()
    headers = vt_headers(api_key)
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.get(f"{VT_BASE}/files/{sha256}", headers=headers)
            if resp.status_code == 404:
                return {"found": False, "sha256": sha256}
            data = await _handle_vt_response(resp)
            attrs = data.get("data", {}).get("attributes", {})
            report = format_file_report(sha256, attrs)
            report["found"] = True
            report["status"] = "completed"
            return report
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise VtFileError("rate_limit", status_code=429) from e
            if e.response.status_code == 404:
                return {"found": False, "sha256": sha256}
            raise VtFileError("vt_error", str(e.response.status_code), e.response.status_code) from e


async def upload_file(api_key: str, content: bytes, filename: str) -> dict[str, Any]:
    if len(content) > VT_ABSOLUTE_MAX_BYTES:
        raise VtFileError("file_too_large", "File exceeds VirusTotal maximum size (650 MB)", 413)
    if len(content) == 0:
        raise VtFileError("empty_file", "Empty file", 400)

    headers = vt_headers(api_key)
    upload_name = filename or "upload.bin"
    mime = "application/zip" if upload_name.lower().endswith(".zip") else "application/octet-stream"
    file_part = (upload_name, content, mime)

    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            if len(content) <= VT_DIRECT_MAX_BYTES:
                resp = await client.post(
                    f"{VT_BASE}/files",
                    headers=headers,
                    files={"file": file_part},
                )
            else:
                url_resp = await client.get(f"{VT_BASE}/files/upload_url", headers=headers)
                upload_data = await _handle_vt_response(url_resp)
                upload_url = upload_data.get("data")
                if not upload_url or not isinstance(upload_url, str):
                    raise VtFileError("vt_error", "Invalid upload URL from VirusTotal", 502)
                resp = await client.post(
                    upload_url,
                    headers=headers,
                    files={"file": file_part},
                )

            body = await _handle_vt_response(resp)
            analysis_id = body.get("data", {}).get("id")
            if not analysis_id:
                raise VtFileError("vt_error", "No analysis id in upload response", 502)
            return {
                "analysis_id": analysis_id,
                "sha256": None,
                "status": "queued",
                "found": False,
            }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise VtFileError("rate_limit", status_code=429) from e
            raise VtFileError("vt_error", _vt_error_message(e.response), e.response.status_code) from e


async def get_analysis(api_key: str, analysis_id: str, *, sha256: str | None = None, filename: str | None = None) -> dict[str, Any]:
    headers = vt_headers(api_key)
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.get(f"{VT_BASE}/analyses/{analysis_id}", headers=headers)
            body = await _handle_vt_response(resp)
            attrs = body.get("data", {}).get("attributes", {})
            status = (attrs.get("status") or "queued").lower()

            if status != "completed":
                return {
                    "analysis_id": analysis_id,
                    "status": status,
                    "found": False,
                    "sha256": sha256,
                }

            stats = attrs.get("stats") or {}
            results = attrs.get("results") or {}
            file_sha = (sha256 or _sha256_from_analysis_attrs(attrs) or "").lower() or None

            if file_sha and (not stats or not results):
                lookup = await lookup_file(api_key, file_sha)
                if lookup.get("found"):
                    lookup["analysis_id"] = analysis_id
                    lookup["filename"] = filename or lookup.get("filename")
                    lookup["status"] = "completed"
                    return lookup

            report = format_file_report(
                file_sha or analysis_id,
                {"last_analysis_stats": stats, "last_analysis_results": results},
                filename=filename,
                analysis_id=analysis_id,
            )
            report["found"] = True
            report["status"] = "completed"
            return report
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise VtFileError("rate_limit", status_code=429) from e
            raise VtFileError("vt_error", _vt_error_message(e.response), e.response.status_code) from e
