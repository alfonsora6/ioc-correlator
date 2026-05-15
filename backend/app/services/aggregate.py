from typing import Any

WEIGHTS: dict[str, float] = {
    "virustotal": 0.4,
    "abuseipdb": 0.3,
    "shodan": 0.2,
    "otx": 0.1,
}


def severity_from_score(score: int) -> str:
    if score <= 25:
        return "LOW"
    if score <= 50:
        return "MEDIUM"
    if score <= 75:
        return "HIGH"
    return "CRITICAL"


def aggregate_scores(provider_results: list[dict[str, Any]]) -> tuple[int, str]:
    """Renormalize weights over providers that returned a numeric score."""
    num = 0.0
    den = 0.0
    for r in provider_results:
        if not r.get("available"):
            continue
        if r.get("score") is None:
            continue
        p = str(r.get("provider"))
        w = WEIGHTS.get(p)
        if w is None:
            continue
        num += float(r["score"]) * w
        den += w
    if den <= 0:
        return 0, "LOW"
    score = int(round(num / den))
    score = max(0, min(100, score))
    return score, severity_from_score(score)


def per_source_severity(provider_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in provider_results:
        item = dict(r)
        if r.get("available") and r.get("score") is not None:
            item["severity"] = severity_from_score(int(r["score"]))
        else:
            item["severity"] = "LOW"
        out.append(item)
    return out
