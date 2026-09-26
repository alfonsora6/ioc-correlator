---
tags: [api, integrations, virustotal, abuseipdb, shodan, otx, integraciones]
---

# Integraciones API

## VirusTotal

- Endpoint: `GET https://www.virustotal.com/api/v3/ip_addresses/{ip}`
- Endpoint: `GET https://www.virustotal.com/api/v3/domains/{domain}`
- Endpoint: `GET https://www.virustotal.com/api/v3/files/{hash}`
- Autenticación: cabecera `x-apikey` o `Authorization: Bearer` (token OAuth)
- Límite de tasa: depende del plan (p. ej. 4 req/min en plan gratuito)
- Campos usados: `last_analysis_stats`, `reputation`, `country`, `as_owner`
- Obtener clave: [Cuenta VirusTotal](https://www.virustotal.com/gui/join-us) → [Mi API key](https://www.virustotal.com/gui/my-apikey)

## AbuseIPDB

- Endpoint: `GET https://api.abuseipdb.com/api/v2/check`
- Autenticación: cabecera `Key`
- Límite: ~1000 req/día (plan gratuito)
- Campos usados: `abuseConfidenceScore`, `countryCode`, `isp`, `totalReports`
- Obtener clave: [Cuenta y API](https://www.abuseipdb.com/account/api)

## Shodan

- Endpoint: `GET https://api.shodan.io/shodan/host/{ip}`
- Autenticación: parámetro `key` en la URL
- Límite: ~1 req/seg
- Campos usados: `ports`, `vulns`, `org`, `country_name`, `os`
- Obtener clave: [Registro](https://account.shodan.io/register) → [Cuenta](https://account.shodan.io/)

## AlienVault OTX

- Endpoint: `GET https://otx.alienvault.com/api/v1/indicators/IPv4/{ip}/general` (y variantes por tipo)
- Autenticación: cabecera `X-OTX-API-KEY`
- Campos usados: `pulse_info.count`, `reputation`, `country_name`
- Obtener clave: [Registro](https://otx.alienvault.com/user/sign_up) → [Ajustes](https://otx.alienvault.com/settings)

## Lógica de agregación

- Cada fuente devuelve una puntuación normalizada 0-100.
- Puntuación final = media ponderada: VT (40%) + AbuseIPDB (30%) + Shodan (20%) + OTX (10%).
- Si falta un proveedor, se **renormalizan** los pesos sobre las fuentes disponibles.
- Mapeo de severidad: 0-25 LOW | 26-50 MEDIUM | 51-75 HIGH | 76-100 CRITICAL

## Caché Redis

- Clave: `ioc:{tenant_id}:{tipo}:{valor_normalizado}`
- TTL: 3600 segundos (1 hora)
- Reduce llamadas duplicadas y respeta cuotas de los proveedores
- **No se cachea** el resultado cuando el tenant no tiene ninguna clave API (`no_api_key` en las 4 fuentes): es estado de configuración, no threat intel
- Si hay al menos una fuente consultada, sí se cachea el payload completo (incluidas entradas `no_api_key` de fuentes no configuradas)
- Al **upsert o delete** de una clave API del tenant se invalida toda su caché IOC con `SCAN` sobre `ioc:{tenant_id}:*` (`invalidate_tenant_cache` en `redis_cache.py`)
- Código: `backend/app/services/correlation.py`, `redis_cache.py`, `api/api_keys.py`

## Notas relacionadas

- [[Architecture]]
- [[Database-Schema]]
