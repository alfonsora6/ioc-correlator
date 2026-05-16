---
tags: [log, progress, decisions, desarrollo]
---

# Registro de desarrollo

## Sesión 001 — Inicio del proyecto

- Estructura de carpetas backend / frontend / obsidian
- Docker Compose con postgres, redis, backend, celery y frontend
- Esqueleto FastAPI con endpoint de salud
- Modelos SQLAlchemy y migración Alembic inicial

## Sesión 002 — Autenticación

- Registro e inicio de sesión
- JWT de acceso + cookie httpOnly de refresco
- Aislamiento multi-tenant por `tenant_id`

## Sesión 003 — Integraciones

- Cliente VirusTotal (API key + OAuth)
- Clientes AbuseIPDB, Shodan y OTX
- Lógica de agregación y severidad

## Sesión 004 — MVP completo

- Frontend con panel, análisis, lotes, claves API, informes y ajustes
- Documentación en español y enlaces a registro de proveedores

## Cómo retomar el trabajo

1. Abre esta bóveda en Obsidian
2. Lee este archivo para ver el último estado
3. Consulta [[Architecture]] para el panorama general
4. Si tocas modelos, revisa [[Database-Schema]]
5. Ejecuta: `docker compose up -d` y `cd frontend && pnpm dev`

## Notas relacionadas

- [[Architecture]]
- [[Roadmap]]
