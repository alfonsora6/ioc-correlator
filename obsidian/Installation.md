---
tags: [installation, install.sh, setup, instalación]
---

# Instalación — resumen

## Script `install.sh`

Ubicación: raíz del repositorio (`/install.sh`).

| Modo | Comando |
|------|---------|
| Instalación completa (manual §3–5) | `./install.sh` |
| Solo app (manual §4–5) | `./install.sh --solo-app` |
| Tras instalar Docker | `newgrp docker` → `./install.sh --solo-app` |

## Qué hace el script

1. Comprueba paquetes apt, Docker y grupo `docker` (instala solo lo que falta)
2. Comprueba `.env` y genera claves si hace falta (`SECRET_KEY`, `ENCRYPTION_KEY` y contraseña aleatoria de Postgres)
3. `docker compose up` (build solo si no están los contenedores)
4. Migraciones Alembic con reintentos
5. Muestra las URLs de acceso y los puertos publicados (5173 y 8000, solo en `127.0.0.1`). Postgres y Redis no publican puertos

## Si vas a usar dominio (DuckDNS/u otro) con HTTPS

1. Añade el dominio a `frontend/vite.config.ts` en `preview.allowedHosts`.
2. Reconstruye frontend: `docker compose up -d --build frontend`.
3. Configura Nginx como proxy y conserva el header Host (`proxy_set_header Host $host;`).
4. Valida Nginx (`nginx -t`) y recarga.

Si no se hace el paso 1, el navegador muestra:
`Blocked request. This host ("...") is not allowed.`

## Codificación de ficheros

El proyecto se mantiene en **UTF-8**. La conversión masiva UTF-16 → UTF-8 (Windows) ya no forma parte del manual ni del instalador.

## Documentación extendida

- `MANUAL-INSTALACION.md` — guía paso a paso y API keys de proveedores
- [[Deployment]] — despliegue Docker y desarrollo local
- [[Development-Log]] — historial de cambios del proyecto

## Notas relacionadas

- [[Deployment]]
- [[Architecture]]
