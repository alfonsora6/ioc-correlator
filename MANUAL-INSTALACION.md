# Manual de Instalación — IOC Correlator

> Manual verificado y probado en Debian 12 (Bookworm)

## Índice
1. [Requisitos previos](#1-requisitos-previos)
2. [Instalación en Debian](#2-instalación-en-debian)
3. [Configuración del entorno](#3-configuración-del-entorno)
4. [Despliegue con Docker](#4-despliegue-con-docker)
5. [Configuración de API Keys](#5-configuración-de-api-keys)
6. [Uso de la aplicación](#6-uso-de-la-aplicación)
7. [Solución de problemas](#7-solución-de-problemas)
8. [Comandos útiles](#8-comandos-útiles)

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

## 2. Instalación en Debian

### Paso 1 — Actualizar el sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### Paso 2 — Instalar dependencias base
```bash
sudo apt install -y git ca-certificates curl gnupg dos2unix python3 python3-cryptography
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

## 3. Configuración del entorno

### Paso 1 — Clonar el repositorio
```bash
git clone https://github.com/alfonsora6/ioc-correlator.git
cd ioc-correlator
```

### Paso 2 — Convertir codificación de archivos
El proyecto se desarrolló en Windows, por lo que algunos archivos pueden tener codificación UTF-16 o saltos de línea CRLF. Es obligatorio convertirlos antes de continuar.

```bash
# Paso 2a — Convertir archivos UTF-16 a UTF-8 (Dockerfiles y otros)
find . -type f -not -path './.git/*' | while read f; do
  if file "$f" | grep -q "UTF-16"; then
    iconv -f UTF-16LE -t UTF-8 "$f" -o "$f.tmp" && mv "$f.tmp" "$f"
    echo "Convertido: $f"
  fi
done

# Paso 2b — Convertir saltos de línea CRLF a LF
find . -type f -not -path './.git/*' | xargs dos2unix 2>/dev/null
```

> **Nota:** `iconv` convierte la codificación del archivo (UTF-16 → UTF-8). `dos2unix` convierte los saltos de línea (Windows CRLF → Linux LF). Son dos problemas distintos y ambos comandos son necesarios.

### Paso 3 — Crear el archivo .env
```bash
iconv -f UTF-16 -t UTF-8 .env.example > .env 2>/dev/null || cp .env.example .env
```

### Paso 4 — Generar valores seguros para el .env
```bash
# Generar SECRET_KEY
SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

# Generar ENCRYPTION_KEY
ENCKEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

### Paso 5 — Aplicar los valores al .env
```bash
sed -i "s|SECRET_KEY=.*|SECRET_KEY=$SECRET|" .env
sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCKEY|" .env
```

### Contenido del .env correctamente configurado
```
# App
SECRET_KEY=tu-string-aleatorio-de-32-caracteres
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/iocdb

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

## 4. Despliegue con Docker

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

## 5. Configuración de API Keys

### Registro en la aplicación
1. Abre http://localhost:5173
2. Haz clic en **Registro**
3. Rellena: email, contraseña, nombre completo y nombre de tenant
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

## 6. Uso de la aplicación

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

## 7. Solución de problemas

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
El Dockerfile tiene codificación UTF-16 (creado en Windows). Ejecuta la conversión completa:
```bash
find . -type f -not -path './.git/*' | while read f; do
  if file "$f" | grep -q "UTF-16"; then
    iconv -f UTF-16LE -t UTF-8 "$f" -o "$f.tmp" && mv "$f.tmp" "$f"
  fi
done
find . -type f -not -path './.git/*' | xargs dos2unix 2>/dev/null
docker compose up --build -d
```

### El .env aparece con caracteres ^@ al editarlo
Problema de codificación UTF-16. Conviértelo:
```bash
iconv -f UTF-16 -t UTF-8 .env.example > .env
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

## 8. Comandos útiles

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

# Reconvertir archivos por si hay nuevos desde Windows
find . -type f -not -path './.git/*' | while read f; do
  if file "$f" | grep -q "UTF-16"; then
    iconv -f UTF-16LE -t UTF-8 "$f" -o "$f.tmp" && mv "$f.tmp" "$f"
  fi
done
find . -type f -not -path './.git/*' | xargs dos2unix 2>/dev/null

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
