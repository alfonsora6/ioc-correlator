# IOC Correlator

> Threat Intelligence platform that correlates IPs, domains, URLs and hashes against VirusTotal, AbuseIPDB, Shodan and AlienVault OTX. Multi-tenant, with PDF export and batch analysis.

## Features

- Multi-tenant authentication (register / login / JWT)
- Single IOC analysis: auto-detect IP / domain / URL / hash
- Parallel queries to VirusTotal, AbuseIPDB, Shodan, AlienVault OTX
- Aggregate threat score (0-100) with LOW / MEDIUM / HIGH / CRITICAL severity
- Batch analysis: upload .txt / .csv / .log files, auto-extract all IOCs
- Real-time progress via WebSocket
- API key management with OAuth (VirusTotal) and validation
- Threat dashboard: counters, charts, world map, history
- PDF export with tenant name and UTC timestamp
- Obsidian knowledge vault included (open /obsidian/ as vault)
- Dark/light mode, glassmorphism design, fully responsive

## Prerequisites

- Docker >= 24.x and Docker Compose >= 2.x
- OR: Python >= 3.11, Node.js >= 20, pnpm, PostgreSQL 16, Redis 7

## Quick Start (Docker — recommended)

`ash
git clone https://github.com/YOUR_USER/ioc-correlator.git
cd ioc-correlator
cp .env.example .env
# Open .env and fill in SECRET_KEY at minimum (docker-compose provides a dev ENCRYPTION_KEY default)
docker compose up --build
`

Open http://localhost:5173 — register your account and start analyzing IOCs.

## Manual Setup

### Backend

`ash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
`

### Celery Worker (for batch analysis)

`ash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
`

### Frontend

`ash
cd frontend
pnpm install
pnpm dev
`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SECRET_KEY | YES | Random secret for JWT signing (min 32 chars) |
| DATABASE_URL | YES | PostgreSQL async URL |
| REDIS_URL | YES | Redis URL |
| ENCRYPTION_KEY | YES (dev default in compose) | Base64-encoded Fernet key |
| VT_CLIENT_ID | NO | VirusTotal OAuth App client ID |
| VT_CLIENT_SECRET | NO | VirusTotal OAuth App client secret |
| VT_REDIRECT_URI | NO | OAuth callback URL |
| ACCESS_TOKEN_EXPIRE_MINUTES | NO | Default: 15 |
| REFRESH_TOKEN_EXPIRE_DAYS | NO | Default: 7 |

## API Documentation

Once the backend is running, visit: http://localhost:8000/docs

## Obsidian Knowledge Vault

Open Obsidian and choose **Open folder as vault** for the /obsidian/ folder inside this project.

## Contributing

Pull requests are welcome. Please open an issue first to discuss changes.

## License

MIT
