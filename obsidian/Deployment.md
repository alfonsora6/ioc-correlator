---
tags: [deployment, docker, installation, devops]
---

# Deployment Guide

## Prerequisites

- Docker >= 24.x
- Docker Compose >= 2.x
- Git

## Quick Start (Docker)

```bash
git clone https://github.com/YOUR_USER/ioc-correlator.git
cd ioc-correlator
cp .env.example .env
# Edit .env with your values
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Manual Setup (Development)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## Related Notes

- [[Architecture]]
- [[Roadmap]]
