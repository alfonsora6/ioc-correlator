# IOC Correlator

> Plataforma de inteligencia de amenazas que correlaciona indicadores (IPs, dominios, URLs y hashes) contra múltiples fuentes abiertas y comerciales. Diseñada para equipos de seguridad que necesitan una visión unificada del riesgo por IOC, con aislamiento multi-tenant y flujos de trabajo individuales y por lotes.

IOC Correlator agrega en paralelo los resultados de **VirusTotal**, **AbuseIPDB**, **Shodan** y **AlienVault OTX**, calcula una puntuación de amenaza (0–100) con niveles de severidad y ofrece panel analítico, historial, exportación de informes PDF y análisis masivo de archivos de log.

## Características

- **Multi-tenant**: registro, inicio de sesión y sesiones JWT con datos aislados por organización
- **Análisis de IOC individual**: detección automática de tipo (IP, dominio, URL, hash) y consulta correlacionada
- **Fuentes de inteligencia**: VirusTotal, AbuseIPDB, Shodan y AlienVault OTX en paralelo
- **Puntuación agregada**: score 0–100 con severidad LOW / MEDIUM / HIGH / CRITICAL
- **Análisis por lotes**: subida de `.txt`, `.csv` o `.log` con extracción automática de IOCs
- **Tiempo real**: progreso de lotes vía WebSocket
- **Claves API**: gestión cifrada por tenant, OAuth con VirusTotal y validación de credenciales
- **Panel de amenazas**: contadores, gráficos temporales, IOCs frecuentes y orígenes geográficos aproximados
- **Informes**: exportación PDF con nombre del tenant y rango de fechas en UTC
- **Documentación interna**: bóveda Obsidian en `/obsidian/` para arquitectura, APIs y despliegue
- **Interfaz web**: modo claro/oscuro, diseño responsive, español por defecto e inglés opcional

## Instalación

**Linux (recomendado)** — mismo flujo que el manual:

```bash
chmod +x install.sh
./install.sh          # completo
./install.sh --solo-app   # solo .env + docker (si Docker ya está listo)
```

La guía detallada (instalación manual, API keys y solución de problemas) está en [MANUAL-INSTALACION.md](MANUAL-INSTALACION.md). Documentación técnica en la bóveda [obsidian/](obsidian/).

## Cumplimiento de proveedores

Debes cumplir los términos de uso y límites de cuota de **VirusTotal**, **AbuseIPDB**, **Shodan** y **OTX**. Las claves API son responsabilidad de cada tenant.

## Contribuir

Las pull requests son bienvenidas. Abre primero un issue para discutir cambios importantes.

## Licencia

MIT
