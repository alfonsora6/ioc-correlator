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
2. Comprueba `.env` y genera claves si hace falta
3. `docker compose up` (build solo si no están los contenedores)
4. Migraciones Alembic con reintentos
5. Muestra IP del servidor y puertos 5173 / 8000 / 5432 / 6379

## Codificación de ficheros

El proyecto se mantiene en **UTF-8**. La conversión masiva UTF-16 → UTF-8 (Windows) ya no forma parte del manual ni del instalador.

## Documentación extendida

- `MANUAL-INSTALACION.md` — guía paso a paso y API keys de proveedores
- [[Deployment]] — despliegue Docker y desarrollo local
- [[Development-Log]] — historial de cambios del proyecto

## Notas relacionadas

- [[Deployment]]
- [[Architecture]]
