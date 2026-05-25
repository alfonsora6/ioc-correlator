# Manual de Instalación — IOC Correlator

> Manual verificado y probado en Debian 12 (Bookworm)

## Índice
1. [Requisitos previos](#1-requisitos-previos)
2. [Instalación automática (recomendado)](#2-instalación-automática-recomendado)
3. [Instalación manual en Debian](#3-instalación-manual-en-debian)
4. [Configuración del entorno](#4-configuración-del-entorno)
5. [Despliegue con Docker](#5-despliegue-con-docker)
6. [Configuración de API Keys](#6-configuración-de-api-keys)
7. [Uso de la aplicación](#7-uso-de-la-aplicación)
8. [Solución de problemas](#8-solución-de-problemas)
9. [Comandos útiles](#9-comandos-útiles)

---

## 1. Requisitos previos

### Sistema operativo compatible
- Debian 11 (Bullseye) o Debian 12 (Bookworm) — recomendado
- Ubuntu 22.04 / 24.04
- Windows 10/11 con Docker Desktop
- macOS con Docker Desktop

### Software necesario
- Git
- Docker >= 24.x
- Docker Compose >= 2.x
- python3-cryptography (para generar el ENCRYPTION_KEY)

### Cuentas necesarias (gratuitas)
- [AbuseIPDB](https://www.abuseipdb.com) — para análisis de IPs
- [VirusTotal](https://www.virustotal.com) — para análisis de IPs, dominios y hashes
- [AlienVault OTX](https://otx.alienvault.com) — para threat intelligence comunitaria
- [Shodan](https://shodan.io) — opcional, requiere plan de pago o licencia académica

---

## 2. Instalación automática (recomendado)

El script `install.sh` comprueba qué falta (paquetes, Docker, `.env`, contenedores), instala solo lo necesario y al final muestra la **IP y los puertos** de acceso.

### Instalación completa (máquina nueva)

```bash
cd ioc-correlator
chmod +x install.sh
./install.sh
```

Al terminar verás algo como:

```
  IP del servidor:  192.168.1.50
  http://192.168.1.50:5173    (frontend)
  http://192.168.1.50:8000/docs   (API)
```

Si Docker pide permisos: `newgrp docker` y `./install.sh --solo-app`.

### Solo aplicación (Docker y dependencias ya listos)

Comprueba `.env`, levanta contenedores y muestra IP + puertos:

```bash
./install.sh --solo-app
```

### Si el script no arranca (Windows / CRLF)

```bash
sed -i 's/\r$//' install.sh
chmod +x install.sh
./install.sh --solo-app
```

> Todos los ficheros del repositorio están en **UTF-8**. No es necesaria ninguna conversión de codificación.

---

## 3. Instalación manual en Debian

### Paso 1 — Actualizar el sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### Paso 2 — Instalar dependencias base
```bash
sudo apt install -y git ca-certificates curl gnupg python3 python3-cryptography
```

### Paso 3 — Instalar Docker
```bash
# Añadir clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Añadir repositorio de Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Paso 4 — Añadir usuario al grupo docker
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Paso 5 — Verificar instalación de Docker
```bash
docker --version
docker compose version
```

---

## 4. Configuración del entorno

### Paso 1 — Clonar el repositorio
```bash
git clone https://github.com/alfonsora6/ioc-correlator.git
cd ioc-correlator
```

### Paso 2 — Crear el archivo .env
```bash
cp .env.example .env
```

### Paso 3 — Generar valores seguros para el .env
```bash
# Generar SECRET_KEY
SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

# Generar ENCRYPTION_KEY
ENCKEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

### Paso 4 — Aplicar los valores al .env

Docker Compose v2 exige **comillas** en valores con `@`, `://` o `=` (p. ej. `DATABASE_URL` y `ENCRYPTION_KEY`):

```bash
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=\"$SECRET\"|" .env
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENCKEY\"|" .env
```

O deja que el script lo genere bien formateado:

```bash
rm -f .env
./install.sh --solo-app
```

### Contenido del .env correctamente configurado
```
# App
SECRET_KEY=tu-string-aleatorio-de-32-caracteres
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql+asyncpg://iocuser:iocpass@postgres:5432/iocdb

# Redis
REDIS_URL=redis://redis:6379/0

# Encryption (generar con Fernet)
ENCRYPTION_KEY=clave-fernet-base64-generada=

# VirusTotal OAuth (opcional, solo para OAuth flow)
VT_CLIENT_ID=
VT_CLIENT_SECRET=
VT_REDIRECT_URI=http://localhost:8000/api/v1/auth/virustotal/callback

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

---

## 5. Despliegue con Docker

### Paso 1 — Construir y levantar todos los servicios
```bash
docker compose up --build -d
```

Este comando levanta:
- **postgres** — base de datos PostgreSQL
- **redis** — caché y cola de trabajos
- **backend** — API FastAPI
- **celery** — worker para análisis en batch
- **frontend** — interfaz React

La primera vez tarda varios minutos porque descarga las imágenes y construye los contenedores.

### Paso 2 — Verificar que todos los servicios están corriendo
```bash
docker compose ps
```

Todos los servicios deben mostrar estado **Up** o **running**.

### Paso 3 — Ejecutar las migraciones de base de datos
```bash
docker compose exec backend alembic upgrade head
```

Este paso es obligatorio la primera vez para crear las tablas en la base de datos.

### Paso 4 — Acceder a la aplicación
- **Frontend:** http://localhost:5173
- **API docs (Swagger):** http://localhost:8000/docs
- **API docs (Redoc):** http://localhost:8000/redoc

---

## 6. Configuración de API Keys

### Registro en la aplicación

Abre la app por la **misma URL** que usa el frontend (IP o `localhost:5173`), no mezcles IP en el navegador con API en `localhost:8000`.

1. Abre http://localhost:5173 (o `http://TU_IP:5173`)
2. Haz clic en **Registro**
3. Rellena: email, contraseña (**mínimo 8 caracteres**), nombre completo y nombre de tenant
4. Inicia sesión con tus credenciales

### AbuseIPDB (gratuito)
1. Regístrate en [abuseipdb.com](https://www.abuseipdb.com)
2. Ve a **Account → API**
3. Copia tu API key
4. En la app ve a **API Keys → AbuseIPDB**
5. Pega la key y haz clic en **Save**
6. Haz clic en **Validate** para verificar que funciona ✅

### VirusTotal (gratuito)
1. Regístrate en [virustotal.com](https://www.virustotal.com)
2. Ve a tu perfil → **API Key**
3. Copia tu API key
4. En la app ve a **API Keys → VirusTotal**
5. Pega la key y haz clic en **Save**
6. Haz clic en **Validate** ✅

### AlienVault OTX (gratuito)
1. Regístrate en [otx.alienvault.com](https://otx.alienvault.com)
2. Ve a **Settings** (icono de usuario arriba a la derecha)
3. Copia tu **OTX Key**
4. En la app ve a **API Keys → OTX**
5. Pega la key y haz clic en **Save**
6. Haz clic en **Validate** ✅

### Shodan (plan de pago o académico)
- El plan gratuito **no incluye** el endpoint de consulta de IPs
- Licencia académica gratuita: [help.shodan.io/the-basics/academic-license](https://help.shodan.io/the-basics/academic-license)
- Si tienes plan de pago: [account.shodan.io](https://account.shodan.io) → copia tu API key

---

## 7. Uso de la aplicación

### Análisis de un IOC individual
1. Ve a la sección **Analyze**
2. Introduce una IP, dominio, URL o hash en el campo **Indicator**
3. Haz clic en **Analyze IOC**
4. Verás el score agregado (0-100) y los resultados por fuente

**Ejemplos de IOCs para probar:**
```
# IPs maliciosas conocidas (alta detección)
185.220.101.34
193.32.162.157
91.92.109.174
45.227.255.206
194.165.16.11

# IP limpia (Google DNS)
8.8.8.8
```

**Escala de severidad:**

| Score  | Severidad | Color    |
|--------|-----------|----------|
| 0-25   | LOW       | Verde    |
| 26-50  | MEDIUM    | Amarillo |
| 51-75  | HIGH      | Naranja  |
| 76-100 | CRITICAL  | Rojo     |

### Análisis en batch
1. Ve a la sección **Batch**
2. Sube un archivo `.txt`, `.csv` o `.log` con IPs/dominios/hashes (uno por línea)
3. La app extrae automáticamente todos los IOCs
4. Sigue el progreso en tiempo real
5. Descarga los resultados en CSV

### Exportar PDF
1. Ve a la sección **Reports**
2. Selecciona el rango de fechas
3. Haz clic en **Export PDF**
4. El PDF incluye: nombre de tenant, timestamp UTC y todos los análisis

### Bóveda Obsidian
La carpeta `/obsidian/` del proyecto es una bóveda de Obsidian con toda la documentación técnica interconectada.

1. Instala [Obsidian](https://obsidian.md) (gratuito)
2. Abre Obsidian → **Open folder as vault**
3. Selecciona la carpeta `obsidian/` del proyecto
4. Ve a **Graph View** para ver la red neuronal de toda la arquitectura

---

## 8. Solución de problemas

### Error "crypto.subtle is undefined" al escanear ficheros

Ocurre si abres la app por **HTTP** con la IP (`http://192.168.x.x:5173`): el navegador no expone `crypto.subtle` fuera de HTTPS/localhost. La app usa un fallback (`js-sha256`) desde la versión actual; reconstruye el frontend:

```bash
docker compose up --build -d frontend
```

### Error "Unexpected token" al registrarse o iniciar sesión

El navegador recibió **HTML** en lugar de **JSON** (o el backend no responde en el puerto 8000).

1. Comprueba el API: `curl http://TU_IP:8000/health` → debe devolver `{"status":"ok"}`
2. Reconstruye: `docker compose up --build -d`
3. Entra por `http://TU_IP:5173` (el frontend llamará a `http://TU_IP:8000`)
4. Verificación automática: `chmod +x scripts/verify-deploy.sh && ./scripts/verify-deploy.sh TU_IP`

### El script install.sh falla pero el manual a mano sí funciona

1. Usa solo la parte de app (igual que secciones 4–5 del manual):

```bash
newgrp docker
./install.sh --solo-app
```

2. O ejecuta los comandos del manual directamente (secciones 4 y 5); el resultado es el mismo.

| Síntoma | Solución |
|---------|----------|
| `/bin/bash^M: bad interpreter` | `sed -i 's/\r$//' install.sh` |
| `permission denied` con Docker | `newgrp docker` y luego `./install.sh --solo-app` |
| Migraciones fallan | `sleep 10 && docker compose exec backend alembic upgrade head` |

### Error: unexpected character en .env

Docker Compose v2 falla si el `.env` tiene:

- Fin de línea Windows (`\r`) o BOM UTF-8
- `DATABASE_URL=...@postgres...` **sin comillas** (el `@` provoca el error)
- `ENCRYPTION_KEY=...=` **sin comillas** (el `=` final también)

**Solución rápida:**

```bash
rm -f .env
./install.sh --solo-app
```

O valida con: `docker compose config` (no debe mostrar error).

### Error: Fernet key must be 32 url-safe base64-encoded bytes
El `ENCRYPTION_KEY` del `.env` no es válido. Genera uno nuevo:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Actualiza el `.env` y reinicia completamente:
```bash
docker compose down
docker compose up -d
```
> **Importante:** Usa `down` + `up` en lugar de `restart` para que los contenedores recarguen las variables del `.env`.

### Error: unknown instruction: FROM (Dockerfile)
Suele deberse a un Dockerfile corrupto o con BOM/caracteres extraños. Verifica que el fichero empieza por `FROM` en UTF-8 y reconstruye:

```bash
docker compose build --no-cache
docker compose up -d
```

### Error 403 en Shodan
El plan gratuito de Shodan no permite consultar IPs por API. Necesitas plan de pago o licencia académica gratuita en [help.shodan.io/the-basics/academic-license](https://help.shodan.io/the-basics/academic-license).

### Error 500 al guardar una API key
El `ENCRYPTION_KEY` probablemente no es válido. Revisa los logs:
```bash
docker compose logs backend --tail=50
```

### Los contenedores no arrancan
Verifica que Docker está corriendo:
```bash
sudo systemctl status docker
sudo systemctl start docker
```

### Las migraciones fallan
Espera a que PostgreSQL esté completamente listo y vuelve a ejecutar:
```bash
sleep 10 && docker compose exec backend alembic upgrade head
```

### El comando restart no aplica cambios del .env
El `restart` no recarga las variables de entorno. Usa siempre:
```bash
docker compose down && docker compose up -d
```

---

## 9. Comandos útiles

### Gestión de contenedores
```bash
# Ver estado de todos los servicios
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Ver logs solo del backend
docker compose logs backend --tail=100

# Reiniciar un servicio concreto
docker compose restart backend

# Parar todos los servicios
docker compose down

# Parar y eliminar volúmenes (borra la base de datos)
docker compose down -v

# Reconstruir y levantar
docker compose up --build -d
```

### Base de datos
```bash
# Ejecutar migraciones
docker compose exec backend alembic upgrade head

# Ver migraciones aplicadas
docker compose exec backend alembic history

# Conectar a PostgreSQL directamente
docker compose exec postgres psql -U user -d iocdb
```

### Actualizar la aplicación
```bash
git pull origin main
docker compose up --build -d
docker compose exec backend alembic upgrade head
```

---

## Notas de seguridad

- Cambia siempre el `SECRET_KEY` por un valor aleatorio seguro en producción
- No subas nunca el archivo `.env` a GitHub (está en `.gitignore`)
- Las API keys se almacenan cifradas en la base de datos con Fernet (AES-128)
- En producción, usa HTTPS con un proxy inverso como Nginx + Certbot
- Los campos `VT_CLIENT_ID` y `VT_CLIENT_SECRET` solo son necesarios para el OAuth de VirusTotal (plan Premium). Para uso básico con API key no hacen falta

---

*Manual verificado y probado — IOC Correlator v1.0*
