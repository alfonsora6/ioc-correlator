---
tags: [api, integrations, virustotal, abuseipdb, shodan, otx]
---

# API Integrations

## VirusTotal

- Endpoint: `GET https://www.virustotal.com/api/v3/ip_addresses/{ip}`
- Endpoint: `GET https://www.virustotal.com/api/v3/domains/{domain}`
- Endpoint: `GET https://www.virustotal.com/api/v3/files/{hash}`
- Auth: `x-apikey` or `Authorization: Bearer` for OAuth tokens
- Rate limit: varies by plan
- Response fields used: `last_analysis_stats`, `reputation`, `country`, `as_owner`

## AbuseIPDB

- Endpoint: `GET https://api.abuseipdb.com/api/v2/check`
- Auth: Header `Key`
- Response fields used: `abuseConfidenceScore`, `countryCode`, `isp`, `totalReports`

## Shodan

- Endpoint: `GET https://api.shodan.io/shodan/host/{ip}`
- Auth: Query param `key`
- Response fields used: `ports`, `vulns`, `org`, `country_name`, `os`

## AlienVault OTX

- Endpoint: `GET https://otx.alienvault.com/api/v1/indicators/IPv4/{ip}/general` (and variants)
- Auth: Header `X-OTX-API-KEY`
- Response fields used: `pulse_info.count`, `reputation`, `country_name`

## Aggregation Logic

- Each source returns a normalized score 0-100
- Final score = weighted average: VT (40%) + AbuseIPDB (30%) + Shodan (20%) + OTX (10%), renormalized if sources are missing
- Severity mapping: 0-25 LOW | 26-50 MEDIUM | 51-75 HIGH | 76-100 CRITICAL

## Related Notes

- [[Architecture]]
- [[Database-Schema]]
