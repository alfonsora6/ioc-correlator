#!/usr/bin/env bash
#
# IOC Correlator — instalación con comprobaciones idempotentes
#
set -e

if [[ -f "$0" ]] && grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"
SKIP_SYSTEM=0

# Puertos publicados en el host (docker-compose.yml)
# postgres/redis solo en red interna Docker; acceso vía: docker compose exec ...
PORT_FRONTEND=5173
PORT_BACKEND=8000

log()  { echo "[install] $*"; }
warn() { echo "[install] AVISO: $*" >&2; }
die()  { echo "[install] ERROR: $*" >&2; exit 1; }

usage() {
  cat <<EOF
Uso:
  ./install.sh              Comprueba/instala sistema + despliega la app
  ./install.sh --solo-app   Solo comprobar/desplegar app (sin apt ni Docker)
  ./install.sh --help

Al finalizar muestra las URLs con la IP del servidor y los puertos activos.
Si luego publicas con dominio + HTTPS (Nginx), revisa:
  - MANUAL-INSTALACION.md (sección "Configurar dominio y HTTPS")
  - frontend/vite.config.ts -> preview.allowedHosts=["tu-dominio"]
  - docker compose up -d --build frontend
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --solo-app|--skip-system-setup) SKIP_SYSTEM=1 ;;
    *) die "Opción desconocida: $arg" ;;
  esac
done

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
[[ -f "$PROJECT_DIR/docker-compose.yml" ]] || die "No se encuentra docker-compose.yml en $PROJECT_DIR"

# --- Detección de IP del host ---
get_host_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}')"
  fi
  if [[ -z "$ip" ]]; then
    ip="127.0.0.1"
    warn "No se detectó IP de red; se usa 127.0.0.1"
  fi
  echo "$ip"
}

# --- Docker: comprobar acceso y ejecutar compose ---
docker_ok() {
  docker info >/dev/null 2>&1
}

compose_ok() {
  docker compose version >/dev/null 2>&1
}

dc() {
  (cd "$PROJECT_DIR" && docker compose "$@")
}

dc_sg() {
  sg docker -c "cd '$PROJECT_DIR' && docker compose $(printf '%q ' "$@")"
}

run_dc() {
  if docker_ok && compose_ok; then
    dc "$@"
  elif command -v sg >/dev/null 2>&1 && sg docker -c "docker info" >/dev/null 2>&1; then
    dc_sg "$@"
  else
    return 1
  fi
}

ensure_docker_access() {
  if docker_ok && compose_ok; then
    log "Docker: OK ($(docker --version 2>/dev/null | head -1))"
    return 0
  fi
  if command -v sg >/dev/null 2>&1 && sg docker -c "docker compose version" >/dev/null 2>&1; then
    log "Docker: OK (vía grupo docker con sg)"
    return 0
  fi
  die "Sin acceso a Docker. Ejecuta: newgrp docker   o cierra sesión y vuelve a entrar."
}

# --- Comprobaciones e instalación del sistema ---
pkg_installed() {
  dpkg -l "$1" 2>/dev/null | grep -q '^ii'
}

ensure_apt_packages() {
  local missing=()
  for pkg in git ca-certificates curl gnupg python3 python3-cryptography; do
    pkg_installed "$pkg" || missing+=("$pkg")
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    log "Paquetes base: ya instalados"
    return 0
  fi
  log "Instalando paquetes: ${missing[*]}"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}"
}

docker_ce_installed() {
  pkg_installed docker-ce && command -v docker >/dev/null 2>&1
}

compose_plugin_installed() {
  docker compose version >/dev/null 2>&1 || \
    sg docker -c "docker compose version" >/dev/null 2>&1 2>/dev/null || \
    pkg_installed docker-compose-plugin
}

ensure_docker_installed() {
  if docker_ce_installed && compose_plugin_installed; then
    log "Docker CE + Compose: ya instalados"
    sudo systemctl start docker 2>/dev/null || true
    return 0
  fi

  log "Instalando Docker CE (repositorio bookworm)..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker 2>/dev/null || true
  log "Docker CE + Compose: instalados"
}

ensure_docker_group() {
  if [[ "$EUID" -eq 0 ]]; then
    return 0
  fi
  if id -nG "$USER" 2>/dev/null | grep -qw docker; then
    log "Usuario $USER en grupo docker: OK"
    return 0
  fi
  log "Añadiendo $USER al grupo docker..."
  sudo usermod -aG docker "$USER"
  warn "Grupo docker activo tras 'newgrp docker' o nueva sesión. El script usará 'sg docker' si hace falta."
}

