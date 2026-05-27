---
tags: [deployment, docker, installation, devops, despliegue]
---

# Guía de despliegue

## Requisitos previos

- Debian 12 / Ubuntu 22.04+ (recomendado) o Linux con Docker
- Docker >= 24.x
- Docker Compose >= 2.x
- Git
- `python3-cryptography` (para generar `ENCRYPTION_KEY`)

Todos los ficheros del repositorio están en **UTF-8** (sin pasos de conversión desde UTF-16).

## Instalación automática (recomendado)

Desde la raíz del proyecto en Linux:

```bash
chmod +x install.sh
./install.sh
```

El script ejecuta **literalmente** los comandos de las secciones 3–5 de `MANUAL-INSTALACION.md` (sin lógica adicional).

Tras instalar Docker, si hace falta: `newgrp docker` y `./install.sh --solo-app`.

**Solo app** (secciones 4–5 del manual):

```bash
./install.sh --solo-app
```

**Clonar desde GitHub e instalar:**

```bash
git clone https://github.com/alfonsora6/ioc-correlator.git
cd ioc-correlator
chmod +x install.sh
./install.sh
```

Ver también: `MANUAL-INSTALACION.md` en la raíz del repo.

## Inicio rápido manual (Docker)

```bash
git clone https://github.com/alfonsora6/ioc-correlator.git
cd ioc-correlator
cp .env.example .env   # o deja que install.sh lo cree
# Genera SECRET_KEY y ENCRYPTION_KEY (ver manual)
docker compose up --build -d
docker compose exec backend alembic upgrade head
```

| Servicio   | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:5173        |
| API        | http://localhost:8000        |
| Documentación OpenAPI | http://localhost:8000/docs |

## Servicios en Docker Compose

- **postgres** — base de datos principal (`iocuser` / `iocpass` / `iocdb`)
- **redis** — caché y broker Celery
- **backend** — API FastAPI (uvicorn)
- **celery** — worker para análisis por lotes
- **frontend** — Vite en modo desarrollo

## Dominio + HTTPS (Nginx)

Cuando el frontend se ejecuta con `pnpm preview`, Vite bloquea hosts no permitidos.

### Checklist

1. Permite el dominio en `frontend/vite.config.ts`:
   - `preview.allowedHosts: ["tu-dominio"]`
2. Reconstruye frontend:
   - `docker compose up -d --build frontend`
3. En Nginx conserva `Host`:
   - `proxy_set_header Host $host;`
4. Verifica y recarga Nginx:
   - `sudo nginx -t && sudo systemctl reload nginx`

### Síntoma típico

- Error en navegador: `Blocked request. This host ("...") is not allowed.`
- Solución: actualizar `preview.allowedHosts` y reconstruir frontend.

## Instalación manual (desarrollo)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Worker Celery

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### PostgreSQL y Redis locales (sin Compose)

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pass postgres:16
docker run -d -p 6379:6379 redis:7
```

## Variables de entorno

| Variable      | Obligatoria | Descripción                          |
|---------------|-------------|--------------------------------------|
| SECRET_KEY    | sí          | Secreto para firmar JWT              |
| DATABASE_URL  | sí          | Cadena async de PostgreSQL           |
| REDIS_URL     | sí          | URL de Redis                         |
| ENCRYPTION_KEY| sí          | Clave Fernet en base64               |
| VT_CLIENT_ID  | no          | OAuth VirusTotal                     |
| VT_CLIENT_SECRET | no       | OAuth VirusTotal                     |

Ejemplo `DATABASE_URL` con Compose:

`postgresql+asyncpg://iocuser:iocpass@postgres:5432/iocdb`

## Solución de problemas frecuentes

- **Fernet key inválida** — regenera `ENCRYPTION_KEY` y `docker compose down && docker compose up -d`
- **Cambios en `.env` no aplican** — no uses `restart`; usa `down` + `up`
- **Migraciones fallan** — espera a Postgres y reintenta `alembic upgrade head`

## Notas relacionadas

- [[Architecture]]
- [[Roadmap]]
- [[Development-Log]]
- [[Installation]]
