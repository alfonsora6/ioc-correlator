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

## Sesión 005 — Instalador y UTF-8

- Script `install.sh` en la raíz: automatiza apt, Docker, `.env`, Compose y migraciones
- **Sesión 005b** — Corrección `install.sh`: CRLF, `sudo docker`, repo Ubuntu/Debian, conflicto `docker.io`, `.env` con Python, espera a backend antes de Alembic
- `MANUAL-INSTALACION.md` actualizado: sección de instalación automática; eliminados pasos UTF-16
- Repositorio unificado en UTF-8 (sin `iconv` / `dos2unix` en el flujo de instalación)
- Nota [[Installation]] y [[Deployment]] ampliados en esta bóveda
- `DATABASE_URL` del manual alineado con `docker-compose.yml` (`iocuser:iocpass`)

## Sesión 006 — Dominio + HTTPS en VPS

- Caso real de despliegue detrás de Nginx con dominio público (`duckdns`)
- Añadida guía de `preview.allowedHosts` para Vite preview en `MANUAL-INSTALACION.md`
- `install.sh` ahora recuerda pasos de dominio: `allowedHosts`, rebuild de frontend y recarga de Nginx
- Bóveda actualizada en [[Installation]] y [[Deployment]] con checklist y síntoma del bloqueo de host

## Cómo retomar el trabajo

1. Abre esta bóveda en Obsidian
2. Lee este archivo para ver el último estado
3. Consulta [[Architecture]] para el panorama general
4. Si tocas modelos, revisa [[Database-Schema]]
5. En Linux: `chmod +x install.sh && ./install.sh` o `docker compose up -d` si ya está configurado

## Notas relacionadas

- [[Installation]]
- [[Deployment]]
- [[Architecture]]
- [[Roadmap]]
