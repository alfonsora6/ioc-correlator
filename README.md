# IOC Correlator

Plataforma web de triaje de indicadores de compromiso (IOCs) para analistas de un SOC. Recibe una IP, un dominio, una URL o un hash, consulta en paralelo varias fuentes de inteligencia de amenazas y devuelve una puntuación única (0 a 100) con su severidad, de modo que el analista no tenga que abrir una pestaña por proveedor ni reconciliar resultados a mano.

El problema que resuelve es la dispersión: cada fuente tiene su propia interfaz, su propia escala y sus propios límites de cuota. IOC Correlator centraliza la consulta, normaliza los resultados, guarda el historial por organización (tenant) y permite procesar ficheros de log completos por lotes.

## Estado de las fuentes

| Fuente | Estado |
|--------|--------|
| VirusTotal | Operativa y verificada |
| AbuseIPDB | Operativa y verificada (solo IPs) |
| AlienVault OTX | Operativa y verificada |
| Shodan | Implementada en el cliente (`backend/app/services/intel_clients.py`) pero **no verificada**, por falta de licencia de pago (solo IPs) |

Shodan se trata como una fuente que puede no estar disponible: si no hay clave configurada, o la API responde con error (por ejemplo 403 con el plan gratuito), el análisis continúa con el resto de fuentes y los pesos se renormalizan sobre las fuentes que sí devolvieron puntuación.

## Características

- Multi-tenant: registro, inicio de sesión y sesiones con JWT de acceso (30 minutos por defecto) y cookie httpOnly de refresco (7 días).
- Análisis de un IOC: detección automática del tipo (IP, dominio, URL, hash MD5, SHA1 o SHA256) y consulta correlacionada.
- Puntuación agregada: media ponderada (VirusTotal 40 %, AbuseIPDB 30 %, Shodan 20 %, OTX 10 %) con renormalización cuando falta alguna fuente. Severidad: LOW (0 a 25), MEDIUM (26 a 50), HIGH (51 a 75), CRITICAL (76 a 100).
- Análisis por lotes: subida de `.txt`, `.csv` o `.log` (máximo 2 MB), extracción automática de IOCs, procesamiento con Celery, progreso por WebSocket y exportación a CSV.
- Gestión de claves API por tenant, cifradas en reposo, con validación por proveedor y OAuth opcional de VirusTotal.
- Panel con contadores por severidad, evolución temporal, IOCs más frecuentes, orígenes aproximados y estado de las integraciones.
- Informe PDF por rango de fechas, con nombre del tenant y marcas de tiempo en UTC.
- Interfaz en español (por defecto) e inglés, con modo claro y oscuro.
- Caché de resultados en Redis por tenant (1 hora).

## Stack y arquitectura

| Capa | Tecnología | Servicio en Docker Compose |
|------|------------|----------------------------|
| Interfaz | React, Vite, Tailwind, Zustand | `frontend` (puerto 5173) |
| API | FastAPI (Python), SQLAlchemy async, Alembic | `backend` (puerto 8000) |
| Tareas en segundo plano | Celery | `celery` |
| Base de datos | PostgreSQL 16 | `postgres` (solo red interna) |
| Caché, broker y rate limiting | Redis 7 | `redis` (solo red interna) |

Documentación técnica ampliada en la bóveda [obsidian/](obsidian/README.md) (arquitectura, flujo de autenticación, esquema de base de datos, integraciones, despliegue y registro de desarrollo).

## Estructura del proyecto

| Elemento | Contenido |
|----------|-----------|
| `backend/` | API FastAPI: `app/api` (endpoints), `app/core` (configuración, seguridad, rate limiting), `app/db` (modelos y sesión), `app/services` (clientes de inteligencia, correlación, caché, cifrado), `app/tasks` (Celery), `alembic/` (migraciones) y `tests/` |
| `frontend/` | Aplicación React: `src/pages`, `src/components`, `src/store` (estado con Zustand), `src/i18n` y `src/lib` |
| `obsidian/` | Bóveda de Obsidian con la documentación técnica |
| `scripts/` | `verify-deploy.sh`, comprueba `/health` y el registro de un usuario de prueba contra un despliegue |
| `install.sh` | Instalador: dependencias del sistema, Docker, generación de `.env`, arranque de contenedores y migraciones |
| `docker-compose.yml` | Definición de los 5 servicios y del volumen `pgdata` |
| `Makefile` | Atajos `dev`, `build`, `migrate`, `test` y `clean` |
| `MANUAL-INSTALACION.md` | Manual de instalación detallado, claves API y solución de problemas |
| `CHANGELOG.md` | Registro de cambios |
| `.env.example` | Plantilla de variables de entorno |

