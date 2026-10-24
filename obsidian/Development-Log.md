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
- `DATABASE_URL` del manual alineado con `docker-compose.yml` (nota posterior: ya no hay contraseña por defecto, ver sesión 009)

## Sesión 006 — Dominio + HTTPS en VPS

- Caso real de despliegue detrás de Nginx con dominio público (`duckdns`)
- Añadida guía de `preview.allowedHosts` para Vite preview en `MANUAL-INSTALACION.md`
- `install.sh` ahora recuerda pasos de dominio: `allowedHosts`, rebuild de frontend y recarga de Nginx
- Bóveda actualizada en [[Installation]] y [[Deployment]] con checklist y síntoma del bloqueo de host

## Sesión 007 — Caché IOC + JWT access 30 min

- **Bug de caché:** `run_correlation` ya no guarda en Redis el resultado cuando no hay ninguna clave API (`if not tasks` / `no_api_key`)
- Con al menos una fuente real sí se cachea el agregado completo
- **Invalidación:** `upsert_key` / `delete_key` llaman a `invalidate_tenant_cache` (SCAN `ioc:{tenant_id}:*`)
- Tests en `backend/tests/test_correlation_cache.py`
- Access token JWT: default `ACCESS_TOKEN_EXPIRE_MINUTES` de 15 → **30** (`config.py`, `.env.example`, manual); refresh sigue en 7 días
- Bóveda: [[Auth-Flow]], [[API-Integrations]], [[Architecture]]

## Sesión 008 — `pnpm-lock.yaml` del frontend

- Generado `frontend/pnpm-lock.yaml` (`lockfileVersion: '9.0'`) con **pnpm@9.15.0** vía `corepack pnpm` (misma versión que `frontend/Dockerfile`)
- En Windows, `corepack enable` puede fallar por EPERM en `Program Files`; usar `corepack prepare pnpm@9.15.0` + `corepack pnpm install` en `frontend/`
- `package.json` no se modificó

## Sesión 009 — Correcciones de documentación (2026-10-24)

- Solo documentación; sin cambios en código, tests, `docker-compose.yml`, `install.sh` ni dependencias
- `README.md` reescrito: Shodan figura como implementado pero no verificado (sin licencia de pago); instalación, uso, tests, seguridad y limitaciones
- `CHANGELOG.md`: entrada 1.0.0
- `MANUAL-INSTALACION.md`: eliminada la contraseña de ejemplo por defecto, `POSTGRES_*` en el `.env`, URLs en `127.0.0.1`, nota sobre Shodan y pie de página reformulado
- Bóveda: [[Roadmap]] (Shodan pendiente de licencia), [[API-Integrations]], [[Architecture]], [[Deployment]], [[Installation]] y [[Auth-Flow]] alineadas con el estado real (puertos de Postgres y Redis no publicados, sin credenciales por defecto, rate limiting en Redis)

## Sesión 010 — Tests, valores seguros y configuración de pytest (2026-10-24)

- Tests nuevos en `backend/tests/`: `test_ioc_detect.py` (RF-03), `test_batch_extraction.py` (RF-07) y `test_tenant_isolation.py` (RF-12), más `conftest.py` con un `SECRET_KEY` de prueba
- `config.py`: `SECRET_KEY` obligatoria (sin `changeme`) y `DATABASE_URL` por defecto con un marcador inválido (host `.invalid`)
- `install.sh`: la contraseña histórica `iocpass` solo se conserva en instalaciones antiguas con volumen `pgdata` existente, con aviso
- `backend/pytest.ini` define `asyncio_default_fixture_loop_scope = function` (sin aviso de pytest-asyncio)
- Resultado esperado de la suite en el contenedor: 66 passed, 2 skipped (`test_repo_encoding.py` necesita el repositorio completo y el aislamiento del panel necesita `TEST_DATABASE_URL`)

## Sesión 011 — Validación de IOC y script de verificación (2026-10-24)

- `detect_ioc`: las entradas con solo dígitos y puntos que no son IPs válidas (`999.999.999.999`, `256.1.1.1`, `1.2.3`) lanzan `ValueError("Could not detect IOC type")` en lugar de clasificarse como URL; test parametrizado en `test_ioc_detect.py`
- `scripts/verify-deploy.sh`: email de prueba con dominio `example.com` (antes `test.local`, rechazado por el backend con 422 por ser un dominio reservado)
- Suite esperada en el contenedor: 69 passed, 2 skipped

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
