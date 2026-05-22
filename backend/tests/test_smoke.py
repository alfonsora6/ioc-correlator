from app.services.aggregate import aggregate_scores, severity_from_score
from app.services.ioc_detect import detect_ioc, extract_iocs_from_text


def test_detect_ip():
    t, v = detect_ioc("8.8.8.8")
    assert t == "ip"
    assert v == "8.8.8.8"


def test_detect_hash_md5():
    h = "d41d8cd98f00b204e9800998ecf8427e"
    t, v = detect_ioc(h)
    assert t == "hash"
    assert v == h


def test_extract_iocs():
    text = "Contact 8.8.8.8 and evil.com and d41d8cd98f00b204e9800998ecf8427e"
    xs = extract_iocs_from_text(text)
    assert "8.8.8.8" in xs
    assert "evil.com" in xs


def test_aggregate_renormalizes_weights():
    rows = [
        {"provider": "virustotal", "available": True, "score": 100},
        {"provider": "abuseipdb", "available": True, "score": 0},
        {"provider": "shodan", "available": False, "score": None},
        {"provider": "otx", "available": False, "score": None},
    ]
    score, sev = aggregate_scores(rows)
    assert score > 0
    assert sev in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_severity_mapping():
    assert severity_from_score(10) == "LOW"
    assert severity_from_score(40) == "MEDIUM"
    assert severity_from_score(60) == "HIGH"
    assert severity_from_score(90) == "CRITICAL"
