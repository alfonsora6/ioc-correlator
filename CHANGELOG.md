# Registro de cambios

## [1.0.0] - 2026-10-15

### Añadido

- Rate limiting de login y registro en Redis, con contador atómico mediante script Lua (límite por IP y email, tope adicional por IP, variables `AUTH_RATE_LIMIT_*` opcionales)
- Estado de las páginas Analizar y Lotes en stores de Zustand (`vtFileScan` y `batchJob`), de modo que el progreso sobrevive a la navegación entre secciones
- Arrastrar y soltar ficheros en la página Lotes
- `.dockerignore` del frontend
- `frontend/pnpm-lock.yaml` versionado (generado con pnpm 9.15.0, la misma versión que el `Dockerfile` del frontend)
- Invalidación de la caché IOC del tenant al guardar o borrar una clave API
- Tests de rate limiting, caché de correlación, configuración y codificación de ficheros del repositorio
- Tests de detección de IOC (RF-03, `test_ioc_detect.py`), extracción por lotes con límites de tamaño (RF-07, `test_batch_extraction.py`) y aislamiento entre tenants en historial, panel e informe PDF (RF-12, `test_tenant_isolation.py`; el del panel requiere `TEST_DATABASE_URL` con PostgreSQL)
- `backend/tests/conftest.py` con un `SECRET_KEY` de prueba
- `backend/pytest.ini` con `asyncio_default_fixture_loop_scope = function` (elimina el aviso de pytest-asyncio sin cambiar el comportamiento de los tests)

### Cambiado

- Postgres y Redis ya no publican puertos en el host (solo red interna de Docker); backend y frontend se publican únicamente en `127.0.0.1`
- `docker-compose.yml` exige `SECRET_KEY`, `ENCRYPTION_KEY` y `POSTGRES_*` con la sintaxis `${VAR:?mensaje}`; el instalador genera una contraseña aleatoria de Postgres
- Access token JWT de 15 a 30 minutos (`ACCESS_TOKEN_EXPIRE_MINUTES`); el refresh token sigue en 7 días
- `.gitignore` y `.env.example` convertidos a UTF-8; `install.sh` y el manual ya no incluyen pasos de conversión desde UTF-16
- Dependencias actualizadas, entre ellas `cryptography` y `python-jose`

### Corregido

- `config.py` sin valores por defecto inseguros: `SECRET_KEY` es obligatoria (ya no existe `changeme`) y `DATABASE_URL` por defecto es un marcador inválido (host `.invalid`) en lugar de una URL con la contraseña `iocpass`
- `install.sh` solo conserva la contraseña histórica `iocpass` en instalaciones antiguas cuando existe el volumen `pgdata` (o no se puede comprobar), con un aviso para rotarla; en caso contrario genera una contraseña aleatoria

- Caché de `no_api_key`: ya no se guarda en Redis el resultado cuando el tenant no tiene ninguna clave API configurada
- Validación de IOC: entradas formadas solo por dígitos y puntos que no son IPs válidas (por ejemplo `999.999.999.999`) se rechazan en lugar de clasificarse como URL
- `scripts/verify-deploy.sh` usa un email de prueba `@example.com` (el dominio `.local` está reservado y el backend lo rechazaba con 422, lo que hacía fallar la verificación de `install.sh`)
- Variables numéricas vacías en el `.env` (por ejemplo `REFRESH_TOKEN_EXPIRE_DAYS=`) usan el valor por defecto en lugar de provocar un error de validación

### Seguridad

- Reducción de la superficie expuesta: Postgres y Redis inaccesibles desde fuera de la red Docker
- Sin credenciales por defecto en `docker-compose.yml` ni en `config.py`: las variables obligatorias hacen fallar el arranque con un mensaje claro
- Rate limiting de autenticación que ignora `X-Forwarded-For` y `X-Real-IP` salvo que `AUTH_RATE_LIMIT_TRUST_PROXY` esté activo, y que permite el paso (con aviso en el log) si Redis falla
- Actualización de dependencias criptográficas (`cryptography`, `python-jose`)


## [0.1.0] - 2026-05-14

### Añadido

- Lanzamiento inicial de IOC Correlator (FastAPI + React + Postgres + Redis + Celery)
- Autenticación multi-tenant con JWT de acceso y cookies httpOnly de refresco
- Análisis de IOC con clientes VirusTotal, AbuseIPDB, Shodan y AlienVault OTX
- Caché Redis, subidas por lotes, procesamiento Celery y progreso por WebSocket
- Gestión de claves API con cifrado Fernet y flujo OAuth de VirusTotal
- Informes PDF, resúmenes del panel y bóveda de documentación Obsidian