## Requisitos previos

- Docker y Docker Compose v2
- Git
- Linux o WSL2 (el instalador `install.sh` es un script bash que usa `apt`; ver el manual para otras distribuciones)
- Puertos 5173 y 8000 libres en localhost

Para generar claves a mano también hace falta Python 3 con el paquete `cryptography` (el instalador usa `python3-cryptography`).

## Instalación desde cero

```bash
git clone https://github.com/alfonsora6/ioc-correlator.git
cd ioc-correlator
chmod +x install.sh
./install.sh
```

Si Docker y las dependencias del sistema ya están instalados, basta con:

```bash
./install.sh --solo-app
```

El instalador crea el fichero `.env` (si no existe o es inválido) con `SECRET_KEY` y `ENCRYPTION_KEY` aleatorias y una contraseña aleatoria de PostgreSQL, levanta los contenedores y aplica las migraciones de Alembic. Al terminar muestra las URLs de acceso. La aplicación queda disponible en:

- Interfaz: http://127.0.0.1:5173
- Documentación de la API (Swagger): http://127.0.0.1:8000/docs
- Estado del backend: http://127.0.0.1:8000/health

Para comprobar que los 5 servicios (`postgres`, `redis`, `backend`, `celery`, `frontend`) están arriba:

```bash
docker compose ps
```

### Alternativa manual

```bash
cp .env.example .env
```

Edita `.env` y sustituye los valores de ejemplo. `SECRET_KEY`, `ENCRYPTION_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` son obligatorias: si falta alguna, `docker compose` se detiene con un mensaje claro (por ejemplo "SECRET_KEY es obligatoria"). La clave de cifrado se genera con:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Después:

```bash
docker compose up --build -d
docker compose exec backend alembic upgrade head
```

Los valores con `@` o `=` (como `DATABASE_URL` o `ENCRYPTION_KEY`) deben ir entre comillas dobles en el `.env`. Más detalle en [MANUAL-INSTALACION.md](MANUAL-INSTALACION.md).

## Uso básico

El repositorio no incluye ninguna cuenta de demostración. Para empezar:

1. **Registro**: abre http://127.0.0.1:5173/register e indica email, contraseña (mínimo 8 caracteres), nombre completo y nombre del tenant. Esto crea el tenant y el primer usuario.
2. **Inicio de sesión**: entra con esas credenciales.
3. **Claves API** (sección Claves API): guarda la clave de cada proveedor (VirusTotal, AbuseIPDB, OTX y, si dispones de licencia, Shodan) y pulsa el botón de validación.
4. **Analizar un IOC** (sección Analizar): introduce una IP, dominio, URL o hash. Se muestra el score agregado y el resultado por fuente.
5. **Lotes** (sección Lotes): arrastra o selecciona un `.txt`, `.csv` o `.log`; sigue el progreso y descarga el CSV con los resultados.
6. **Panel** (página principal): resumen de los últimos 30 días.
7. **Informe PDF** (sección Informes): elige un rango de fechas y exporta.

## Tests

Los tests del backend usan pytest y no llaman a APIs externas. Desde la raíz del repositorio (requiere el `.env`, ver instalación):

```bash
docker compose run --rm backend pytest -q
```

Resultado esperado en el contenedor: 69 passed, 2 skipped. Para ver el motivo de los omitidos, añade `-rs`.

El `Makefile` incluye el atajo `make test`, que ejecuta `cd backend && pytest -q` en el host (requiere un entorno con las dependencias de `backend/requirements.txt`). `backend/tests/conftest.py` define un `SECRET_KEY` de prueba, porque `Settings` ya no tiene valor por defecto para esa variable. La configuración de pytest está en `backend/pytest.ini` (fija el ámbito del bucle de eventos de las fixtures asíncronas).

