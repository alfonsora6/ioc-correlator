# IOC Correlator

> Plataforma de inteligencia de amenazas que correlaciona IPs, dominios, URLs y hashes contra VirusTotal, AbuseIPDB, Shodan y AlienVault OTX. Multi-tenant, con exportación PDF y análisis por lotes.

## Características

- Autenticación multi-tenant (registro / inicio de sesión / JWT)
- Análisis de IOC individual: detección automática de IP / dominio / URL / hash
- Consultas en paralelo a VirusTotal, AbuseIPDB, Shodan y AlienVault OTX
- Puntuación agregada de amenaza (0-100) con severidad LOW / MEDIUM / HIGH / CRITICAL
- Análisis por lotes: subida de archivos `.txt` / `.csv` / `.log` con extracción automática de IOCs
- Progreso en tiempo real vía WebSocket
- Gestión de claves API con OAuth (VirusTotal) y validación
- Panel de amenazas: contadores, gráficos, orígenes geográficos e historial
- Exportación PDF con nombre del tenant y marca de tiempo UTC
- Bóveda de conocimiento Obsidian incluida (abrir la carpeta `/obsidian/` como vault)
- Modo oscuro/claro, diseño glassmorphism y diseño responsive

## Requisitos previos

- Docker >= 24.x y Docker Compose >= 2.x
- O bien: Python >= 3.11, Node.js >= 20, pnpm, PostgreSQL 16, Redis 7

## Inicio rápido (Docker — recomendado)

```bash
git clone https://github.com/alfonsora6/ioc-correlator.git
cd ioc-correlator
cp .env.example .env
# Edita .env y rellena SECRET_KEY como mínimo (docker-compose incluye ENCRYPTION_KEY de desarrollo por defecto)
docker compose up --build
```

Abre http://localhost:5173 — regístrate y empieza a analizar IOCs.

## Instalación manual

### Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Worker Celery (análisis por lotes)

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

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| SECRET_KEY | SÍ | Secreto aleatorio para firmar JWT (mín. 32 caracteres) |
| DATABASE_URL | SÍ | URL async de PostgreSQL |
| REDIS_URL | SÍ | URL de Redis |
| ENCRYPTION_KEY | SÍ (valor por defecto en compose en dev) | Clave Fernet en base64 |
| VT_CLIENT_ID | NO | ID de cliente OAuth de VirusTotal |
| VT_CLIENT_SECRET | NO | Secreto OAuth de VirusTotal |
| VT_REDIRECT_URI | NO | URL de callback OAuth |
| ACCESS_TOKEN_EXPIRE_MINUTES | NO | Por defecto: 15 |
| REFRESH_TOKEN_EXPIRE_DAYS | NO | Por defecto: 7 |

## Documentación de la API

Con el backend en ejecución, visita: http://localhost:8000/docs

## Bóveda Obsidian

En Obsidian, elige **Abrir carpeta como bóveda** y selecciona la carpeta `/obsidian/` dentro de este proyecto. Usa la vista de grafo para navegar entre notas enlazadas.

## Cumplimiento de proveedores

Debes cumplir los términos de uso y límites de cuota de **VirusTotal**, **AbuseIPDB**, **Shodan** y **OTX**. Las claves API son responsabilidad de cada tenant.

## Contribuir

Las pull requests son bienvenidas. Abre primero un issue para discutir cambios importantes.

## Licencia

MIT
