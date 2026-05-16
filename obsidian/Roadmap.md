---
tags: [roadmap, future, features, hoja-de-ruta]
---

# Hoja de ruta

## v1.0 — MVP (actual)

- [x] Autenticación multi-tenant (registro / login / JWT)
- [x] Análisis de IOC individual (IP / dominio / hash / URL)
- [x] Integración VirusTotal + AbuseIPDB + Shodan + OTX
- [x] Panel de amenazas con contadores de severidad
- [x] Gestión de claves API con validación
- [x] Análisis por lotes vía Celery
- [x] Exportación PDF
- [x] Bóveda Obsidian de conocimiento

## v1.1

- [ ] Integración MISP (envío/recepción de indicadores)
- [ ] Alertas Slack/Teams en hallazgos CRITICAL
- [ ] Notificaciones por correo
- [ ] 2FA (TOTP)

## v1.2

- [ ] Exportación STIX/TAXII
- [ ] Pesos de puntuación personalizables por tenant
- [ ] Re-análisis programado de IOCs guardados
- [ ] API pública con clave por tenant

## v2.0

- [ ] Reducción de falsos positivos con ML
- [ ] Atribución de actor de amenaza
- [ ] Grafo de relaciones entre IOCs

## Notas relacionadas

- [[Architecture]]
- [[Development-Log]]