| Fichero | Qué cubre |
|---------|-----------|
| `conftest.py` | Fija `SECRET_KEY` de prueba en el entorno (no contiene tests) |
| `test_smoke.py` | Detección de IOC, extracción desde texto, agregación de scores y mapeo de severidad |
| `test_ioc_detect.py` | RF-03: detección de IPv4, IPv6, dominio, URL, MD5, SHA1 y SHA256, normalización y rechazo de entradas inválidas (por ejemplo, un hash de 63 caracteres) |
| `test_batch_extraction.py` | RF-07: extracción de IOCs en `.txt`, `.csv` y `.log` mediante `POST /batch/upload` con sesión simulada, error 400 sin IOCs y 413 por encima de 2 MB |
| `test_tenant_isolation.py` | RF-12: con dos tenants y JWT reales, el tenant B no ve análisis del A en `/analyses/history`, el panel ni el informe PDF |
| `test_auth_hash.py` | Hash y verificación de contraseñas |
| `test_auth_rate_limit.py` | Rate limiting de login y registro con un Redis simulado (ventanas, recuperación, cabeceras de proxy, fallo de Redis) |
| `test_correlation_cache.py` | Caché de correlación: no se cachea sin claves API e invalidación al cambiar claves |
| `test_settings_env.py` | Valores vacíos de variables numéricas usan el valor por defecto; `SECRET_KEY` obligatoria; `DATABASE_URL` por defecto es un marcador no funcional |
| `test_repo_encoding.py` | Ficheros de configuración versionados en UTF-8 sin BOM ni UTF-16 |

### Tests omitidos

En el contenedor `backend` se omiten 2 tests, por diseño:

- `test_repo_encoding.py` necesita el repositorio completo (el contenedor solo tiene `backend/`). Se ejecuta en el host, con un entorno virtual que tenga pytest:

```bash
cd backend && pytest tests/test_repo_encoding.py -q
```

- El test de aislamiento del panel (`test_dashboard_is_isolated_between_tenants`) usa SQL propio de PostgreSQL y necesita `TEST_DATABASE_URL` apuntando a una base PostgreSQL de pruebas (por ejemplo `postgresql+asyncpg://usuario:clave@host:5432/iocdb_test`). Usa una base desechable: crea las tablas si faltan y borra los datos que crea. Sin esa variable, los otros tests de aislamiento se ejecutan sobre SQLite en memoria.

El test del informe PDF necesita las librerías nativas de WeasyPrint (presentes en la imagen del backend). Si no están disponibles en el host, ese test también se omite.

## Seguridad

- Postgres y Redis no publican puertos en el host (solo red interna de Docker). Backend y frontend solo se publican en `127.0.0.1`.
- `SECRET_KEY`, `ENCRYPTION_KEY` y `POSTGRES_*` son obligatorias en `docker-compose.yml` (sintaxis `${VAR:?mensaje}`).
- Las claves API de los proveedores se almacenan cifradas con Fernet.
- Autenticación con JWT de acceso (30 minutos) y refresco rotado en cookie httpOnly; contraseñas con bcrypt.
- Rate limiting de login y registro en Redis, con contador atómico mediante script Lua. El login se limita por IP y email, con un tope adicional por IP. No se confía en `X-Forwarded-For` salvo que se active `AUTH_RATE_LIMIT_TRUST_PROXY`.
- Aislamiento por tenant: el usuario autenticado se resuelve a partir del JWT y las consultas de análisis, lotes, panel, informes, claves y ficheros filtran por el `tenant_id` de ese usuario.
- Subidas por lotes limitadas a 2 MB.

## Limitaciones conocidas

- Shodan no está verificado (ver "Estado de las fuentes").
- No hay control de acceso por roles dentro de un tenant: todos los usuarios de un tenant tienen los mismos permisos.
- Redis no tiene contraseña; solo es accesible desde la red interna de Docker.
- Detrás de Docker, el backend suele ver una única IP de gateway para todos los clientes, por lo que el límite por IP es compartido (de ahí el diseño por IP y email con un tope alto por IP).
- Quedan dependencias con vulnerabilidades pendientes de actualizar. Consulta el manual y la memoria del proyecto.

## Cumplimiento de proveedores

Debes cumplir los términos de uso y los límites de cuota de **VirusTotal**, **AbuseIPDB**, **AlienVault OTX** y **Shodan** (este último solo si dispones de licencia). Las claves API son responsabilidad de cada tenant.

## Contribuir

Las pull requests son bienvenidas. Abre primero un issue para discutir cambios importantes.

## Licencia

MIT