setup_system() {
  log "=== Comprobación del sistema ==="
  if ! command -v sudo >/dev/null 2>&1; then
    die "Se necesita sudo para instalar dependencias."
  fi
  log "Actualizando índices apt..."
  sudo apt-get update -qq
  ensure_apt_packages
  ensure_docker_installed
  ensure_docker_group
}

# --- .env (UTF-8 sin BOM; valores con @ : / = entre comillas para Docker Compose v2) ---
write_env_with_python() {
  local target="$1"
  local regen_secrets="${2:-1}"
  python3 - "$target" "$regen_secrets" <<'PY'
import re
import secrets
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("[install] ERROR: instala python3-cryptography", file=sys.stderr)
    sys.exit(1)

path = Path(sys.argv[1])
regen = sys.argv[2] == "1"
had_existing_file = path.exists()

def q(value: str) -> str:
    """Comillas dobles: obligatorio para URLs (@, :), Fernet (=) y Compose v2."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'

def parse_database_url(url: str):
    if not url:
        return None
    normalized = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlparse(normalized)
    if not parsed.username:
        return None
    return {
        "user": unquote(parsed.username),
        "password": unquote(parsed.password or ""),
        "db": (parsed.path or "/").lstrip("/") or "iocdb",
    }

defaults = {
    "SECRET_KEY": "",
    "ENVIRONMENT": "development",
    "FRONTEND_URL": "http://localhost:5173",
    "POSTGRES_USER": "iocuser",
    "POSTGRES_PASSWORD": "",
    "POSTGRES_DB": "iocdb",
    "DATABASE_URL": "",
    "REDIS_URL": "redis://redis:6379/0",
    "ENCRYPTION_KEY": "",
    "VT_CLIENT_ID": "",
    "VT_CLIENT_SECRET": "",
    "VT_REDIRECT_URI": "http://localhost:8000/api/v1/auth/virustotal/callback",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
    "REFRESH_TOKEN_EXPIRE_DAYS": "7",
}

existing = {}
if had_existing_file:
    raw = path.read_bytes()
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        text = raw.decode("utf-16")
    else:
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        text = raw.decode("utf-8", errors="replace")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        existing[key] = val

data = {**defaults, **existing}
# Present-but-empty values must not wipe non-empty defaults (Compose/Pydantic int fields).
for key, default in defaults.items():
    if data.get(key) == "" and default != "":
        data[key] = default

# SECRET_KEY y ENCRYPTION_KEY se generan por separado. Nunca rotar ENCRYPTION_KEY
# si ya existe: invalidaría el cifrado Fernet de las API keys en la base de datos.
if regen or not data.get("SECRET_KEY") or data.get("SECRET_KEY") == "changeme":
    data["SECRET_KEY"] = secrets.token_urlsafe(32)[:32]
if not data.get("ENCRYPTION_KEY"):
    data["ENCRYPTION_KEY"] = Fernet.generate_key().decode()

# Credenciales Postgres: no regenerar si ya existen (initdb solo aplica POSTGRES_PASSWORD
# la primera vez; cambiarla rompe el volumen pgdata).
if not data.get("POSTGRES_PASSWORD"):
    parsed = parse_database_url(existing.get("DATABASE_URL", "") or data.get("DATABASE_URL", ""))
    if parsed and parsed["password"]:
        data["POSTGRES_USER"] = existing.get("POSTGRES_USER") or parsed["user"] or "iocuser"
        data["POSTGRES_PASSWORD"] = parsed["password"]
        data["POSTGRES_DB"] = existing.get("POSTGRES_DB") or parsed["db"] or "iocdb"
    elif had_existing_file:
        # Instalación anterior sin POSTGRES_*: conservar iocuser/iocpass del volumen
        data["POSTGRES_USER"] = data.get("POSTGRES_USER") or "iocuser"
        data["POSTGRES_PASSWORD"] = "iocpass"
        data["POSTGRES_DB"] = data.get("POSTGRES_DB") or "iocdb"
    else:
        data["POSTGRES_USER"] = data.get("POSTGRES_USER") or "iocuser"
        data["POSTGRES_PASSWORD"] = secrets.token_urlsafe(24)
        data["POSTGRES_DB"] = data.get("POSTGRES_DB") or "iocdb"

data["DATABASE_URL"] = (
    f"postgresql+asyncpg://{data['POSTGRES_USER']}:{data['POSTGRES_PASSWORD']}"
    f"@postgres:5432/{data['POSTGRES_DB']}"
)

lines = [
    "# IOC Correlator — UTF-8, compatible con Docker Compose v2",
    "# Las URLs y claves van entre comillas por el @ en DATABASE_URL y el = en Fernet",
    f"SECRET_KEY={q(data['SECRET_KEY'])}",
    f"ENVIRONMENT={data['ENVIRONMENT']}",
    f"FRONTEND_URL={q(data['FRONTEND_URL'])}",
    f"POSTGRES_USER={q(data['POSTGRES_USER'])}",
    f"POSTGRES_PASSWORD={q(data['POSTGRES_PASSWORD'])}",
    f"POSTGRES_DB={q(data['POSTGRES_DB'])}",
    f"DATABASE_URL={q(data['DATABASE_URL'])}",
    f"REDIS_URL={q(data['REDIS_URL'])}",
    f"ENCRYPTION_KEY={q(data['ENCRYPTION_KEY'])}",
    f"VT_CLIENT_ID={q(data['VT_CLIENT_ID'])}",
    f"VT_CLIENT_SECRET={q(data['VT_CLIENT_SECRET'])}",
    f"VT_REDIRECT_URI={q(data['VT_REDIRECT_URI'])}",
    f"ACCESS_TOKEN_EXPIRE_MINUTES={data['ACCESS_TOKEN_EXPIRE_MINUTES']}",
    f"REFRESH_TOKEN_EXPIRE_DAYS={data['REFRESH_TOKEN_EXPIRE_DAYS']}",
    "",
]
path.write_text("\n".join(lines), encoding="utf-8", newline="\n")
PY
}

validate_env_compose() {
  cd "$PROJECT_DIR"
  if run_dc config >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

ensure_env_file() {
  cd "$PROJECT_DIR"
  write_env_example_if_missing

  # Migrar instalaciones anteriores: añadir POSTGRES_* sin rotar SECRET_KEY/ENCRYPTION_KEY
  # ni regenerar la password (el volumen pgdata ya tiene la del primer initdb).
  if [[ -f .env ]] && ! grep -qE '^POSTGRES_PASSWORD=' .env; then
    log "Añadiendo POSTGRES_* al .env existente (compatibilidad con volumen)..."
    write_env_with_python ".env" 0
  fi

  if [[ -f .env ]] && env_has_valid_secrets && validate_env_compose; then
    log ".env: OK (válido para Docker Compose)"
    return 0
  fi

  if [[ -f .env ]]; then
    warn ".env corrupto o incompatible con Compose; regenerando (UTF-8, valores entre comillas)..."
    write_env_with_python ".env" 1
  else
    log "Creando .env..."
    write_env_with_python ".env" 1
  fi

  validate_env_compose || die "El .env sigue siendo inválido. Borra .env y ejecuta de nuevo: rm -f .env && ./install.sh --solo-app"

  local ip
  ip="$(get_host_ip)"
  if [[ "$ip" != "127.0.0.1" ]]; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=\"http://${ip}:${PORT_FRONTEND}\"|" .env
    log "FRONTEND_URL en .env: http://${ip}:${PORT_FRONTEND}"
  fi
  log ".env: listo (UTF-8, sin CRLF/BOM, URLs y claves entre comillas)"
}

write_env_example_if_missing() {
  if [[ -f "$PROJECT_DIR/.env.example" ]]; then
    return 0
  fi
  log "Creando .env.example..."
  write_env_with_python "$PROJECT_DIR/.env.example" 0
}

env_has_valid_secrets() {
  [[ -f "$PROJECT_DIR/.env" ]] || return 1
  grep -qE '^SECRET_KEY="?.+"?' "$PROJECT_DIR/.env" || grep -qE '^SECRET_KEY=[^[:space:]]+' "$PROJECT_DIR/.env" || return 1
  grep -qE '^ENCRYPTION_KEY="?.+"?' "$PROJECT_DIR/.env" || return 1
  ! grep -qE '^SECRET_KEY="?changeme"?' "$PROJECT_DIR/.env" 2>/dev/null
}

# --- Contenedores ---
env_var() {
  local key="$1" default="${2:-}"
  local val=""
  if [[ -f "$PROJECT_DIR/.env" ]]; then
    val="$(grep -E "^${key}=" "$PROJECT_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  fi
  echo "${val:-$default}"
}

wait_postgres() {
  local i user db
  user="$(env_var POSTGRES_USER iocuser)"
  db="$(env_var POSTGRES_DB iocdb)"
  for i in $(seq 1 30); do
    if run_dc exec -T postgres pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

run_migrations() {
  local i
  for i in $(seq 1 5); do
    if run_dc exec -T backend alembic upgrade head 2>/dev/null; then
      log "Migraciones Alembic: OK"
      return 0
    fi
    log "Esperando backend para migraciones ($i/5)..."
    sleep 8
  done
  warn "Migraciones no confirmadas; prueba: docker compose exec backend alembic upgrade head"
  return 1
}

container_running() {
  local name="$1"
  run_dc ps --status running 2>/dev/null | grep -qE "${name}"
}

ensure_stack_up() {
  log "=== Despliegue de contenedores ==="
  cd "$PROJECT_DIR"

  if container_running "backend" && container_running "frontend"; then
    log "Contenedores ya en ejecución; asegurando estado..."
    run_dc up -d
  else
    log "Construyendo y levantando servicios (puede tardar varios minutos)..."
    run_dc up --build -d
  fi

  log "Esperando PostgreSQL..."
  wait_postgres || warn "PostgreSQL tarda; las migraciones se reintentarán."

  run_migrations || true

  log "Estado de los servicios:"
  run_dc ps
}

verify_services_running() {
  local failed=0
  for svc in postgres redis backend celery frontend; do
    if container_running "$svc"; then
      log "  [OK] $svc"
    else
      warn "  [--] $svc no aparece como running"
      failed=1
    fi
  done
  [[ "$failed" -eq 0 ]] || warn "Algunos servicios no están arriba. Revisa: docker compose logs"
}

print_access_urls() {
  local ip
  ip="$(get_host_ip)"

  echo ""
  echo "================================================================"
  echo "  IOC Correlator — en ejecución"
  echo "================================================================"
  echo ""
  echo "  IP del servidor:  $ip"
  echo ""
  echo "  Interfaz web (frontend):"
  echo "    http://${ip}:${PORT_FRONTEND}"
  echo "    http://127.0.0.1:${PORT_FRONTEND}"
  echo ""
  echo "  API / documentación:"
  echo "    http://${ip}:${PORT_BACKEND}/docs"
  echo "    http://${ip}:${PORT_BACKEND}/health"
  echo ""
  echo "  Puertos expuestos en el host:"
  echo "    ${PORT_FRONTEND}  -> frontend (React)"
  echo "    ${PORT_BACKEND}  -> backend (FastAPI)"
  echo ""
  echo "  Postgres y Redis: solo red interna Docker (sin puertos en el host)."
  echo "    docker compose exec postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'"
  echo "    docker compose exec redis redis-cli"
  echo ""
  echo "  Comandos útiles:"
  echo "    docker compose ps"
  echo "    docker compose logs -f"
  echo "    docker compose down"
  echo ""
  echo "  Si publicas con dominio + Nginx + HTTPS:"
  echo "    1) Añade tu dominio en frontend/vite.config.ts -> preview.allowedHosts"
  echo "    2) Reconstruye frontend: docker compose up -d --build frontend"
  echo "    3) Nginx: reenvía WebSocket (Upgrade/Connection) en /api o en location /"
  echo "    4) Recarga Nginx: sudo nginx -t && sudo systemctl reload nginx"
  echo ""
  echo "================================================================"
  echo ""
}

# --- Main ---
main() {
  log "Proyecto: $PROJECT_DIR"

  if [[ "$SKIP_SYSTEM" -eq 0 ]]; then
    setup_system
  else
    log "Modo --solo-app: omitiendo instalación del sistema"
  fi

  ensure_docker_access

  ensure_env_file
  ensure_stack_up
  verify_services_running
  run_deploy_smoke_test
  print_access_urls
}

run_deploy_smoke_test() {
  local ip script
  ip="$(get_host_ip)"
  script="$PROJECT_DIR/scripts/verify-deploy.sh"
  if [[ ! -x "$script" ]]; then
    chmod +x "$script" 2>/dev/null || true
  fi
  if [[ -x "$script" ]]; then
    log "Comprobando API (health, registro y login)..."
    if bash "$script" "$ip"; then
      log "Verificación API: OK"
    else
      warn "Verificación API falló. Revisa: docker compose logs backend --tail=50"
    fi
  fi
}

main
